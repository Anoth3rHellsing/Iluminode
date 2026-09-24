import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { servers, serverMembers } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'servers');
const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const serverId = params.id;
  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, user.id))).get();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin') && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Tipo no permitido' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Archivo demasiado grande (máx 8MB)' }, { status: 400 });

    const dir = path.join(UPLOAD_DIR, serverId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ext = file.type === 'image/gif' ? '.gif' : file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
    const filename = `banner_${uuidv4()}${ext}`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, Buffer.from(await file.arrayBuffer()));

    const bannerUrl = `/api/uploads/servers/${serverId}/${filename}`;
    db.update(servers).set({ bannerUrl }).where(eq(servers.id, serverId)).run();

    return NextResponse.json({ bannerUrl });
  } catch (error) {
    console.error('Server banner upload error:', error);
    return NextResponse.json({ error: 'Error al subir banner' }, { status: 500 });
  }
}