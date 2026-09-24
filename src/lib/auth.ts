import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { sessions, users } from './db/schema';
import { eq } from 'drizzle-orm';
import { serialize, parse } from 'cookie';

const BCRYPT_ROUNDS = 12;
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionCookie(sessionId: string): string {
  return serialize('session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_EXPIRY_MS / 1000,
    path: '/',
  });
}

export function clearSessionCookie(): string {
  return serialize('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}

export function parseSessionCookie(cookieHeader: string | undefined | null): string | null {
  if (!cookieHeader) return null;
  const parsed = parse(cookieHeader);
  return parsed.session || null;
}

export async function createSession(userId: string): Promise<string> {
  const id = uuidv4();
  const now = Date.now();
  db.insert(sessions).values({
    id,
    userId,
    expiresAt: now + SESSION_EXPIRY_MS,
    createdAt: now,
  }).run();
  return id;
}

export async function getSessionUser(sessionId: string | null) {
  if (!sessionId) return null;

  const session = db.select({
    userId: sessions.userId,
    expiresAt: sessions.expiresAt,
  })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session || session.expiresAt < Date.now()) {
    if (session) {
      db.delete(sessions).where(eq(sessions.id, sessionId)).run();
    }
    return null;
  }

  const user = db.select()
    .from(users)
    .where(eq(users.id, session.userId))
    .get();

  if (!user || user.isBanned) return null;
  return user;
}

export function destroySession(sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}