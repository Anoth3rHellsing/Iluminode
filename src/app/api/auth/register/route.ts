import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, inviteCodes } from '@/lib/db/schema';
import { hashPassword, createSession, createSessionCookie } from '@/lib/auth';
import { registerSchema } from '@/lib/validators';
import { addUserToMainServer, syncAllUsersToMainServer } from '@/lib/mainServer';
import { v4 as uuidv4 } from 'uuid';
import { eq, count } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { username, password, inviteCode } = parsed.data;

    const existing = db.select().from(users).where(eq(users.username, username)).get();
    if (existing) {
      return NextResponse.json(
        { error: 'El nombre de usuario ya está en uso' },
        { status: 409 }
      );
    }

    const userCountResult = db.select({ value: count() }).from(users).get();
    const isFirstUser = !userCountResult || userCountResult.value === 0;

    if (!isFirstUser) {
      if (!inviteCode) {
        return NextResponse.json(
          { error: 'Se requiere un código de invitación' },
          { status: 400 }
        );
      }
      const invite = db.select().from(inviteCodes).where(eq(inviteCodes.code, inviteCode)).get();
      if (!invite || invite.usedBy !== null || invite.revoked === 1) {
        return NextResponse.json(
          { error: 'Código de invitación inválido o ya utilizado' },
          { status: 400 }
        );
      }
    }

    const now = Date.now();
    const userId = uuidv4();
    const passwordHash = await hashPassword(password);

    db.insert(users).values({
      id: userId,
      username,
      passwordHash,
      displayName: username,
      role: isFirstUser ? 'admin' : 'member',
      status: 'online',
      createdAt: now,
      updatedAt: now,
    }).run();

    if (!isFirstUser && inviteCode) {
      db.update(inviteCodes)
        .set({ usedBy: userId, usedAt: now })
        .where(eq(inviteCodes.code, inviteCode))
        .run();
    }

    // Auto-add to main server
    if (isFirstUser) {
      syncAllUsersToMainServer();
    } else {
      addUserToMainServer(userId);
    }

    const sessionId = await createSession(userId);

    const response = NextResponse.json({
      user: {
        id: userId,
        username,
        displayName: username,
        role: isFirstUser ? 'admin' : 'member',
      },
    });
    response.headers.set('Set-Cookie', createSessionCookie(sessionId));
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Error interno del servidor', detail: message },
      { status: 500 }
    );
  }
}