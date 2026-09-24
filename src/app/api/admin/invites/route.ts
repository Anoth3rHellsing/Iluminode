import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inviteCodes } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const code = crypto.randomBytes(6).toString('hex').toUpperCase();
  const now = Date.now();

  db.insert(inviteCodes).values({
    code,
    createdBy: user.id,
    createdAt: now,
  }).run();

  return NextResponse.json({ code }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const codes = db.select().from(inviteCodes).all();
  return NextResponse.json({ invites: codes });
}