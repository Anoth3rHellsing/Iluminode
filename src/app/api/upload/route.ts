import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads', 'attachments');
const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'text/plain', 'application/zip',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
];

export async function POST(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Archivo demasiado grande (máx 25MB)' }, { status: 400 });

    const dirName = uuidv4();
    const dir = path.join(UPLOAD_DIR, dirName);
    fs.mkdirSync(dir, { recursive: true });

    const ext = path.extname(file.name) || '.bin';
    const filename = `att_${uuidv4()}${ext}`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, Buffer.from(await file.arrayBuffer()));

    const attachmentUrl = `/api/uploads/attachments/${dirName}/${filename}`;
    return NextResponse.json({ attachmentUrl, attachmentType: file.type, attachmentName: file.name });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
  }
}