import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { messageReports, messages, channels } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie');
  const sessionId = parseSessionCookie(cookieHeader);
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const { messageId, reason } = body as { messageId: string; reason: string };

  if (!messageId || !reason || !reason.trim()) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  // Find the message and its server
  const message = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!message) {
    return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
  }

  let serverId: string | null = null;
  if (message.channelId) {
    const channel = db.select().from(channels).where(eq(channels.id, message.channelId)).get();
    if (channel) serverId = channel.serverId;
  }

  if (!serverId) {
    return NextResponse.json({ error: 'No se puede determinar el servidor del mensaje' }, { status: 400 });
  }

  // Check for duplicate pending report by same user on same message
  const existing = db.select().from(messageReports)
    .where(and(
      eq(messageReports.messageId, messageId),
      eq(messageReports.reporterId, user.id),
      eq(messageReports.status, 'pending')
    ))
    .get();
  if (existing) {
    return NextResponse.json({ error: 'Ya has reportado este mensaje' }, { status: 409 });
  }

  const now = Date.now();
  const id = uuidv4();

  db.insert(messageReports).values({
    id,
    messageId,
    reporterId: user.id,
    serverId,
    reason: reason.trim(),
    status: 'pending',
    createdAt: now,
  }).run();

  return NextResponse.json({ success: true, id });
}