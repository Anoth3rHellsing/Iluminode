import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { messages, channels, serverMembers, dmChannels } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { eq, and, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'attachments');
const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'text/plain', 'application/zip',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const message = db.select().from(messages).where(eq(messages.id, params.id)).get();
  if (!message) return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
  if (message.authorId !== user.id) return NextResponse.json({ error: 'No es tu mensaje' }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Archivo demasiado grande (máx 25MB)' }, { status: 400 });

    const dir = path.join(UPLOAD_DIR, uuidv4());
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(file.name) || '.bin';
    const filename = `att_${uuidv4()}${ext}`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, Buffer.from(await file.arrayBuffer()));

    const attachmentUrl = `/api/uploads/attachments/${path.basename(dir)}/${filename}`;
    db.update(messages).set({
      attachmentUrl,
      attachmentType: file.type,
      attachmentName: file.name,
    }).where(eq(messages.id, params.id)).run();

    return NextResponse.json({ attachmentUrl, attachmentType: file.type, attachmentName: file.name });
  } catch (error) {
    console.error('Attachment upload error:', error);
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
  }
}