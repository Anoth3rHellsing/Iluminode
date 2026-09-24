import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { messages, channels, serverMembers, users, reactions } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';
import { eq, and, desc, lt } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const channelId = params.id;
  const url = new URL(request.url);
  const before = url.searchParams.get('before');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

  const channel = db.select().from(channels).where(eq(channels.id, channelId)).get();
  if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });

  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, channel.serverId), eq(serverMembers.userId, user.id))).get();
  if (!membership && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes acceso a este canal' }, { status: 403 });
  }

  let rawMessages;
  if (before) {
    const beforeTs = parseInt(before, 10);
    rawMessages = db.select().from(messages)
      .where(and(eq(messages.channelId, channelId), lt(messages.createdAt, beforeTs)))
      .orderBy(desc(messages.createdAt)).limit(limit).all();
  } else {
    rawMessages = db.select().from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt)).limit(limit).all();
  }

  const decryptedMessages = [];
  for (const msg of rawMessages) {
    const author = db.select({
      id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
    }).from(users).where(eq(users.id, msg.authorId)).get();

    const msgReactions = db.select().from(reactions).where(eq(reactions.messageId, msg.id)).all();
    const groupedReactions: Record<string, { emoji: string; userIds: string[] }> = {};
    for (const r of msgReactions) {
      if (!groupedReactions[r.emoji]) groupedReactions[r.emoji] = { emoji: r.emoji, userIds: [] };
      groupedReactions[r.emoji].userIds.push(r.userId);
    }

    let replyTo = null;
    if (msg.replyToId) {
      const replyMsg = db.select().from(messages).where(eq(messages.id, msg.replyToId)).get();
      if (replyMsg) {
        const replyAuthor = db.select({
          id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
        }).from(users).where(eq(users.id, replyMsg.authorId)).get();
        try {
          replyTo = {
            id: replyMsg.id,
            content: decrypt(replyMsg.encryptedContent),
            author: replyAuthor,
          };
        } catch { /* skip */ }
      }
    }

    try {
      const content = decrypt(msg.encryptedContent);
      decryptedMessages.push({
        id: msg.id,
        channelId: msg.channelId,
        content,
        author,
        replyTo,
        attachmentUrl: msg.attachmentUrl,
        attachmentType: msg.attachmentType,
        attachmentName: msg.attachmentName,
        linkPreview: msg.linkPreview ? JSON.parse(msg.linkPreview) : null,
        reactions: Object.values(groupedReactions),
        editedAt: msg.editedAt,
        createdAt: msg.createdAt,
      });
    } catch { continue; }
  }

  decryptedMessages.reverse();
  return NextResponse.json({ messages: decryptedMessages });
}