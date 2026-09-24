import { db } from './db';
import { servers, serverMembers, channels, users } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const MAIN_SERVER_NAME = 'Iluminode · General';

export function ensureMainServer(ownerId?: string): string | null {
  const existing = db.select().from(servers).where(eq(servers.isMain, 1)).get();
  if (existing) return existing.id;

  // If no ownerId provided, try to find an admin user
  let resolvedOwnerId = ownerId;
  if (!resolvedOwnerId) {
    const adminUser = db.select().from(users).where(eq(users.role, 'admin')).get();
    resolvedOwnerId = adminUser?.id;
  }

  // If still no valid owner, check if any user exists at all
  if (!resolvedOwnerId) {
    const anyUser = db.select().from(users).limit(1).get();
    resolvedOwnerId = anyUser?.id;
  }

  // No users exist yet — cannot create server (FK constraint). Return null.
  if (!resolvedOwnerId) return null;

  const now = Date.now();
  const serverId = uuidv4();

  db.insert(servers).values({
    id: serverId,
    name: MAIN_SERVER_NAME,
    ownerId: resolvedOwnerId,
    isMain: 1,
    createdAt: now,
  }).run();

  const generalId = uuidv4();
  db.insert(channels).values({
    id: generalId,
    serverId,
    name: 'general',
    type: 'text',
    position: 0,
    createdAt: now,
  }).run();

  const anunciosId = uuidv4();
  db.insert(channels).values({
    id: anunciosId,
    serverId,
    name: 'anuncios',
    type: 'text',
    position: 1,
    createdAt: now,
  }).run();

  // Add the owner to the main server
  db.insert(serverMembers).values({
    serverId,
    userId: resolvedOwnerId,
    role: 'member',
    joinedAt: now,
  }).run();

  return serverId;
}

export function addUserToMainServer(userId: string): void {
  const mainServerId = ensureMainServer(userId);
  if (!mainServerId) return;

  const existing = db.select()
    .from(serverMembers)
    .where(and(eq(serverMembers.serverId, mainServerId), eq(serverMembers.userId, userId)))
    .get();
  if (existing) return;

  db.insert(serverMembers).values({
    serverId: mainServerId,
    userId,
    role: 'member',
    joinedAt: Date.now(),
  }).run();
}

export function syncAllUsersToMainServer(): void {
  const mainServerId = ensureMainServer();
  if (!mainServerId) return;

  const allUsers = db.select({ id: users.id }).from(users).all();
  for (const u of allUsers) {
    const existing = db.select()
      .from(serverMembers)
      .where(and(eq(serverMembers.serverId, mainServerId), eq(serverMembers.userId, u.id)))
      .get();
    if (!existing) {
      db.insert(serverMembers).values({
        serverId: mainServerId,
        userId: u.id,
        role: 'member',
        joinedAt: Date.now(),
      }).run();
    }
  }
}

export function isMainServer(serverId: string): boolean {
  const s = db.select({ isMain: servers.isMain }).from(servers).where(eq(servers.id, serverId)).get();
  return s?.isMain === 1;
}