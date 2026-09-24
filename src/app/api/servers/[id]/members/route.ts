import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { serverMembers, users } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const serverId = params.id;

  // Verify membership (admins can see any server's members)
  if (user.role !== 'admin') {
    const membership = db.select()
      .from(serverMembers)
      .where(and(
        eq(serverMembers.serverId, serverId),
        eq(serverMembers.userId, user.id)
      ))
      .get();

    if (!membership) {
      return NextResponse.json({ error: 'No tienes acceso a este servidor' }, { status: 403 });
    }
  }

  const memberships = db.select({
    userId: serverMembers.userId,
    role: serverMembers.role,
  })
    .from(serverMembers)
    .where(eq(serverMembers.serverId, serverId))
    .all();

  const members = [];
  for (const m of memberships) {
    const memberUser = db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      status: users.status,
      isBanned: users.isBanned,
    })
      .from(users)
      .where(eq(users.id, m.userId))
      .get();

    if (memberUser && memberUser.isBanned === 0) {
      members.push({
        ...memberUser,
        role: m.role,
      });
    }
  }

  return NextResponse.json({ members });
}