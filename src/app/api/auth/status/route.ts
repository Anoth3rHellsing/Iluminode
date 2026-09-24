import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const { customStatus, customStatusEmoji, status } = body;

  const updates: Record<string, any> = { updatedAt: Date.now() };

  if (customStatus !== undefined) {
    const trimmed = (customStatus || '').slice(0, 100);
    updates.customStatus = trimmed || null;
  }
  if (customStatusEmoji !== undefined) {
    updates.customStatusEmoji = customStatusEmoji || null;
  }
  if (status !== undefined) {
    const validStatuses = ['online', 'away', 'dnd', 'offline'];
    if (validStatuses.includes(status)) {
      updates.status = status;
    }
  }

  db.update(users).set(updates).where(eq(users.id, user.id)).run();

  const updated = db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    status: users.status,
    customStatus: users.customStatus,
    customStatusEmoji: users.customStatusEmoji,
  }).from(users).where(eq(users.id, user.id)).get();

  return NextResponse.json({ user: updated });
}