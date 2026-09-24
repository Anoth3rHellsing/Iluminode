import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { messages, users, channels, serverMembers, dmChannels } from '@/lib/db/schema';
import { decrypt } from '@/lib/encryption';
import { eq, and, or, like, desc, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const sessionId = parseSessionCookie(req.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const channelId = searchParams.get('channelId');
  const serverId = searchParams.get('serverId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Fetch candidate messages based on scope
    let candidateMessages: any[] = [];

    if (channelId) {
      // Search within a specific channel - verify membership
      const membership = db.select()
        .from(serverMembers)
        .innerJoin(channels, eq(channels.serverId, serverMembers.serverId))
        .where(and(
          eq(serverMembers.userId, user.id),
          eq(channels.id, channelId)
        ))
        .get();

      if (!membership) {
        return NextResponse.json({ results: [] });
      }

      candidateMessages = db.select({
        id: messages.id,
        channelId: messages.channelId,
        dmChannelId: messages.dmChannelId,
        encryptedContent: messages.encryptedContent,
        authorId: messages.authorId,
        createdAt: messages.createdAt,
      })
        .from(messages)
        .where(eq(messages.channelId, channelId))
        .orderBy(desc(messages.createdAt))
        .limit(200)
        .all();
    } else if (serverId) {
      // Search all channels in a server - verify membership
      const membership = db.select()
        .from(serverMembers)
        .where(and(
          eq(serverMembers.serverId, serverId),
          eq(serverMembers.userId, user.id)
        ))
        .get();

      if (!membership) {
        return NextResponse.json({ results: [] });
      }

      const serverChannels = db.select({ id: channels.id })
        .from(channels)
        .where(eq(channels.serverId, serverId))
        .all();

      const channelIds = serverChannels.map(c => c.id);
      if (channelIds.length === 0) {
        return NextResponse.json({ results: [] });
      }

      candidateMessages = db.select({
        id: messages.id,
        channelId: messages.channelId,
        dmChannelId: messages.dmChannelId,
        encryptedContent: messages.encryptedContent,
        authorId: messages.authorId,
        createdAt: messages.createdAt,
      })
        .from(messages)
        .where(sql`${messages.channelId} IN (${sql.join(channelIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(messages.createdAt))
        .limit(500)
        .all();
    } else {
      // Search DMs for the current user
      const userDms = db.select({ id: dmChannels.id })
        .from(dmChannels)
        .where(or(
          eq(dmChannels.user1Id, user.id),
          eq(dmChannels.user2Id, user.id)
        ))
        .all();

      const dmIds = userDms.map(d => d.id);
      if (dmIds.length === 0) {
        return NextResponse.json({ results: [] });
      }

      candidateMessages = db.select({
        id: messages.id,
        channelId: messages.channelId,
        dmChannelId: messages.dmChannelId,
        encryptedContent: messages.encryptedContent,
        authorId: messages.authorId,
        createdAt: messages.createdAt,
      })
        .from(messages)
        .where(sql`${messages.dmChannelId} IN (${sql.join(dmIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(messages.createdAt))
        .limit(300)
        .all();
    }

    // Decrypt and filter in memory (encrypted content can't be searched at DB level)
    const lowerQ = q.toLowerCase();
    const matched: any[] = [];

    for (const msg of candidateMessages) {
      if (matched.length >= limit + offset) break;

      try {
        const content = decrypt(msg.encryptedContent);
        if (content.toLowerCase().includes(lowerQ)) {
          matched.push({ ...msg, decryptedContent: content });
        }
      } catch {
        // Skip messages that fail to decrypt
      }
    }

    // Apply offset/limit after filtering
    const paged = matched.slice(offset, offset + limit);

    // Fetch author info for results
    const authorIds = [...new Set(paged.map(m => m.authorId))];
    const authors = authorIds.length > 0
      ? db.select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
          .from(users)
          .where(sql`${users.id} IN (${sql.join(authorIds.map(id => sql`${id}`), sql`, `)})`)
          .all()
      : [];

    const authorMap = new Map(authors.map(a => [a.id, a]));

    // Fetch channel names for server-wide search results
    let channelMap = new Map<string, string>();
    if (serverId && !channelId) {
      const chNames = db.select({ id: channels.id, name: channels.name })
        .from(channels)
        .where(eq(channels.serverId, serverId))
        .all();
      channelMap = new Map(chNames.map(c => [c.id, c.name]));
    }

    const results = paged.map(m => {
      const author = authorMap.get(m.authorId) || { id: m.authorId, username: 'unknown', displayName: 'Unknown', avatarUrl: null };
      // Create a snippet around the match
      const lowerContent = m.decryptedContent.toLowerCase();
      const matchIdx = lowerContent.indexOf(lowerQ);
      const snippetStart = Math.max(0, matchIdx - 40);
      const snippetEnd = Math.min(m.decryptedContent.length, matchIdx + q.length + 40);
      let snippet = m.decryptedContent.slice(snippetStart, snippetEnd);
      if (snippetStart > 0) snippet = '...' + snippet;
      if (snippetEnd < m.decryptedContent.length) snippet = snippet + '...';

      return {
        messageId: m.id,
        channelId: m.channelId,
        dmChannelId: m.dmChannelId,
        content: snippet,
        author: {
          id: author.id,
          username: author.username,
          displayName: author.displayName || author.username,
          avatarUrl: author.avatarUrl,
        },
        channelName: m.channelId ? channelMap.get(m.channelId) : undefined,
        createdAt: m.createdAt,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}