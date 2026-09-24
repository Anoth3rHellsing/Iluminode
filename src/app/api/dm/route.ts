import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dmChannels, users, messages } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { createDmSchema } from '@/lib/validators';
import { decrypt } from '@/lib/encryption';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, or, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const dms = db.select().from(dmChannels)
    .where(or(eq(dmChannels.user1Id, user.id), eq(dmChannels.user2Id, user.id)))
    .all();

  const result = [];
  for (const dm of dms) {
    const otherUserId = dm.user1Id === user.id ? dm.user2Id : dm.user1Id;
    const otherUser = db.select({
      id: users.id, username: users.username, displayName: users.displayName,
      avatarUrl: users.avatarUrl, status: users.status,
    }).from(users).where(eq(users.id, otherUserId)).get();

    const lastMsg = db.select().from(messages)
      .where(eq(messages.dmChannelId, dm.id))
      .orderBy(desc(messages.createdAt)).limit(1).get();

    let lastMessage = null;
    if (lastMsg) {
      try {
        lastMessage = {
          content: decrypt(lastMsg.encryptedContent),
          createdAt: lastMsg.createdAt,
        };
      } catch { /* skip */ }
    }

    result.push({ ...dm, otherUser, lastMessage });
  }

  result.sort((a, b) => (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt));
  return NextResponse.json({ dms: result });
}

export async function POST(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = createDmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (parsed.data.userId === user.id) {
      return NextResponse.json({ error: 'No puedes enviarte mensajes a ti mismo' }, { status: 400 });
    }

    const targetUser = db.select().from(users).where(eq(users.id, parsed.data.userId)).get();
    if (!targetUser || targetUser.isBanned) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Ensure consistent ordering: smaller ID first
    const [user1, user2] = user.id < parsed.data.userId
      ? [user.id, parsed.data.userId]
      : [parsed.data.userId, user.id];

    const existing = db.select().from(dmChannels)
      .where(and(eq(dmChannels.user1Id, user1), eq(dmChannels.user2Id, user2))).get();

    if (existing) {
      return NextResponse.json({ dm: existing });
    }

    const now = Date.now();
    const dmId = uuidv4();
    db.insert(dmChannels).values({
      id: dmId, user1Id: user1, user2Id: user2, createdAt: now,
    }).run();

    const dm = db.select().from(dmChannels).where(eq(dmChannels.id, dmId)).get();
    return NextResponse.json({ dm }, { status: 201 });
  } catch (error) {
    console.error('Create DM error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}