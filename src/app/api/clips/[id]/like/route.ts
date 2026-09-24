import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { clips, clipLikes } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clipId = params.id;

  const clip = db.select().from(clips).where(eq(clips.id, clipId)).get();
  if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 });

  const existing = db.select()
    .from(clipLikes)
    .where(and(eq(clipLikes.clipId, clipId), eq(clipLikes.userId, user.id)))
    .get();

  if (existing) {
    db.delete(clipLikes)
      .where(and(eq(clipLikes.clipId, clipId), eq(clipLikes.userId, user.id)))
      .run();
    db.update(clips)
      .set({ likes: sql`MAX(0, ${clips.likes} - 1)` })
      .where(eq(clips.id, clipId))
      .run();
    const updated = db.select({ likes: clips.likes }).from(clips).where(eq(clips.id, clipId)).get();
    return NextResponse.json({ liked: false, likes: updated?.likes ?? 0 });
  } else {
    db.insert(clipLikes).values({ clipId, userId: user.id }).run();
    db.update(clips)
      .set({ likes: sql`${clips.likes} + 1` })
      .where(eq(clips.id, clipId))
      .run();
    const updated = db.select({ likes: clips.likes }).from(clips).where(eq(clips.id, clipId)).get();
    return NextResponse.json({ liked: true, likes: updated?.likes ?? 0 });
  }
}