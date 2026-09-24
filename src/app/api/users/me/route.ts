import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { updateProfileSchema } from '@/lib/validators';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio,
      status: user.status,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;

    db.update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .run();

    const updated = db.select().from(users).where(eq(users.id, user.id)).get();
    return NextResponse.json({
      user: {
        id: updated!.id,
        username: updated!.username,
        displayName: updated!.displayName,
        avatarUrl: updated!.avatarUrl,
        bannerUrl: updated!.bannerUrl,
        bio: updated!.bio,
        status: updated!.status,
        role: updated!.role,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}