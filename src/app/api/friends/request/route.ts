import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { friendships, users } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const { userId } = body;
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 });
  if (userId === user.id) return NextResponse.json({ error: 'No puedes enviarte solicitud a ti mismo' }, { status: 400 });

  // Check target user exists
  const target = db.select().from(users).where(eq(users.id, userId)).get();
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  // Check for existing friendship in either direction
  const existing = db.select().from(friendships)
    .where(or(
      and(eq(friendships.userId, user.id), eq(friendships.friendId, userId)),
      and(eq(friendships.userId, userId), eq(friendships.friendId, user.id))
    ))
    .get();

  if (existing) {
    if (existing.status === 'accepted') return NextResponse.json({ error: 'Ya son amigos' }, { status: 409 });
    if (existing.status === 'pending') return NextResponse.json({ error: 'Solicitud pendiente' }, { status: 409 });
    // If rejected, allow re-sending by updating
    if (existing.status === 'rejected') {
      db.update(friendships).set({ status: 'pending', createdAt: Date.now() }).where(eq(friendships.id, existing.id)).run();
      return NextResponse.json({ success: true, friendshipId: existing.id });
    }
  }

  const id = uuidv4();
  db.insert(friendships).values({
    id,
    userId: user.id,
    friendId: userId,
    status: 'pending',
    createdAt: Date.now(),
  }).run();

  return NextResponse.json({ success: true, friendshipId: id });
}