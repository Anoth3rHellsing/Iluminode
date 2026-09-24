import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, messages, servers, inviteCodes } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const userCount = db.select({ count: sql<number>`count(*)` }).from(users).get();
  const messageCount = db.select({ count: sql<number>`count(*)` }).from(messages).get();
  const serverCount = db.select({ count: sql<number>`count(*)` }).from(servers).get();
  const activeInvites = db.select({ count: sql<number>`count(*)` })
    .from(inviteCodes)
    .where(sql`${inviteCodes.usedBy} IS NULL AND ${inviteCodes.revoked} = 0`)
    .get();

  return NextResponse.json({
    stats: {
      users: userCount?.count ?? 0,
      messages: messageCount?.count ?? 0,
      servers: serverCount?.count ?? 0,
      activeInvites: activeInvites?.count ?? 0,
    },
  });
}