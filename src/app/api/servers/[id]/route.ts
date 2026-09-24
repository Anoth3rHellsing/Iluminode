import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { servers, serverMembers, channels, channelMembers, messages, reactions, serverInvites } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const cookie = req.headers.get('cookie');
  const sessionId = parseSessionCookie(cookie);
  const user = await getSessionUser(sessionId);

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const serverId = params.id;

  const server = db.select().from(servers).where(eq(servers.id, serverId)).get();
  if (!server) {
    return NextResponse.json({ error: 'Servidor no encontrado' }, { status: 404 });
  }

  if (server.isMain === 1) {
    return NextResponse.json({ error: 'El servidor principal no puede eliminarse' }, { status: 403 });
  }

  if (server.ownerId !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'No tienes permiso para eliminar este servidor' }, { status: 403 });
  }

  // Get all channel IDs for this server
  const serverChannels = db.select({ id: channels.id }).from(channels).where(eq(channels.serverId, serverId)).all();
  const channelIds = serverChannels.map(c => c.id);

  if (channelIds.length > 0) {
    // Delete reactions for messages in server channels
    db.delete(reactions)
      .where(inArray(reactions.messageId,
        db.select({ id: messages.id }).from(messages).where(inArray(messages.channelId, channelIds)).all().map(m => m.id)
      ))
      .run();

    // Delete messages in server channels
    db.delete(messages).where(inArray(messages.channelId, channelIds)).run();

    // Delete channel members for server channels
    db.delete(channelMembers).where(inArray(channelMembers.channelId, channelIds)).run();
  }

  // Delete channels
  db.delete(channels).where(eq(channels.serverId, serverId)).run();

  // Delete server members
  db.delete(serverMembers).where(eq(serverMembers.serverId, serverId)).run();

  // Delete server invites
  db.delete(serverInvites).where(eq(serverInvites.serverId, serverId)).run();

  // Delete the server itself
  db.delete(servers).where(eq(servers.id, serverId)).run();

  return NextResponse.json({ success: true });
}