import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inviteCodes } from '@/lib/db/schema';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  const user = await getSessionUser(sessionId);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const invite = db.select().from(inviteCodes).where(eq(inviteCodes.code, params.code)).get();
  if (!invite) {
    return NextResponse.json({ error: 'Código no encontrado' }, { status: 404 });
  }

  db.update(inviteCodes)
    .set({ revoked: 1 })
    .where(eq(inviteCodes.code, params.code))
    .run();

  return NextResponse.json({ success: true });
}