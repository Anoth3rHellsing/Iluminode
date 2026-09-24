import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { stories, storyViews, users } from '@/lib/db/schema';
import { eq, lt, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const STORIES_DIR = path.join(process.cwd(), 'data', 'uploads', 'stories');
const MAX_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
];
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const now = Date.now();

  // Clean up expired stories
  const expired = db.select({ id: stories.id })
    .from(stories)
    .where(lt(stories.expiresAt, now))
    .all();

  for (const s of expired) {
    try {
      db.delete(storyViews).where(eq(storyViews.storyId, s.id)).run();
      db.delete(stories).where(eq(stories.id, s.id)).run();
    } catch { /* ignore */ }
  }

  // Get active stories grouped by user
  const activeStories = db.select({
    id: stories.id,
    userId: stories.userId,
    mediaUrl: stories.mediaUrl,
    mediaType: stories.mediaType,
    createdAt: stories.createdAt,
    expiresAt: stories.expiresAt,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  })
    .from(stories)
    .innerJoin(users, eq(stories.userId, users.id))
    .where(sql`${stories.expiresAt} > ${now}`)
    .orderBy(desc(stories.createdAt))
    .all();

  // Get viewed story IDs for current user
  const viewedIds = new Set(
    db.select({ storyId: storyViews.storyId })
      .from(storyViews)
      .where(eq(storyViews.userId, user.id))
      .all()
      .map(v => v.storyId)
  );

  // Group by user
  const groupMap = new Map<string, any>();
  for (const s of activeStories) {
    if (!groupMap.has(s.userId)) {
      groupMap.set(s.userId, {
        userId: s.userId,
        username: s.username,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl,
        items: [],
      });
    }
    groupMap.get(s.userId).items.push({
      id: s.id,
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType,
      createdAt: s.createdAt,
      viewed: viewedIds.has(s.id),
    });
  }

  const result = Array.from(groupMap.values()).map(g => ({
    ...g,
    allViewed: g.items.every((i: any) => i.viewed),
  }));

  return NextResponse.json({ stories: result });
}

export async function POST(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Archivo demasiado grande (máx 50MB)' }, { status: 400 });

    const userDir = path.join(STORIES_DIR, user.id);
    fs.mkdirSync(userDir, { recursive: true });

    const ext = path.extname(file.name) || (file.type.startsWith('video/') ? '.mp4' : '.jpg');
    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(userDir, filename);
    fs.writeFileSync(filepath, Buffer.from(await file.arrayBuffer()));

    const mediaUrl = `/api/uploads/stories/${user.id}/${filename}`;
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const now = Date.now();
    const id = uuidv4();

    db.insert(stories).values({
      id,
      userId: user.id,
      mediaUrl,
      mediaType,
      createdAt: now,
      expiresAt: now + TWENTY_FOUR_HOURS,
    }).run();

    return NextResponse.json({
      story: { id, mediaUrl, mediaType, createdAt: now, expiresAt: now + TWENTY_FOUR_HOURS },
    });
  } catch (error) {
    console.error('Story upload error:', error);
    return NextResponse.json({ error: 'Error al subir historia' }, { status: 500 });
  }
}