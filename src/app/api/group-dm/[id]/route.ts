import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { groupDms, groupDmMembers, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  const membership = db.select().from(groupDmMembers)
    .where(and(eq(groupDmMembers.groupDmId, id), eq(groupDmMembers.userId, user.id)))
    .get();
  if (!membership) return NextResponse.json({ error: 'No eres miembro de este grupo' }, { status: 403 });

  const group = db.select().from(groupDms).where(eq(groupDms.id, id)).get();
  if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });

  const members = db.select({
    userId: groupDmMembers.userId,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    status: users.status,
    joinedAt: groupDmMembers.joinedAt,
  }).from(groupDmMembers)
    .innerJoin(users, eq(groupDmMembers.userId, users.id))
    .where(eq(groupDmMembers.groupDmId, id))
    .all();

  return NextResponse.json({ group: { ...group, members } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  const membership = db.select().from(groupDmMembers)
    .where(and(eq(groupDmMembers.groupDmId, id), eq(groupDmMembers.userId, user.id)))
    .get();
  if (!membership) return NextResponse.json({ error: 'No eres miembro de este grupo' }, { status: 403 });

  // Remove member
  db.delete(groupDmMembers)
    .where(and(eq(groupDmMembers.groupDmId, id), eq(groupDmMembers.userId, user.id)))
    .run();

  // Check remaining members
  const remaining = db.select().from(groupDmMembers)
    .where(eq(groupDmMembers.groupDmId, id))
    .all();

  // If owner left or no members remain, delete group
  const group = db.select().from(groupDms).where(eq(groupDms.id, id)).get();
  if (remaining.length === 0 || (group && group.ownerId === user.id && remaining.length <= 1)) {
    db.delete(groupDmMembers).where(eq(groupDmMembers.groupDmId, id)).run();
    db.delete(groupDms).where(eq(groupDms.id, id)).run();
  }

  return NextResponse.json({ success: true });
}