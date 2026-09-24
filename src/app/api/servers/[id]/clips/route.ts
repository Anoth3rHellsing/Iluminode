import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { clips, clipLikes, clipComments, users } from '@/lib/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { writeFile } from 'fs/promises';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serverId = params.id;
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 20), 50);
  const offset = Number(request.nextUrl.searchParams.get('offset') || 0);

  const clipList = db.select({
    id: clips.id,
    title: clips.title,
    videoUrl: clips.videoUrl,
    thumbnailUrl: clips.thumbnailUrl,
    likes: clips.likes,
    createdAt: clips.createdAt,
    authorId: clips.authorId,
    authorUsername: users.username,
    authorDisplayName: users.displayName,
    authorAvatarUrl: users.avatarUrl,
  })
    .from(clips)
    .leftJoin(users, eq(clips.authorId, users.id))
    .where(eq(clips.serverId, serverId))
    .orderBy(desc(clips.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const enriched = clipList.map((c) => {
    const commentCount = db.select({ count: sql<number>`count(*)` })
      .from(clipComments)
      .where(eq(clipComments.clipId, c.id))
      .get()?.count ?? 0;

    const userLiked = db.select()
      .from(clipLikes)
      .where(and(eq(clipLikes.clipId, c.id), eq(clipLikes.userId, user.id)))
      .get();

    return {
      id: c.id,
      title: c.title,
      videoUrl: c.videoUrl,
      thumbnailUrl: c.thumbnailUrl,
      likes: c.likes,
      author: {
        id: c.authorId,
        username: c.authorUsername,
        displayName: c.authorDisplayName || c.authorUsername,
        avatarUrl: c.authorAvatarUrl,
      },
      commentCount,
      userLiked: !!userLiked,
      createdAt: c.createdAt,
    };
  });

  return NextResponse.json({ clips: enriched });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serverId = params.id;
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string || '').trim();

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Allowed: mp4, webm, quicktime' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large. Max 100MB' }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), 'data', 'uploads', 'clips', serverId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = file.name.split('.').pop() || 'mp4';
  const fileName = `${uuidv4()}.${ext}`;
  const filePath = path.join(uploadDir, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  const videoUrl = `/api/uploads/clips/${serverId}/${fileName}`;
  const id = uuidv4();
  const now = Date.now();

  db.insert(clips).values({
    id,
    serverId,
    authorId: user.id,
    title,
    videoUrl,
    thumbnailUrl: null,
    likes: 0,
    createdAt: now,
  }).run();

  return NextResponse.json({
    clip: { id, title, videoUrl, createdAt: now },
  }, { status: 201 });
}