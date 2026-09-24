import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { channels, serverMembers } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'channels');
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const channel = db.select().from(channels).where(eq(channels.id, params.id)).get();
  if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });

  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, channel.serverId), eq(serverMembers.userId, user.id))).get();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin') && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Tipo no permitido' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Archivo demasiado grande (máx 5MB)' }, { status: 400 });

    const dir = path.join(UPLOAD_DIR, channel.serverId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ext = file.type === 'image/gif' ? '.gif' : file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
    const filename = `ch_${uuidv4()}${ext}`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, Buffer.from(await file.arrayBuffer()));

    const imageUrl = `/api/uploads/channels/${channel.serverId}/${filename}`;
    db.update(channels).set({ imageUrl }).where(eq(channels.id, params.id)).run();

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Channel image upload error:', error);
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const channel = db.select().from(channels).where(eq(channels.id, params.id)).get();
  if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });

  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, channel.serverId), eq(serverMembers.userId, user.id))).get();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin') && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.gradient !== undefined) updates.gradient = body.gradient || null;
    if (body.name !== undefined) updates.name = body.name;
    if (Object.keys(updates).length > 0) {
      db.update(channels).set(updates).where(eq(channels.id, params.id)).run();
    }
    const updated = db.select().from(channels).where(eq(channels.id, params.id)).get();
    return NextResponse.json({ channel: updated });
  } catch (error) {
    console.error('Update channel error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}