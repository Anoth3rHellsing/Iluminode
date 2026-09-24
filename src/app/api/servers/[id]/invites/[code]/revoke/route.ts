import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { serverInvites, serverMembers } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; code: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, params.id), eq(serverMembers.userId, user.id))).get();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin') && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
  }

  const invite = db.select().from(serverInvites)
    .where(and(eq(serverInvites.code, params.code), eq(serverInvites.serverId, params.id))).get();
  if (!invite) return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });

  db.update(serverInvites).set({ revoked: 1 }).where(eq(serverInvites.code, params.code)).run();
  return NextResponse.json({ success: true });
}