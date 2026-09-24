import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { servers, serverMembers } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

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

  const server = db.select().from(servers).where(eq(servers.id, serverId)).get();
  if (!server) {
    return NextResponse.json({ error: 'Servidor no encontrado' }, { status: 404 });
  }

  const existing = db.select()
    .from(serverMembers)
    .where(and(
      eq(serverMembers.serverId, serverId),
      eq(serverMembers.userId, user.id)
    ))
    .get();

  if (existing) {
    return NextResponse.json({ error: 'Ya eres miembro de este servidor' }, { status: 409 });
  }

  db.insert(serverMembers).values({
    serverId,
    userId: user.id,
    role: 'member',
    joinedAt: Date.now(),
  }).run();

  return NextResponse.json({ success: true });
}