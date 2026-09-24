import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { friendships } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  // Find the pending request where current user is the friendId (recipient)
  const friendship = db.select().from(friendships)
    .where(and(eq(friendships.id, id), eq(friendships.friendId, user.id), eq(friendships.status, 'pending')))
    .get();

  if (!friendship) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

  db.update(friendships).set({ status: 'accepted' }).where(eq(friendships.id, id)).run();

  return NextResponse.json({ success: true });
}