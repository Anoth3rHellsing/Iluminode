import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const segments = params.path;
  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const safePath = path.join(...segments);
  const fullPath = path.join(process.cwd(), 'data', 'uploads', 'clips', safePath);

  // Prevent directory traversal
  const resolvedBase = path.resolve(path.join(process.cwd(), 'data', 'uploads', 'clips'));
  const resolvedFull = path.resolve(fullPath);
  if (!resolvedFull.startsWith(resolvedBase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!fs.existsSync(resolvedFull)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const stat = fs.statSync(resolvedFull);
  const ext = path.extname(resolvedFull).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const range = request.headers.get('range');
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    const fileStream = fs.createReadStream(resolvedFull, { start, end });
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk: string | Buffer) => controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(stream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': contentType,
      },
    });
  }

  const fileBuffer = fs.readFileSync(resolvedFull);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
    },
  });
}