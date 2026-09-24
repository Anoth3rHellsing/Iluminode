import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { friendships, users } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Accepted friends
  const acceptedRows = db.select({
    id: friendships.id,
    friendId: friendships.friendId,
    userId: friendships.userId,
    status: friendships.status,
    createdAt: friendships.createdAt,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    statusOnline: users.status,
    customStatus: users.customStatus,
    customStatusEmoji: users.customStatusEmoji,
  }).from(friendships)
    .innerJoin(users, or(
      and(eq(friendships.friendId, users.id), eq(friendships.userId, user.id)),
      and(eq(friendships.userId, users.id), eq(friendships.friendId, user.id))
    ))
    .where(and(
      eq(friendships.status, 'accepted'),
      or(eq(friendships.userId, user.id), eq(friendships.friendId, user.id))
    ))
    .all();

  // Deduplicate (each friendship stored once but joined both ways)
  const seen = new Set<string>();
  const friends = [];
  for (const row of acceptedRows) {
    const friendUserId = row.userId === user.id ? row.friendId : row.userId;
    if (seen.has(friendUserId)) continue;
    seen.add(friendUserId);
    friends.push({
      id: friendUserId,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      status: row.statusOnline,
      customStatus: row.customStatus,
      customStatusEmoji: row.customStatusEmoji,
      friendshipId: row.id,
    });
  }

  // Pending incoming (others sent to me)
  const incoming = db.select({
    id: friendships.id,
    userId: friendships.userId,
    createdAt: friendships.createdAt,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  }).from(friendships)
    .innerJoin(users, eq(friendships.userId, users.id))
    .where(and(eq(friendships.friendId, user.id), eq(friendships.status, 'pending')))
    .all();

  // Pending outgoing (I sent to others)
  const outgoing = db.select({
    id: friendships.id,
    friendId: friendships.friendId,
    createdAt: friendships.createdAt,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  }).from(friendships)
    .innerJoin(users, eq(friendships.friendId, users.id))
    .where(and(eq(friendships.userId, user.id), eq(friendships.status, 'pending')))
    .all();

  return NextResponse.json({
    friends,
    incoming: incoming.map(r => ({ id: r.id, userId: r.userId, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl, createdAt: r.createdAt })),
    outgoing: outgoing.map(r => ({ id: r.id, userId: r.friendId, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl, createdAt: r.createdAt })),
  });
}