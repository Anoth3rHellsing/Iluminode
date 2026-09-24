import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { messages, dmChannels, users, reactions } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { decrypt } from '@/lib/encryption';
import { eq, and, or, desc, lt } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const dm = db.select().from(dmChannels).where(eq(dmChannels.id, params.id)).get();
  if (!dm) return NextResponse.json({ error: 'DM no encontrado' }, { status: 404 });
  if (dm.user1Id !== user.id && dm.user2Id !== user.id) {
    return NextResponse.json({ error: 'No tienes acceso' }, { status: 403 });
  }

  const url = new URL(request.url);
  const before = url.searchParams.get('before');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

  let rawMessages;
  if (before) {
    const beforeTs = parseInt(before, 10);
    rawMessages = db.select().from(messages)
      .where(and(eq(messages.dmChannelId, params.id), lt(messages.createdAt, beforeTs)))
      .orderBy(desc(messages.createdAt)).limit(limit).all();
  } else {
    rawMessages = db.select().from(messages)
      .where(eq(messages.dmChannelId, params.id))
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

    try {
      const content = decrypt(msg.encryptedContent);
      decryptedMessages.push({
        id: msg.id,
        dmChannelId: msg.dmChannelId,
        content,
        author,
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