import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { friendships } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
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

  // Find friendship where current user is either sender or receiver
  const friendship = db.select().from(friendships)
    .where(and(
      eq(friendships.id, id),
      or(eq(friendships.userId, user.id), eq(friendships.friendId, user.id))
    ))
    .get();

  if (!friendship) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });

  // If pending, reject it; if accepted, remove friend (delete row)
  if (friendship.status === 'pending') {
    db.update(friendships).set({ status: 'rejected' }).where(eq(friendships.id, id)).run();
  } else {
    db.delete(friendships).where(eq(friendships.id, id)).run();
  }

  return NextResponse.json({ success: true });
}