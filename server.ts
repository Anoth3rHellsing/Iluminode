import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { parseSessionCookie, getSessionUser } from './src/lib/auth';
import { db } from './src/lib/db';
import { messages, users, channels, serverMembers, dmChannels, reactions, serverMutes, wordFilters, friendships, groupDms, groupDmMembers } from './src/lib/db/schema';
import { encrypt, decrypt } from './src/lib/encryption';
import { ensureMainServer, syncAllUsersToMainServer } from './src/lib/mainServer';
import { eq, and, or, desc, gt } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Ensure main server exists and all users are in it
  ensureMainServer();
  syncAllUsersToMainServer();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    path: '/api/socketio',
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 25 * 1024 * 1024,
  });

  io.use(async (socket, nextFn) => {
    const cookieHeader = socket.handshake.headers.cookie as string | undefined;
    const sessionId = parseSessionCookie(cookieHeader);
    const user = await getSessionUser(sessionId);
    if (!user) return nextFn(new Error('No autenticado'));
    (socket as any).userId = user.id;
    (socket as any).username = user.username;
    (socket as any).role = user.role;
    nextFn();
  });

  // Periodic cleanup of expired mutes every 60 seconds
  setInterval(() => {
    const now = Date.now();
    db.delete(serverMutes).where(gt(serverMutes.expiresAt, now)).run();
  }, 60_000);

  // Global map of userId -> socketId for targeted emits (mentions, etc.)
  const userSockets = new Map<string, string>();

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    const username = (socket as any).username;
    const userRole = (socket as any).role;
    console.log(`[Socket] ${username} conectado`);
    userSockets.set(userId, socket.id);

    db.update(users).set({ status: 'online', updatedAt: Date.now() }).where(eq(users.id, userId)).run();

    // Join DM room
    const userDms = db.select().from(dmChannels)
      .where(or(eq(dmChannels.user1Id, userId), eq(dmChannels.user2Id, userId))).all();
    for (const dm of userDms) {
      socket.join(`dm:${dm.id}`);
    }

    socket.on('join_channel', async (channelId: string) => {
      const channel = db.select().from(channels).where(eq(channels.id, channelId)).get();
      if (!channel) return;
      const membership = db.select().from(serverMembers)
        .where(and(eq(serverMembers.serverId, channel.serverId), eq(serverMembers.userId, userId))).get();
      if (!membership && userRole !== 'admin') return;
      socket.join(`channel:${channelId}`);
    });

    socket.on('leave_channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('join_dm', (dmChannelId: string) => {
      const dm = db.select().from(dmChannels).where(eq(dmChannels.id, dmChannelId)).get();
      if (!dm) return;
      if (dm.user1Id !== userId && dm.user2Id !== userId) return;
      socket.join(`dm:${dmChannelId}`);
    });

    socket.on('send_message', async (data: {
      channelId?: string;
      dmChannelId?: string;
      content: string;
      replyToId?: string;
      attachmentUrl?: string;
      attachmentType?: string;
      attachmentName?: string;
      linkPreview?: string;
    }) => {
      const { content, replyToId, attachmentUrl, attachmentType, attachmentName, linkPreview } = data;
      const now = Date.now();
      const messageId = uuidv4();
      let encryptedContent = encrypt(content || '');

      if (data.dmChannelId) {
        const dm = db.select().from(dmChannels).where(eq(dmChannels.id, data.dmChannelId)).get();
        if (!dm) return;
        if (dm.user1Id !== userId && dm.user2Id !== userId) return;

        db.insert(messages).values({
          id: messageId,
          dmChannelId: data.dmChannelId,
          authorId: userId,
          encryptedContent,
          replyToId: replyToId || null,
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachmentType || null,
          attachmentName: attachmentName || null,
          linkPreview: linkPreview || null,
          createdAt: now,
        }).run();

        const author = db.select({
          id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
        }).from(users).where(eq(users.id, userId)).get();

        let replyTo = null;
        if (replyToId) {
          const replyMsg = db.select().from(messages).where(eq(messages.id, replyToId)).get();
          if (replyMsg) {
            const replyAuthor = db.select({
              id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
            }).from(users).where(eq(users.id, replyMsg.authorId)).get();
            try {
              replyTo = { id: replyMsg.id, content: decrypt(replyMsg.encryptedContent), author: replyAuthor };
            } catch { /* skip */ }
          }
        }

        io.to(`dm:${data.dmChannelId}`).emit('new_message', {
          id: messageId,
          dmChannelId: data.dmChannelId,
          content: content || '',
          author,
          replyTo,
          attachmentUrl,
          attachmentType,
          attachmentName,
          linkPreview: linkPreview ? JSON.parse(linkPreview) : null,
          reactions: [],
          createdAt: now,
        });
      } else if (data.channelId) {
        const channel = db.select().from(channels).where(eq(channels.id, data.channelId)).get();
        if (!channel) return;
        const membership = db.select().from(serverMembers)
          .where(and(eq(serverMembers.serverId, channel.serverId), eq(serverMembers.userId, userId))).get();
        if (!membership && userRole !== 'admin') return;

        // Check if user is muted in this server
        const activeMute = db.select().from(serverMutes)
          .where(and(eq(serverMutes.serverId, channel.serverId), eq(serverMutes.userId, userId)))
          .get();
        if (activeMute && activeMute.expiresAt > Date.now()) {
          socket.emit('mute_blocked', { expiresAt: activeMute.expiresAt, reason: activeMute.reason });
          return;
        }

        // Apply word filter for channel messages
        let filteredContent = content || '';
        if (filteredContent) {
          const filters = db.select().from(wordFilters)
            .where(eq(wordFilters.serverId, channel.serverId))
            .all();
          for (const f of filters) {
            const regex = new RegExp(f.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            filteredContent = filteredContent.replace(regex, '*'.repeat(f.word.length));
          }
          encryptedContent = encrypt(filteredContent);
        }

        db.insert(messages).values({
          id: messageId,
          channelId: data.channelId,
          authorId: userId,
          encryptedContent,
          replyToId: replyToId || null,
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachmentType || null,
          attachmentName: attachmentName || null,
          linkPreview: linkPreview || null,
          createdAt: now,
        }).run();

        const author = db.select({
          id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
        }).from(users).where(eq(users.id, userId)).get();

        let replyTo = null;
        if (replyToId) {
          const replyMsg = db.select().from(messages).where(eq(messages.id, replyToId)).get();
          if (replyMsg) {
            const replyAuthor = db.select({
              id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
            }).from(users).where(eq(users.id, replyMsg.authorId)).get();
            try {
              replyTo = { id: replyMsg.id, content: decrypt(replyMsg.encryptedContent), author: replyAuthor };
            } catch { /* skip */ }
          }
        }

        io.to(`channel:${data.channelId}`).emit('new_message', {
          id: messageId,
          channelId: data.channelId,
          content: content || '',
          author,
          replyTo,
          attachmentUrl,
          attachmentType,
          attachmentName,
          linkPreview: linkPreview ? JSON.parse(linkPreview) : null,
          reactions: [],
          createdAt: now,
        });
      }
    });

    socket.on('edit_message', async (data: { messageId: string; content: string }) => {
      const { messageId, content } = data;
      const message = db.select().from(messages).where(eq(messages.id, messageId)).get();
      if (!message) return;
      if (message.authorId !== userId) return;

      const encryptedContent = encrypt(content);
      const now = Date.now();
      db.update(messages).set({ encryptedContent, editedAt: now }).where(eq(messages.id, messageId)).run();

      if (message.channelId) {
        io.to(`channel:${message.channelId}`).emit('message_edited', { id: messageId, content, editedAt: now });
      }
      if (message.dmChannelId) {
        io.to(`dm:${message.dmChannelId}`).emit('message_edited', { id: messageId, content, editedAt: now });
      }
    });

    socket.on('delete_message', async (data: { messageId: string }) => {
      const { messageId } = data;
      const message = db.select().from(messages).where(eq(messages.id, messageId)).get();
      if (!message) return;
      if (message.authorId !== userId && userRole !== 'admin') return;

      db.delete(reactions).where(eq(reactions.messageId, messageId)).run();
      db.delete(messages).where(eq(messages.id, messageId)).run();

      if (message.channelId) {
        io.to(`channel:${message.channelId}`).emit('message_deleted', { id: messageId });
      }
      if (message.dmChannelId) {
        io.to(`dm:${message.dmChannelId}`).emit('message_deleted', { id: messageId });
      }
    });

    socket.on('add_reaction', async (data: { messageId: string; emoji: string }) => {
      const { messageId, emoji } = data;
      const message = db.select().from(messages).where(eq(messages.id, messageId)).get();
      if (!message) return;

      const existing = db.select().from(reactions)
        .where(and(eq(reactions.messageId, messageId), eq(reactions.userId, userId), eq(reactions.emoji, emoji))).get();

      if (existing) {
        db.delete(reactions).where(eq(reactions.id, existing.id)).run();
        const room = message.channelId ? `channel:${message.channelId}` : message.dmChannelId ? `dm:${message.dmChannelId}` : null;
        if (room) io.to(room).emit('reaction_removed', { messageId, userId, emoji });
      } else {
        db.insert(reactions).values({
          id: uuidv4(), messageId, userId, emoji, createdAt: Date.now(),
        }).run();
        const room = message.channelId ? `channel:${message.channelId}` : message.dmChannelId ? `dm:${message.dmChannelId}` : null;
        if (room) io.to(room).emit('reaction_added', { messageId, userId, emoji });
      }
    });

    socket.on('typing_start', (roomId: string) => {
      const room = roomId.startsWith('dm:') ? roomId : `channel:${roomId}`;
      socket.to(room).emit('user_typing', { userId, username, roomId, isTyping: true });
    });

    socket.on('typing_stop', (roomId: string) => {
      const room = roomId.startsWith('dm:') ? roomId : `channel:${roomId}`;
      socket.to(room).emit('user_typing', { userId, username, roomId, isTyping: false });
    });

    socket.on('status_update', async (data: { status: string }) => {
      const validStatuses = ['online', 'away', 'dnd', 'offline'] as const;
      type ValidStatus = typeof validStatuses[number];
      if (!validStatuses.includes(data.status as ValidStatus)) return;
      db.update(users).set({ status: data.status as ValidStatus, updatedAt: Date.now() }).where(eq(users.id, userId)).run();

      const memberships = db.select({ serverId: serverMembers.serverId }).from(serverMembers).where(eq(serverMembers.userId, userId)).all();
      for (const m of memberships) {
        io.to(`server:${m.serverId}`).emit('member_status_update', { userId, status: data.status });
      }
      io.emit('user_status_update', { userId, status: data.status });
    });

    // --- Voice/Video signaling ---
    const voiceRooms = new Map<string, Set<string>>(); // room -> set of userIds
    const voiceSockets = new Map<string, string>(); // userId -> socketId

    socket.on('voice_join', (data: { room: string; roomType: string }) => {
      const { room } = data;
      if (!voiceRooms.has(room)) voiceRooms.set(room, new Set());
      const roomUsers = voiceRooms.get(room)!;

      // Notify existing users about the new joiner
      const selfUser = db.select({
        id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
      }).from(users).where(eq(users.id, userId)).get();

      for (const existingUserId of roomUsers) {
        const existingSocketId = voiceSockets.get(existingUserId);
        if (existingSocketId) {
          io.to(existingSocketId).emit('voice_user_joined', {
            userId, username, displayName: selfUser?.displayName || username, avatarUrl: selfUser?.avatarUrl || null,
          });
        }
      }

      // Notify all existing users to the new joiner
      for (const existingUserId of roomUsers) {
        const eu = db.select({
          id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
        }).from(users).where(eq(users.id, existingUserId)).get();
        if (eu) {
          socket.emit('voice_user_joined', {
            userId: eu.id, username: eu.username, displayName: eu.displayName, avatarUrl: eu.avatarUrl,
          });
        }
      }

      roomUsers.add(userId);
      voiceSockets.set(userId, socket.id);
      socket.join(`voice:${room}`);
    });

    socket.on('voice_leave', (data: { room: string }) => {
      const { room } = data;
      const roomUsers = voiceRooms.get(room);
      if (roomUsers) {
        roomUsers.delete(userId);
        if (roomUsers.size === 0) voiceRooms.delete(room);
      }
      voiceSockets.delete(userId);
      socket.leave(`voice:${room}`);
      socket.to(`voice:${room}`).emit('voice_user_left', { userId });
    });

    socket.on('voice_offer', (data: { targetUserId: string; offer: any; room: string }) => {
      const targetSocketId = voiceSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('voice_offer', { fromUserId: userId, offer: data.offer });
      }
    });

    socket.on('voice_answer', (data: { targetUserId: string; answer: any; room: string }) => {
      const targetSocketId = voiceSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('voice_answer', { fromUserId: userId, answer: data.answer });
      }
    });

    socket.on('voice_ice_candidate', (data: { targetUserId: string; candidate: any; room: string }) => {
      const targetSocketId = voiceSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('voice_ice_candidate', { fromUserId: userId, candidate: data.candidate });
      }
    });

    socket.on('voice_speaking', (data: { room: string; isSpeaking: boolean }) => {
      socket.to(`voice:${data.room}`).emit('voice_speaking_update', { userId, isSpeaking: data.isSpeaking });
    });

    socket.on('voice_mute', (data: { room: string; isMuted: boolean }) => {
      socket.to(`voice:${data.room}`).emit('voice_mute_update', { userId, isMuted: data.isMuted });
    });

    socket.on('voice_video', (data: { room: string; isVideoOff: boolean }) => {
      socket.to(`voice:${data.room}`).emit('voice_video_update', { userId, isVideoOff: data.isVideoOff });
    });

    socket.on('voice_screen', (data: { room: string; isScreenSharing: boolean }) => {
      socket.to(`voice:${data.room}`).emit('voice_screen_update', { userId, isScreenSharing: data.isScreenSharing });
    });

    socket.on('voice_call', (data: { targetUserId: string; dmChannelId: string }) => {
      const targetSocketId = voiceSockets.get(data.targetUserId) || (() => {
        // Find socket for target user
        for (const [uid, sid] of voiceSockets.entries()) {
          if (uid === data.targetUserId) return sid;
        }
        // Try to find any socket for this user
        return null;
      })();
      const selfUser = db.select({
        id: users.id, username: users.username, displayName: users.displayName,
      }).from(users).where(eq(users.id, userId)).get();
      // Broadcast to all sockets of the target user
      io.emit('voice_incoming_call_check', { targetUserId: data.targetUserId, fromUserId: userId, fromUsername: selfUser?.username || username, fromDisplayName: selfUser?.displayName || username, dmChannelId: data.dmChannelId });
    });

    socket.on('voice_accept', (data: { targetUserId: string; dmChannelId: string }) => {
      // The caller joins the DM voice room
      const room = `dm:${data.dmChannelId}`;
      if (!voiceRooms.has(room)) voiceRooms.set(room, new Set());
      voiceRooms.get(room)!.add(userId);
      voiceSockets.set(userId, socket.id);
      socket.join(`voice:${room}`);
    });

    socket.on('voice_reject', (data: { targetUserId: string; dmChannelId: string }) => {
      const targetSocketId = voiceSockets.get(data.targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('voice_call_rejected', {});
      }
    });

    socket.on('client_reconnected', async (data: { lastMessageTs: number }) => {
      const lastTs = data?.lastMessageTs || 0;
      console.log(`[Socket] ${username} reconectado, resync desde ${lastTs}`);

      // Re-sync voice room state if user was in a voice call
      for (const [room, roomUsers] of voiceRooms.entries()) {
        if (roomUsers.has(userId)) {
          socket.join(`voice:${room}`);
          voiceSockets.set(userId, socket.id);
          // Notify others that this user reconnected
          socket.to(`voice:${room}`).emit('voice_user_joined', {
            userId,
            username,
            displayName: (socket as any).displayName || username,
            avatarUrl: null,
          });
        }
      }

      // Find missed messages in channels the user is in
      try {
        const userChannels = db.select({ channelId: channels.id }).from(channels)
          .innerJoin(serverMembers, eq(serverMembers.serverId, channels.serverId))
          .where(eq(serverMembers.userId, userId)).all();

        const channelIds = userChannels.map(c => c.channelId);
        const missedChannelMessages: any[] = [];

        if (channelIds.length > 0) {
          for (const chId of channelIds) {
            const msgs = db.select().from(messages)
              .where(and(eq(messages.channelId, chId), gt(messages.createdAt, lastTs)))
              .orderBy(desc(messages.createdAt))
              .limit(50)
              .all();
            for (const msg of msgs) {
              const author = db.select({
                id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
              }).from(users).where(eq(users.id, msg.authorId)).get();
              missedChannelMessages.push({
                ...msg,
                content: decrypt(msg.encryptedContent),
                author: author || { id: msg.authorId, username: 'unknown', displayName: 'Unknown', avatarUrl: null },
                reactions: [],
              });
            }
          }
        }

        // Find missed DM messages
        const userDmsForResync = db.select().from(dmChannels)
          .where(or(eq(dmChannels.user1Id, userId), eq(dmChannels.user2Id, userId))).all();
        const missedDmMessages: any[] = [];

        for (const dm of userDmsForResync) {
          const msgs = db.select().from(messages)
            .where(and(eq(messages.dmChannelId, dm.id), gt(messages.createdAt, lastTs)))
            .orderBy(desc(messages.createdAt))
            .limit(50)
            .all();
          for (const msg of msgs) {
            const author = db.select({
              id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
            }).from(users).where(eq(users.id, msg.authorId)).get();
            missedDmMessages.push({
              ...msg,
              content: decrypt(msg.encryptedContent),
              author: author || { id: msg.authorId, username: 'unknown', displayName: 'Unknown', avatarUrl: null },
              reactions: [],
            });
          }
        }

        const allMissed = [...missedChannelMessages, ...missedDmMessages];
        if (allMissed.length > 0) {
          socket.emit('missed_messages', { messages: allMissed });
          console.log(`[Socket] Enviados ${allMissed.length} mensajes perdidos a ${username}`);
        }
      } catch (err) {
        console.error('[Socket] Error en resync:', err);
      }
    });

    // Custom status update
    socket.on('custom_status_update', (data: { customStatus?: string; customStatusEmoji?: string }) => {
      const updates: Record<string, any> = { updatedAt: Date.now() };
      if (data.customStatus !== undefined) updates.customStatus = (data.customStatus || '').slice(0, 100) || null;
      if (data.customStatusEmoji !== undefined) updates.customStatusEmoji = data.customStatusEmoji || null;
      db.update(users).set(updates).where(eq(users.id, userId)).run();
      io.emit('user_custom_status', {
        userId,
        customStatus: updates.customStatus ?? null,
        customStatusEmoji: updates.customStatusEmoji ?? null,
      });
    });

    // Group DM: join room
    socket.on('join_group_dm', (groupId: string) => {
      const membership = db.select().from(groupDmMembers)
        .where(and(eq(groupDmMembers.groupDmId, groupId), eq(groupDmMembers.userId, userId)))
        .get();
      if (membership) {
        socket.join(`group_dm:${groupId}`);
      }
    });

    // Group DM: leave room
    socket.on('leave_group_dm', (groupId: string) => {
      socket.leave(`group_dm:${groupId}`);
    });

    // Group DM: send message
    socket.on('send_group_message', async (data: { groupDmId: string; content: string; replyToId?: string; attachmentUrl?: string; attachmentType?: string; attachmentName?: string }) => {
      try {
        const membership = db.select().from(groupDmMembers)
          .where(and(eq(groupDmMembers.groupDmId, data.groupDmId), eq(groupDmMembers.userId, userId)))
          .get();
        if (!membership) return;

        const msgId = crypto.randomUUID();
        const encryptedContent = encrypt(data.content || '');
        const now = Date.now();

        db.insert(messages).values({
          id: msgId,
          groupDmId: data.groupDmId,
          authorId: userId,
          encryptedContent,
          replyToId: data.replyToId || null,
          attachmentUrl: data.attachmentUrl || null,
          attachmentType: data.attachmentType || null,
          attachmentName: data.attachmentName || null,
          createdAt: now,
        }).run();

        const author = db.select({
          id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl,
        }).from(users).where(eq(users.id, userId)).get();

        const msgPayload = {
          id: msgId,
          groupDmId: data.groupDmId,
          content: data.content || '',
          author: author || { id: userId, username: 'unknown', displayName: 'Unknown', avatarUrl: null },
          replyToId: data.replyToId || null,
          attachmentUrl: data.attachmentUrl || null,
          attachmentType: data.attachmentType || null,
          attachmentName: data.attachmentName || null,
          reactions: [],
          editedAt: null,
          createdAt: now,
        };

        io.to(`group_dm:${data.groupDmId}`).emit('new_message', msgPayload);

        // Check for @mentions
        const mentionMatches = (data.content || '').match(/@(\w+)/g);
        if (mentionMatches) {
          const mentionedUsernames = [...new Set(mentionMatches.map(m => m.slice(1)))];
          const members = db.select({ userId: groupDmMembers.userId }).from(groupDmMembers)
            .where(eq(groupDmMembers.groupDmId, data.groupDmId)).all();
          for (const member of members) {
            if (member.userId === userId) continue;
            const memberUser = db.select({ username: users.username }).from(users).where(eq(users.id, member.userId)).get();
            if (memberUser && mentionedUsernames.includes(memberUser.username)) {
              io.to(userSockets.get(member.userId) || '').emit('user_mentioned', { messageId: msgId, groupDmId: data.groupDmId, fromUser: author });
            }
          }
        }
      } catch (err) {
        console.error('[Socket] Error sending group message:', err);
      }
    });

    socket.on('disconnect', () => {
      userSockets.delete(userId);
      db.update(users).set({ status: 'offline', updatedAt: Date.now() }).where(eq(users.id, userId)).run();
      // Clean up voice rooms
      for (const [room, roomUsers] of voiceRooms.entries()) {
        if (roomUsers.has(userId)) {
          roomUsers.delete(userId);
          socket.to(`voice:${room}`).emit('voice_user_left', { userId });
          if (roomUsers.size === 0) voiceRooms.delete(room);
        }
      }
      voiceSockets.delete(userId);
      console.log(`[Socket] ${username} desconectado`);
    });
  });

  server.listen(port, () => {
    console.log(`> Iluminode corriendo en http://localhost:${port}`);
  });
});