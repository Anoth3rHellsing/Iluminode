import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { groupDms, groupDmMembers, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { userId } = body;

  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });

  // Only owner can add members
  const group = db.select().from(groupDms).where(eq(groupDms.id, id)).get();
  if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
  if (group.ownerId !== user.id) return NextResponse.json({ error: 'Solo el propietario puede agregar miembros' }, { status: 403 });

  // Check target exists
  const target = db.select().from(users).where(eq(users.id, userId)).get();
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  // Check not already member
  const existing = db.select().from(groupDmMembers)
    .where(and(eq(groupDmMembers.groupDmId, id), eq(groupDmMembers.userId, userId)))
    .get();
  if (existing) return NextResponse.json({ error: 'Ya es miembro del grupo' }, { status: 409 });

  db.insert(groupDmMembers).values({
    groupDmId: id,
    userId,
    joinedAt: Date.now(),
  }).run();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get('userId');

  if (!targetUserId) return NextResponse.json({ error: 'userId requerido como query param' }, { status: 400 });

  // Only owner can remove others; anyone can remove themselves
  const group = db.select().from(groupDms).where(eq(groupDms.id, id)).get();
  if (!group) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });

  if (targetUserId !== user.id && group.ownerId !== user.id) {
    return NextResponse.json({ error: 'Sin permisos para eliminar miembros' }, { status: 403 });
  }

  const membership = db.select().from(groupDmMembers)
    .where(and(eq(groupDmMembers.groupDmId, id), eq(groupDmMembers.userId, targetUserId)))
    .get();
  if (!membership) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 });

  db.delete(groupDmMembers)
    .where(and(eq(groupDmMembers.groupDmId, id), eq(groupDmMembers.userId, targetUserId)))
    .run();

  return NextResponse.json({ success: true });
}