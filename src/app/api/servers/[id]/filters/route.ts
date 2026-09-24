import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { wordFilters, serverMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieHeader = request.headers.get('cookie');
  const sessionId = parseSessionCookie(cookieHeader);
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const serverId = params.id;

  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, user.id)))
    .get();
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
  }

  const filters = db.select().from(wordFilters)
    .where(eq(wordFilters.serverId, serverId))
    .all();

  return NextResponse.json({ filters });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieHeader = request.headers.get('cookie');
  const sessionId = parseSessionCookie(cookieHeader);
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const serverId = params.id;

  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, user.id)))
    .get();
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
  }

  const body = await request.json();
  const { word } = body as { word: string };

  if (!word || !word.trim()) {
    return NextResponse.json({ error: 'Palabra requerida' }, { status: 400 });
  }

  const normalizedWord = word.trim().toLowerCase();

  // Check for duplicate
  const existing = db.select().from(wordFilters)
    .where(and(eq(wordFilters.serverId, serverId), eq(wordFilters.word, normalizedWord)))
    .get();
  if (existing) {
    return NextResponse.json({ error: 'La palabra ya está en el filtro' }, { status: 409 });
  }

  const now = Date.now();
  const id = uuidv4();

  db.insert(wordFilters).values({
    id,
    serverId,
    word: normalizedWord,
    addedBy: user.id,
    createdAt: now,
  }).run();

  return NextResponse.json({ success: true, id, word: normalizedWord });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieHeader = request.headers.get('cookie');
  const sessionId = parseSessionCookie(cookieHeader);
  const user = await getSessionUser(sessionId);
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const serverId = params.id;

  const membership = db.select().from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, user.id)))
    .get();
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
  }

  const url = new URL(request.url);
  const word = url.searchParams.get('word');

  if (!word) {
    return NextResponse.json({ error: 'Parámetro word requerido' }, { status: 400 });
  }

  const normalizedWord = word.trim().toLowerCase();

  const existing = db.select().from(wordFilters)
    .where(and(eq(wordFilters.serverId, serverId), eq(wordFilters.word, normalizedWord)))
    .get();

  if (!existing) {
    return NextResponse.json({ error: 'Palabra no encontrada en el filtro' }, { status: 404 });
  }

  db.delete(wordFilters).where(eq(wordFilters.id, existing.id)).run();

  return NextResponse.json({ success: true });
}