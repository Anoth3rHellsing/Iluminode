import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { serverInvites, serverMembers, servers } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { joinServerInviteSchema } from '@/lib/validators';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = joinServerInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const invite = db.select().from(serverInvites)
      .where(eq(serverInvites.code, parsed.data.code)).get();

    if (!invite || invite.revoked === 1) {
      return NextResponse.json({ error: 'Código de invitación inválido o revocado' }, { status: 404 });
    }

    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      return NextResponse.json({ error: 'Esta invitación ha expirado' }, { status: 410 });
    }

    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return NextResponse.json({ error: 'Esta invitación ya alcanzó su límite de usos' }, { status: 410 });
    }

    const existing = db.select().from(serverMembers)
      .where(and(eq(serverMembers.serverId, invite.serverId), eq(serverMembers.userId, user.id))).get();

    if (existing) {
      return NextResponse.json({ error: 'Ya eres miembro de este servidor' }, { status: 409 });
    }

    const now = Date.now();
    db.insert(serverMembers).values({
      serverId: invite.serverId,
      userId: user.id,
      role: 'member',
      joinedAt: now,
    }).run();

    db.update(serverInvites)
      .set({ uses: invite.uses + 1 })
      .where(eq(serverInvites.code, invite.code))
      .run();

    const server = db.select().from(servers).where(eq(servers.id, invite.serverId)).get();
    return NextResponse.json({ server: { ...server, memberRole: 'member' } });
  } catch (error) {
    console.error('Join server invite error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}