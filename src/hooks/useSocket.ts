'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const lastMessageTsRef = useRef<number>(0);

  useEffect(() => {
    if (socketRef.current?.connected) return;

    const socket = io({
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
    });

    socket.on('connect', () => {
      console.log('[Socket] Conectado');
      setConnectionState('connected');
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Error de conexión:', err.message);
      setConnectionState('reconnecting');
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    socket.on('reconnect', () => {
      console.log('[Socket] Reconectado');
      setConnectionState('connected');
      socket.emit('client_reconnected', { lastMessageTs: lastMessageTsRef.current });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinChannel = useCallback((channelId: string) => {
    socketRef.current?.emit('join_channel', channelId);
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    socketRef.current?.emit('leave_channel', channelId);
  }, []);

  const sendMessage = useCallback((channelId: string, content: string) => {
    socketRef.current?.emit('send_message', { channelId, content });
  }, []);

  const editMessage = useCallback((messageId: string, content: string) => {
    socketRef.current?.emit('edit_message', { messageId, content });
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    socketRef.current?.emit('delete_message', { messageId });
  }, []);

  const typingStart = useCallback((channelId: string) => {
    socketRef.current?.emit('typing_start', channelId);
  }, []);

  const typingStop = useCallback((channelId: string) => {
    socketRef.current?.emit('typing_stop', channelId);
  }, []);

  const updateStatus = useCallback((status: string) => {
    socketRef.current?.emit('status_update', { status });
  }, []);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  const updateLastMessageTs = useCallback((ts: number) => {
    lastMessageTsRef.current = ts;
  }, []);

  return {
    socket: socketRef,
    connectionState,
    updateLastMessageTs,
    joinChannel,
    leaveChannel,
    sendMessage,
    editMessage,
    deleteMessage,
    typingStart,
    typingStop,
    updateStatus,
    on,
  };
}