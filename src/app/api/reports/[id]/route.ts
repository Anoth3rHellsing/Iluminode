import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { messageReports, serverMembers, messages, channels, reactions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { logAudit } from '@/lib/audit';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieHeader = request.headers.get('cookie');
  const sessionId = parseSessionCookie(cookieHeader);
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const reportId = params.id;

  const report = db.select().from(messageReports).where(eq(messageReports.id, reportId)).get();
  if (!report) {
    return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
  }

  // Check admin/owner permission on the server
  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, report.serverId), eq(serverMembers.userId, user.id)))
    .get();
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
  }

  const body = await request.json();
  const { status, action } = body as { status: 'resolved' | 'dismissed'; action?: string };

  if (!['resolved', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
  }

  // Perform optional action
  if (action === 'delete_message') {
    const msg = db.select().from(messages).where(eq(messages.id, report.messageId)).get();
    if (msg) {
      db.delete(reactions).where(eq(reactions.messageId, msg.id)).run();
      db.delete(messages).where(eq(messages.id, msg.id)).run();
      logAudit(report.serverId, user.id, 'delete_message', msg.authorId, { messageId: msg.id, viaReport: reportId });
    }
  } else if (action === 'mute_user') {
    // Mute for 1 day as default action from report
    const msg = db.select().from(messages).where(eq(messages.id, report.messageId)).get();
    if (msg) {
      const { serverMutes } = await import('@/lib/db/schema');
      const { v4: uuidv4 } = await import('uuid');
      const existingMute = db.select().from(serverMutes)
        .where(and(eq(serverMutes.serverId, report.serverId), eq(serverMutes.userId, msg.authorId)))
        .get();
      if (!existingMute || existingMute.expiresAt <= Date.now()) {
        const now = Date.now();
        db.insert(serverMutes).values({
          id: uuidv4(),
          serverId: report.serverId,
          userId: msg.authorId,
          mutedBy: user.id,
          reason: `Silenciado por reporte: ${report.reason}`,
          expiresAt: now + 24 * 60 * 60 * 1000,
          createdAt: now,
        }).run();
        logAudit(report.serverId, user.id, 'mute', msg.authorId, { duration: 1440, reason: 'Via reporte', reportId });
      }
    }
  } else if (action === 'ban_user') {
    const msg = db.select().from(messages).where(eq(messages.id, report.messageId)).get();
    if (msg) {
      db.update(require('@/lib/db/schema').users)
        .set({ isBanned: 1, status: 'offline', updatedAt: Date.now() })
        .where(eq(require('@/lib/db/schema').users.id, msg.authorId))
        .run();
      logAudit(report.serverId, user.id, 'ban', msg.authorId, { reason: 'Via reporte', reportId });
    }
  }

  db.update(messageReports)
    .set({ status })
    .where(eq(messageReports.id, reportId))
    .run();

  return NextResponse.json({ success: true });
}