import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { stories, storyViews, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Verify ownership
  const story = db.select({ userId: stories.userId })
    .from(stories)
    .where(eq(stories.id, params.id))
    .get();

  if (!story) return NextResponse.json({ error: 'Historia no encontrada' }, { status: 404 });
  if (story.userId !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const viewers = db.select({
    userId: storyViews.userId,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    viewedAt: storyViews.viewedAt,
  })
    .from(storyViews)
    .innerJoin(users, eq(storyViews.userId, users.id))
    .where(eq(storyViews.storyId, params.id))
    .orderBy(desc(storyViews.viewedAt))
    .all();

  return NextResponse.json({ viewers });
}