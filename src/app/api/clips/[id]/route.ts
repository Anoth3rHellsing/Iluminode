import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { clips, clipLikes, clipComments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clipId = params.id;

  const clip = db.select().from(clips).where(eq(clips.id, clipId)).get();
  if (!clip) return NextResponse.json({ error: 'Clip not found' }, { status: 404 });

  if (clip.authorId !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete associated likes and comments
  db.delete(clipLikes).where(eq(clipLikes.clipId, clipId)).run();
  db.delete(clipComments).where(eq(clipComments.clipId, clipId)).run();

  // Delete the video file
  try {
    const filePath = path.join(process.cwd(), 'data', 'uploads', 'clips', clip.serverId, path.basename(clip.videoUrl));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Failed to delete clip file:', err);
  }

  // Delete the clip record
  db.delete(clips).where(eq(clips.id, clipId)).run();

  return NextResponse.json({ success: true });
}