import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { serverMutes, serverMembers, users } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieHeader = request.headers.get('cookie');
  const sessionId = parseSessionCookie(cookieHeader);
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const serverId = params.id;

  // Check admin/owner permission
  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, user.id)))
    .get();
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
  }

  const now = Date.now();

  // Clean up expired mutes
  db.delete(serverMutes)
    .where(and(eq(serverMutes.serverId, serverId), gt(serverMutes.expiresAt, now)))
    .run();

  // Get active mutes
  const mutes = db.select({
    id: serverMutes.id,
    userId: serverMutes.userId,
    mutedBy: serverMutes.mutedBy,
    reason: serverMutes.reason,
    expiresAt: serverMutes.expiresAt,
    createdAt: serverMutes.createdAt,
    user: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    },
  })
    .from(serverMutes)
    .leftJoin(users, eq(serverMutes.userId, users.id))
    .where(and(eq(serverMutes.serverId, serverId), gt(serverMutes.expiresAt, now)))
    .all();

  return NextResponse.json({ mutes });
}