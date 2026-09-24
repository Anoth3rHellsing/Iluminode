import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { serverInvites, serverMembers } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, params.id), eq(serverMembers.userId, user.id))).get();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin') && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
  }

  const invites = db.select().from(serverInvites)
    .where(eq(serverInvites.serverId, params.id)).all();
  return NextResponse.json({ invites });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, params.id), eq(serverMembers.userId, user.id))).get();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin') && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxUses = body.maxUses ? parseInt(body.maxUses, 10) : null;
    const expiresHours = body.expiresHours ? parseInt(body.expiresHours, 10) : null;

    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    const now = Date.now();

    db.insert(serverInvites).values({
      code,
      serverId: params.id,
      createdBy: user.id,
      maxUses,
      uses: 0,
      expiresAt: expiresHours ? now + expiresHours * 3600000 : null,
      createdAt: now,
    }).run();

    return NextResponse.json({ code }, { status: 201 });
  } catch (error) {
    console.error('Create server invite error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}