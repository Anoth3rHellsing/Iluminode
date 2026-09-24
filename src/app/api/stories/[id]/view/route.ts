import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { storyViews } from '@/lib/db/schema';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    db.insert(storyViews).values({
      storyId: params.id,
      userId: user.id,
      viewedAt: Date.now(),
    }).run();
  } catch {
    // Ignore unique constraint violation (already viewed)
  }

  return NextResponse.json({ success: true });
}