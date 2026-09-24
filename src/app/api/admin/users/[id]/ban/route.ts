import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const targetId = params.id;

  if (targetId === user.id) {
    return NextResponse.json({ error: 'No puedes banearte a ti mismo' }, { status: 400 });
  }

  const target = db.select().from(users).where(eq(users.id, targetId)).get();
  if (!target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  db.update(users)
    .set({ isBanned: 1, status: 'offline', updatedAt: Date.now() })
    .where(eq(users.id, targetId))
    .run();

  // Destroy all sessions for the banned user
  db.delete(sessions).where(eq(sessions.userId, targetId)).run();

  return NextResponse.json({ success: true });
}