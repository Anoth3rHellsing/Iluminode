import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const allUsers = db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    role: users.role,
    status: users.status,
    isBanned: users.isBanned,
    createdAt: users.createdAt,
  }).from(users).all();

  return NextResponse.json({ users: allUsers });
}