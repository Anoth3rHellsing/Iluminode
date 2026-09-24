import { db } from './db';
import { auditLogs } from './db/schema';
import { v4 as uuidv4 } from 'uuid';

export function logAudit(
  serverId: string,
  actorId: string,
  action: string,
  targetId?: string,
  details?: object
) {
  db.insert(auditLogs).values({
    id: uuidv4(),
    serverId,
    actorId,
    action,
    targetId: targetId || null,
    details: details ? JSON.stringify(details) : null,
    createdAt: Date.now(),
  }).run();
}