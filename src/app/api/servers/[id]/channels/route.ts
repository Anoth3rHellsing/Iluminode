import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { channels, serverMembers } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { createChannelSchema } from '@/lib/validators';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const serverId = params.id;
  const membership = db.select()
    .from(serverMembers)
    .where(and(
      eq(serverMembers.serverId, serverId),
      eq(serverMembers.userId, user.id)
    ))
    .get();

  if (!membership && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes acceso a este servidor' }, { status: 403 });
  }

  const channelList = db.select()
    .from(channels)
    .where(eq(channels.serverId, serverId))
    .orderBy(channels.position)
    .all();

  return NextResponse.json({ channels: channelList });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const serverId = params.id;
  const membership = db.select()
    .from(serverMembers)
    .where(and(
      eq(serverMembers.serverId, serverId),
      eq(serverMembers.userId, user.id)
    ))
    .get();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin') && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso para crear canales' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createChannelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const now = Date.now();
    const channelId = uuidv4();

    const existingChannels = db.select()
      .from(channels)
      .where(eq(channels.serverId, serverId))
      .all();
    const nextPosition = existingChannels.length;

    db.insert(channels).values({
      id: channelId,
      serverId,
      name: parsed.data.name,
      type: parsed.data.type,
      position: nextPosition,
      gradient: parsed.data.gradient || null,
      isPrivate: parsed.data.isPrivate ? 1 : 0,
      createdAt: now,
    }).run();

    const channel = db.select().from(channels).where(eq(channels.id, channelId)).get();
    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    console.error('Create channel error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}