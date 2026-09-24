import { NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { messages, users, groupDmMembers, reactions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';
import { cookies } from 'next/headers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const sessionId = parseSessionCookie(cookieStore.toString());
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  // Verify membership
  const membership = db.select().from(groupDmMembers)
    .where(and(eq(groupDmMembers.groupDmId, id), eq(groupDmMembers.userId, user.id)))
    .get();
  if (!membership) return NextResponse.json({ error: 'No eres miembro de este grupo' }, { status: 403 });

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

  const rows = db.select({
    id: messages.id,
    groupDmId: messages.groupDmId,
    authorId: messages.authorId,
    encryptedContent: messages.encryptedContent,
    replyToId: messages.replyToId,
    attachmentUrl: messages.attachmentUrl,
    attachmentType: messages.attachmentType,
    attachmentName: messages.attachmentName,
    linkPreview: messages.linkPreview,
    editedAt: messages.editedAt,
    createdAt: messages.createdAt,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  }).from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(eq(messages.groupDmId, id))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all();

  const result = [];
  for (const row of rows.reverse()) {
    let content = '';
    try { content = decrypt(row.encryptedContent); } catch { /* skip */ }

    const msgReactions = db.select({
      emoji: reactions.emoji,
      userId: reactions.userId,
    }).from(reactions).where(eq(reactions.messageId, row.id)).all();

    const reactionMap = new Map<string, string[]>();
    for (const r of msgReactions) {
      if (!reactionMap.has(r.emoji)) reactionMap.set(r.emoji, []);
      reactionMap.get(r.emoji)!.push(r.userId);
    }

    result.push({
      id: row.id,
      groupDmId: row.groupDmId,
      content,
      author: { id: row.authorId, username: row.username, displayName: row.displayName, avatarUrl: row.avatarUrl },
      replyToId: row.replyToId,
      attachmentUrl: row.attachmentUrl,
      attachmentType: row.attachmentType,
      attachmentName: row.attachmentName,
      linkPreview: row.linkPreview ? JSON.parse(row.linkPreview) : null,
      reactions: Array.from(reactionMap.entries()).map(([emoji, userIds]) => ({ emoji, userIds })),
      editedAt: row.editedAt,
      createdAt: row.createdAt,
    });
  }

  return NextResponse.json({ messages: result });
}