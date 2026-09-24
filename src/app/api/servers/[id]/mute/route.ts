import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { serverMutes, serverMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '@/lib/audit';

export async function POST(
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

  const body = await request.json();
  const { userId, duration, reason } = body as { userId: string; duration: number; reason?: string };

  if (!userId || !duration) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  // Validate duration options: 10min, 60min, 1440min (1d), 10080min (7d)
  const validDurations = [10, 60, 1440, 10080];
  if (!validDurations.includes(duration)) {
    return NextResponse.json({ error: 'Duración no válida' }, { status: 400 });
  }

  // Cannot mute yourself
  if (userId === user.id) {
    return NextResponse.json({ error: 'No puedes silenciarte a ti mismo' }, { status: 400 });
  }

  // Check target is member of server
  const targetMembership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, userId)))
    .get();
  if (!targetMembership) {
    return NextResponse.json({ error: 'Usuario no es miembro del servidor' }, { status: 400 });
  }

  // Cannot mute owner or other admins (unless you are owner or global admin)
  if ((targetMembership.role === 'owner' || targetMembership.role === 'admin') && membership?.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ error: 'No puedes silenciar a un administrador' }, { status: 403 });
  }

  // Check if already muted
  const existingMute = db.select().from(serverMutes)
    .where(and(eq(serverMutes.serverId, serverId), eq(serverMutes.userId, userId)))
    .get();
  if (existingMute && existingMute.expiresAt > Date.now()) {
    return NextResponse.json({ error: 'El usuario ya está silenciado' }, { status: 409 });
  }

  const now = Date.now();
  const expiresAt = now + duration * 60 * 1000;

  db.insert(serverMutes).values({
    id: uuidv4(),
    serverId,
    userId,
    mutedBy: user.id,
    reason: reason || null,
    expiresAt,
    createdAt: now,
  }).run();

  logAudit(serverId, user.id, 'mute', userId, { duration, reason: reason || null, expiresAt });

  return NextResponse.json({ success: true, expiresAt });
}