import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { messageReports, messages, users, serverMembers, channels } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieHeader = request.headers.get('cookie');
  const sessionId = parseSessionCookie(cookieHeader);
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const serverId = params.id;

  // Check admin/owner permission
  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, user.id)))
    .get();
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');

  let query = db.select({
    id: messageReports.id,
    messageId: messageReports.messageId,
    reason: messageReports.reason,
    status: messageReports.status,
    createdAt: messageReports.createdAt,
    reporter: {
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    },
  })
    .from(messageReports)
    .leftJoin(users, eq(messageReports.reporterId, users.id))
    .where(eq(messageReports.serverId, serverId));

  if (statusFilter) {
    query = db.select({
      id: messageReports.id,
      messageId: messageReports.messageId,
      reason: messageReports.reason,
      status: messageReports.status,
      createdAt: messageReports.createdAt,
      reporter: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
      .from(messageReports)
      .leftJoin(users, eq(messageReports.reporterId, users.id))
      .where(and(eq(messageReports.serverId, serverId), eq(messageReports.status, statusFilter as 'pending' | 'resolved' | 'dismissed')));
  }

  const reports = query.orderBy(desc(messageReports.createdAt)).limit(50).all();

  // Enrich with message content and author info
  const enrichedReports = reports.map((report) => {
    const msg = db.select().from(messages).where(eq(messages.id, report.messageId)).get();
    let messageContent = null;
    let messageAuthor = null;
    if (msg) {
      try { messageContent = decrypt(msg.encryptedContent); } catch { messageContent = '[cifrado]'; }
      messageAuthor = db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      }).from(users).where(eq(users.id, msg.authorId)).get();
    }
    return { ...report, messageContent, messageAuthor };
  });

  return NextResponse.json({ reports: enrichedReports });
}