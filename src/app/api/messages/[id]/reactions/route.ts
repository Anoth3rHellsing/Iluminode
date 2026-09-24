import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reactions, messages, channels, serverMembers, dmChannels } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { addReactionSchema } from '@/lib/validators';
import { v4 as uuidv4 } from 'uuid';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const message = db.select().from(messages).where(eq(messages.id, params.id)).get();
  if (!message) return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });

  try {
    const body = await request.json();
    const parsed = addReactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const existing = db.select().from(reactions)
      .where(and(
        eq(reactions.messageId, params.id),
        eq(reactions.userId, user.id),
        eq(reactions.emoji, parsed.data.emoji)
      )).get();

    if (existing) {
      db.delete(reactions).where(eq(reactions.id, existing.id)).run();
      return NextResponse.json({ removed: true, emoji: parsed.data.emoji });
    }

    db.insert(reactions).values({
      id: uuidv4(),
      messageId: params.id,
      userId: user.id,
      emoji: parsed.data.emoji,
      createdAt: Date.now(),
    }).run();

    return NextResponse.json({ added: true, emoji: parsed.data.emoji }, { status: 201 });
  } catch (error) {
    console.error('Reaction error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const msgReactions = db.select().from(reactions).where(eq(reactions.messageId, params.id)).all();
  const grouped: Record<string, { emoji: string; userIds: string[] }> = {};
  for (const r of msgReactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, userIds: [] };
    grouped[r.emoji].userIds.push(r.userId);
  }

  return NextResponse.json({ reactions: Object.values(grouped) });
}