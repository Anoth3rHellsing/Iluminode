import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { servers, serverMembers, channels } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { createServerSchema } from '@/lib/validators';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const memberships = db.select({
    serverId: serverMembers.serverId,
    role: serverMembers.role,
    joinedAt: serverMembers.joinedAt,
  })
    .from(serverMembers)
    .where(eq(serverMembers.userId, user.id))
    .all();

  const serverList = [];
  for (const m of memberships) {
    const server = db.select().from(servers).where(eq(servers.id, m.serverId)).get();
    if (server) {
      serverList.push({ ...server, memberRole: m.role, joinedAt: m.joinedAt });
    }
  }

  // Sort: main server first
  serverList.sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));

  return NextResponse.json({ servers: serverList });
}

export async function POST(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const now = Date.now();
    const serverId = uuidv4();

    db.insert(servers).values({
      id: serverId,
      name: parsed.data.name,
      ownerId: user.id,
      isMain: 0,
      createdAt: now,
    }).run();

    db.insert(serverMembers).values({
      serverId,
      userId: user.id,
      role: 'owner',
      joinedAt: now,
    }).run();

    const channelId = uuidv4();
    db.insert(channels).values({
      id: channelId,
      serverId,
      name: 'general',
      type: 'text',
      position: 0,
      createdAt: now,
    }).run();

    const server = db.select().from(servers).where(eq(servers.id, serverId)).get();
    return NextResponse.json({ server: { ...server, memberRole: 'owner' } }, { status: 201 });
  } catch (error) {
    console.error('Create server error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}