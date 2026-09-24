import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { groupDms, groupDmMembers, users, messages } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const memberships = db.select({
    groupDmId: groupDmMembers.groupDmId,
    joinedAt: groupDmMembers.joinedAt,
  }).from(groupDmMembers).where(eq(groupDmMembers.userId, user.id)).all();

  const groups = [];
  for (const m of memberships) {
    const group = db.select().from(groupDms).where(eq(groupDms.id, m.groupDmId)).get();
    if (!group) continue;

    const memberRows = db.select({
      userId: groupDmMembers.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      status: users.status,
    }).from(groupDmMembers)
      .innerJoin(users, eq(groupDmMembers.userId, users.id))
      .where(eq(groupDmMembers.groupDmId, group.id))
      .all();

    const lastMsg = db.select({
      content: messages.encryptedContent,
      createdAt: messages.createdAt,
    }).from(messages)
      .where(eq(messages.groupDmId, group.id))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .get();

    groups.push({
      id: group.id,
      name: group.name,
      iconUrl: group.iconUrl,
      ownerId: group.ownerId,
      members: memberRows,
      lastMessage: lastMsg ? { content: '[mensaje]', createdAt: lastMsg.createdAt } : null,
      createdAt: group.createdAt,
    });
  }

  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const { name, memberIds } = body;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
    return NextResponse.json({ error: 'Se requieren al menos 3 miembros incluyendo el creador' }, { status: 400 });
  }

  const allMemberIds = [...new Set([user.id, ...memberIds])];
  if (allMemberIds.length < 3) {
    return NextResponse.json({ error: 'Se requieren al menos 3 miembros' }, { status: 400 });
  }

  const now = Date.now();
  const groupId = uuidv4();

  db.insert(groupDms).values({
    id: groupId,
    name: name || null,
    ownerId: user.id,
    createdAt: now,
  }).run();

  for (const memberId of allMemberIds) {
    db.insert(groupDmMembers).values({
      groupDmId: groupId,
      userId: memberId,
      joinedAt: now,
    }).run();
  }

  return NextResponse.json({ groupDmId: groupId, success: true });
}