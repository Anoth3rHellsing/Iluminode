import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { like, and, ne } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (!q || q.length < 2) return NextResponse.json({ users: [] });

  const results = db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  }).from(users)
    .where(and(
      ne(users.id, user.id),
      like(users.username, `%${q}%`)
    ))
    .limit(10)
    .all();

  return NextResponse.json({ users: results });
}