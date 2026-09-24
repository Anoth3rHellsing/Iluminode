import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { clipComments, users, clips } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clipId = params.id;

  const commentList = db.select({
    id: clipComments.id,
    content: clipComments.content,
    createdAt: clipComments.createdAt,
    authorId: clipComments.authorId,
    authorUsername: users.username,
    authorDisplayName: users.displayName,
    authorAvatarUrl: users.avatarUrl,
  })
    .from(clipComments)
    .leftJoin(users, eq(clipComments.authorId, users.id))
    .where(eq(clipComments.clipId, clipId))
    .orderBy(desc(clipComments.createdAt))
    .all();

  const enriched = commentList.map((c) => ({
    id: c.id,
    content: c.content,
    author: {
      id: c.authorId,
      username: c.authorUsername,
      displayName: c.authorDisplayName || c.authorUsername,
      avatarUrl: c.authorAvatarUrl,
    },
    createdAt: c.createdAt,
  }));

  return NextResponse.json({ comments: enriched });
}

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

  const body = await request.json();
  const content = (body.content || '').trim();

  if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  if (content.length > 500) return NextResponse.json({ error: 'Comment too long. Max 500 chars' }, { status: 400 });

  const id = uuidv4();
  const now = Date.now();

  db.insert(clipComments).values({
    id,
    clipId,
    authorId: user.id,
    content,
    createdAt: now,
  }).run();

  const author = db.select({
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  }).from(users).where(eq(users.id, user.id)).get();

  return NextResponse.json({
    comment: {
      id,
      content,
      author: {
        id: user.id,
        username: author?.username || user.username,
        displayName: author?.displayName || user.displayName || user.username,
        avatarUrl: author?.avatarUrl || user.avatarUrl,
      },
      createdAt: now,
    },
  }, { status: 201 });
}