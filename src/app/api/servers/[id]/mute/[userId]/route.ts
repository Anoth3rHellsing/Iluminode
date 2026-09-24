import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { serverMutes, serverMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const cookieHeader = request.headers.get('cookie');
  const sessionId = parseSessionCookie(cookieHeader);
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const serverId = params.id;
  const targetUserId = params.userId;

  // Check admin/owner permission
  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, user.id)))
    .get();
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
  }

  // Find active mute
  const mute = db.select().from(serverMutes)
    .where(and(eq(serverMutes.serverId, serverId), eq(serverMutes.userId, targetUserId)))
    .get();

  if (!mute || mute.expiresAt <= Date.now()) {
    return NextResponse.json({ error: 'El usuario no está silenciado' }, { status: 404 });
  }

  db.delete(serverMutes).where(eq(serverMutes.id, mute.id)).run();

  logAudit(serverId, user.id, 'unmute', targetUserId);

  return NextResponse.json({ success: true });
}