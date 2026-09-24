import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, destroySession, clearSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const sessionId = parseSessionCookie(request.headers.get('cookie'));
  if (sessionId) {
    destroySession(sessionId);
  }

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', clearSessionCookie());
  return response;
}