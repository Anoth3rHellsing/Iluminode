'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { AdminPanel } from '@/components/admin/AdminPanel';
import { MemberList } from '@/components/members/MemberList';
import { CreateChannelModal } from '@/components/ui/CreateChannelModal';
import { CreateServerModal } from '@/components/ui/CreateServerModal';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { useVoiceCall, VoiceParticipant, IncomingCall } from '@/hooks/useVoiceCall';
import { ClipsPanel } from '@/components/clips/ClipsPanel';
import { StoriesBar, StoryGroup } from '@/components/stories/StoriesBar';
import { StoriesViewer } from '@/components/stories/StoriesViewer';
import { CreateStoryButton } from '@/components/stories/CreateStoryButton';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { FriendsPanel } from '@/components/friends/FriendsPanel';

interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  isMain: number;
  memberRole: string;
}

interface Channel {
  id: string;
  name: string;
  serverId: string;
  type: string;
  gradient: string | null;
  imageUrl: string | null;
  isPrivate: number;
}

interface MessageAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Message {
  id: string;
  channelId?: string;
  dmChannelId?: string;
  content: string;
  author: MessageAuthor;
  replyTo?: { id: string; content: string; author: MessageAuthor } | null;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
  linkPreview?: { url: string; title: string; description: string; image: string | null } | null;
  reactions: { emoji: string; userIds: string[] }[];
  editedAt: number | null;
  createdAt: number;
}

interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  role: string;
  status: string;
}

interface DmChannel {
  id: string;
  otherUser: { id: string; username: string; displayName: string; avatarUrl: string | null; status: string };
  lastMessage: { content: string; createdAt: number } | null;
}

type ViewMode = { type: 'channel'; serverId: string; channelId: string } | { type: 'dm'; dmId: string; serverId?: string; channelId?: string };

const EMOJI_LIST = ['+1', '<3', ':D', ':)', ':(', ':P', ';)', '100', ':O', 'B)', '[v]', '*'];

export default function DashboardPage() {
  const { joinChannel, leaveChannel, sendMessage, editMessage, deleteMessage, on, socket, connectionState, updateLastMessageTs } = useSocket();
  const [user, setUser] = useState<User | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dms, setDms] = useState<DmChannel[]>([]);
  const [view, setView] = useState<ViewMode | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deletingServer, setDeletingServer] = useState(false);
  const [showClips, setShowClips] = useState(false);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [showStoriesViewer, setShowStoriesViewer] = useState<string | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'servers' | 'channels' | 'chat' | 'members'>('chat');
  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Edit message modal state
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  // Custom confirm modal state
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  // Friends panel state
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  // Group DMs state
  const [groupDms, setGroupDms] = useState<any[]>([]);
  const [activeGroupDmId, setActiveGroupDmId] = useState<string | null>(null);
  const [groupMessages, setGroupMessages] = useState<Message[]>([]);
  // @mentions autocomplete state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  // Moderation state
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [reportModal, setReportModal] = useState<{ messageId: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const { toast } = useToast();
  const voice = useVoiceCall(socket, (msg) => toast(msg, 'error'));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect mobile screen size
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: searchQuery, limit: '20' });
        if (view?.type === 'channel') {
          params.set('channelId', view.channelId);
          params.set('serverId', view.serverId);
        }
        const res = await fetch(`/api/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, view]);

  // Load user, servers, DMs on mount
  useEffect(() => {
    async function init() {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) { const d = await meRes.json(); setUser(d.user); }
      const srvRes = await fetch('/api/servers');
      if (srvRes.ok) {
        const d = await srvRes.json();
        setServers(d.servers);
        if (d.servers.length > 0) {
          const first = d.servers[0];
          const chRes = await fetch(`/api/servers/${first.id}/channels`);
          if (chRes.ok) {
            const ch = await chRes.json();
            setChannels(ch.channels);
            if (ch.channels.length > 0) setView({ type: 'channel', serverId: first.id, channelId: ch.channels[0].id });
          }
        }
      }
      const dmRes = await fetch('/api/dm');
      if (dmRes.ok) { const d = await dmRes.json(); setDms(d.dms); }
      const storiesRes = await fetch('/api/stories');
      if (storiesRes.ok) { const sd = await storiesRes.json(); setStories(sd.stories || []); }
      // Load group DMs
      const gdmRes = await fetch('/api/group-dm');
      if (gdmRes.ok) { const gd = await gdmRes.json(); setGroupDms(gd.groups || []); }
    }
    init();
  }, []);

  // Socket listeners for custom status, mentions, and group DM messages
  useEffect(() => {
    if (!socket) return;
    const handleCustomStatus = (data: { userId: string; customStatus: string | null; customStatusEmoji: string | null }) => {
      // Custom status updates are handled by MemberList component re-fetching
    };
    const handleMentioned = (data: { messageId: string; groupDmId?: string; fromUser?: any }) => {
      toast(`Fuiste mencionado por ${data.fromUser?.displayName || data.fromUser?.username || 'alguien'}`, 'info');
    };
    const handleNewMessage = (msg: any) => {
      if (msg.groupDmId && msg.groupDmId === activeGroupDmId) {
        setGroupMessages(prev => [...prev, msg]);
      }
    };
    const handleMuteBlocked = (data: { expiresAt: number; reason?: string }) => {
      setMutedUntil(data.expiresAt);
      toast(`Estás silenciado — no puedes enviar mensajes hasta ${new Date(data.expiresAt).toLocaleTimeString('es-ES')}`, 'error');
    };
    socket.current?.on('user_custom_status', handleCustomStatus);
    socket.current?.on('user_mentioned', handleMentioned);
    socket.current?.on('new_message', handleNewMessage);
    socket.current?.on('mute_blocked', handleMuteBlocked);
    return () => {
      socket.current?.off('user_custom_status', handleCustomStatus);
      socket.current?.off('user_mentioned', handleMentioned);
      socket.current?.off('new_message', handleNewMessage);
      socket.current?.off('mute_blocked', handleMuteBlocked);
    };
  }, [socket, activeGroupDmId, toast]);

  // @mention detection in message input
  useEffect(() => {
    const match = inputValue.match(/@(\w*)$/);
    if (match) {
      const query = match[1];
      setMentionQuery(query);
      setShowMentionDropdown(true);
      // Fetch members for autocomplete from current server
      if (view?.type === 'channel' && view.serverId) {
        fetch(`/api/servers/${view.serverId}/members`).then(r => r.ok ? r.json() : { members: [] }).then(data => {
          const memberList = data.members || [];
          if (query.length >= 1) {
            const filtered = memberList.filter((m: any) =>
              (m.username || '').toLowerCase().includes(query.toLowerCase()) ||
              (m.displayName || '').toLowerCase().includes(query.toLowerCase())
            ).slice(0, 8);
            setMentionResults(filtered);
          } else {
            setMentionResults(memberList.slice(0, 8));
          }
        }).catch(() => setMentionResults([]));
      } else {
        setMentionResults([]);
      }
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
      setMentionResults([]);
    }
  }, [inputValue, view]);

  // Close mention dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target as Node)) {
        setShowMentionDropdown(false);
      }
    }
    if (showMentionDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMentionDropdown]);

  // Load channels when server changes
  useEffect(() => {
    if (!view || view.type !== 'channel') return;
    async function load() {
      const res = await fetch(`/api/servers/${(view as any).serverId}/channels`);
      if (res.ok) { const d = await res.json(); setChannels(d.channels); }
    }
    load();
  }, [view?.type === 'channel' ? view.serverId : null]);

  // Load messages when view changes
  useEffect(() => {
    if (!view) return;
    if (view.type === 'channel') {
      leaveChannel(view.channelId);
      joinChannel(view.channelId);
      fetch(`/api/channels/${view.channelId}/messages?limit=50`).then(r => r.ok ? r.json() : { messages: [] }).then(d => setMessages(d.messages));
    } else {
      socket.current?.emit('join_dm', view.dmId);
      fetch(`/api/dm/${view.dmId}/messages?limit=50`).then(r => r.ok ? r.json() : { messages: [] }).then(d => setMessages(d.messages));
    }
    setReplyingTo(null);
    // Clear unread count for the newly viewed channel/DM
    if (view) {
      const key = view.type === 'channel' ? view.channelId : view.dmId;
      setUnreadCounts(prev => { const n = new Map(prev); n.delete(key); return n; });
    }
  }, [view?.type === 'channel' ? view.channelId : view?.type === 'dm' ? view.dmId : null]);

  // Scroll to bottom on new messages
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Socket listeners
  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(on('new_message', (msg: unknown) => {
      const m = msg as Message;
      updateLastMessageTs(m.createdAt);
      if ((view?.type === 'channel' && m.channelId === view.channelId) || (view?.type === 'dm' && m.dmChannelId === view.dmId)) {
        setMessages(prev => [...prev, m]);
      } else {
        const key = m.channelId || m.dmChannelId || '';
        if (key) setUnreadCounts(prev => { const n = new Map(prev); n.set(key, (n.get(key) || 0) + 1); return n; });
      }
    }));
    unsubs.push(on('missed_messages', (data: unknown) => {
      const { messages: missed } = data as { messages: Message[] };
      if (!missed || missed.length === 0) return;
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = missed.filter(m => !existingIds.has(m.id));
        if (newMsgs.length === 0) return prev;
        return [...prev, ...newMsgs].sort((a, b) => a.createdAt - b.createdAt);
      });
      // Update lastMessageTs to the latest missed message
      const latestTs = Math.max(...missed.map(m => m.createdAt));
      updateLastMessageTs(latestTs);
    }));
    unsubs.push(on('message_edited', (data: unknown) => {
      const { id, content, editedAt } = data as { id: string; content: string; editedAt: number };
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content, editedAt } : m));
    }));
    unsubs.push(on('message_deleted', (data: unknown) => {
      const { id } = data as { id: string };
      setMessages(prev => prev.filter(m => m.id !== id));
    }));
    unsubs.push(on('reaction_added', (data: unknown) => {
      const { messageId, userId, emoji } = data as { messageId: string; userId: string; emoji: string };
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find(r => r.emoji === emoji);
        if (existing) return { ...m, reactions: m.reactions.map(r => r.emoji === emoji ? { ...r, userIds: [...r.userIds, userId] } : r) };
        return { ...m, reactions: [...m.reactions, { emoji, userIds: [userId] }] };
      }));
    }));
    unsubs.push(on('reaction_removed', (data: unknown) => {
      const { messageId, userId, emoji } = data as { messageId: string; userId: string; emoji: string };
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        return { ...m, reactions: m.reactions.map(r => r.emoji === emoji ? { ...r, userIds: r.userIds.filter(id => id !== userId) } : r).filter(r => r.userIds.length > 0) };
      }));
    }));
    unsubs.push(on('user_typing', (data: unknown) => {
      const { userId: uid, username: uname, isTyping } = data as { userId: string; username: string; isTyping: boolean };
      if (uid === user?.id) return;
      setTypingUsers(prev => { const n = new Map(prev); if (isTyping) n.set(uid, uname); else n.delete(uid); return n; });
    }));
    return () => unsubs.forEach(fn => fn());
  }, [on, view, user?.id]);

  const currentRoomId = view?.type === 'channel' ? view.channelId : view?.type === 'dm' ? `dm:${view.dmId}` : '';

  const handleSend = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() && !uploadingFile) return;
    // Block sending if muted
    if (mutedUntil && mutedUntil > Date.now()) {
      toast(`Estás silenciado — no puedes enviar mensajes hasta ${new Date(mutedUntil).toLocaleTimeString('es-ES')}`, 'error');
      return;
    }
    const roomId = view?.type === 'channel' ? view.channelId : view?.type === 'dm' ? view.dmId : '';
    if (!roomId) return;

    const payload: any = { content: inputValue.trim() };
    if (view?.type === 'channel') payload.channelId = view.channelId;
    else payload.dmChannelId = view?.dmId;
    if (replyingTo) payload.replyToId = replyingTo.id;

    socket.current?.emit('send_message', payload);
    setInputValue('');
    setReplyingTo(null);
    socket.current?.emit('typing_stop', currentRoomId);
  }, [inputValue, view, replyingTo, currentRoomId, socket, mutedUntil, toast]);

  const handleTyping = useCallback((value: string) => {
    setInputValue(value);
    if (!currentRoomId) return;
    socket.current?.emit('typing_start', currentRoomId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { socket.current?.emit('typing_stop', currentRoomId); }, 3000);
  }, [currentRoomId, socket]);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    socket.current?.emit('add_reaction', { messageId, emoji });
    setShowEmojiPicker(null);
  }, [socket]);

  const insertMention = useCallback((user: any) => {
    const name = user.displayName || user.username;
    const updated = inputValue.replace(/@(\w*)$/, `@${name} `);
    setInputValue(updated);
    setShowMentionDropdown(false);
    setMentionResults([]);
  }, [inputValue]);

  const handleOpenDmFromFriends = useCallback((userId: string) => {
    // Find existing DM or create one
    const existing = dms.find(d => (d as any).participants?.some((p: any) => p.id === userId));
    if (existing) {
      setView({ type: 'dm', dmId: existing.id });
    } else {
      // Create new DM
      fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: userId }),
      }).then(async res => {
        if (res.ok) {
          const data = await res.json();
          setDms(prev => [...prev, data.dm]);
          setView({ type: 'dm', dmId: data.dm.id });
        }
      }).catch(() => {});
    }
  }, [dms]);

  async function handleSubmitReport() {
    if (!reportModal || !reportReason.trim()) return;
    setReportLoading(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: reportModal.messageId, reason: reportReason.trim() }),
      });
      if (res.ok) {
        toast('Reporte enviado — gracias por ayudar a mantener la comunidad segura.', 'success');
        setReportModal(null);
        setReportReason('');
      } else {
        const data = await res.json();
        toast(data.error || 'No se pudo enviar el reporte', 'error');
      }
    } catch {
      toast('Error de conexión', 'error');
    } finally {
      setReportLoading(false);
    }
  }

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !view) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) { const d = await uploadRes.json(); toast(d.error || 'Error al subir', 'error'); return; }
      const { attachmentUrl, attachmentType, attachmentName } = await uploadRes.json();
      const payload: any = { content: '', attachmentUrl, attachmentType, attachmentName };
      if (view.type === 'channel') payload.channelId = view.channelId;
      else payload.dmChannelId = view.dmId;
      if (replyingTo) payload.replyToId = replyingTo.id;
      socket.current?.emit('send_message', payload);
      setReplyingTo(null);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [view, socket, replyingTo]);

  const handleCreateChannel = useCallback(async (data: { name: string; type: 'text' | 'voice' | 'media'; gradient?: string; isPrivate: boolean }) => {
    if (!view || view.type !== 'channel') return;
    const res = await fetch(`/api/servers/${view.serverId}/channels`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    if (res.ok) {
      const d = await res.json();
      setChannels(prev => [...prev, d.channel]);
      setView({ type: 'channel', serverId: view.serverId, channelId: d.channel.id });
      setShowCreateChannel(false);
    }
  }, [view]);

  const handleCreateServer = useCallback(async (data: { name: string }) => {
    const res = await fetch('/api/servers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: data.name }) });
    if (res.ok) {
      const d = await res.json();
      setServers(prev => [...prev, d.server]);
      const chRes = await fetch(`/api/servers/${d.server.id}/channels`);
      if (chRes.ok) { const ch = await chRes.json(); setChannels(ch.channels); if (ch.channels.length > 0) setView({ type: 'channel', serverId: d.server.id, channelId: ch.channels[0].id }); }
      setShowCreateServer(false);
    }
  }, []);

  const handleJoinServer = useCallback(async () => {
    if (!joinCode.trim()) return;
    const res = await fetch('/api/invites/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: joinCode.trim() }) });
    if (res.ok) {
      const d = await res.json();
      setServers(prev => [...prev, d.server]);
      const chRes = await fetch(`/api/servers/${d.server.id}/channels`);
      if (chRes.ok) { const ch = await chRes.json(); setChannels(ch.channels); if (ch.channels.length > 0) setView({ type: 'channel', serverId: d.server.id, channelId: ch.channels[0].id }); }
      setShowJoinServer(false);
      setJoinCode('');
    }
  }, [joinCode]);

  const handleOpenDm = useCallback(async (userId: string) => {
    const res = await fetch('/api/dm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    if (res.ok) {
      const d = await res.json();
      const dm = d.dm;
      const otherUser = { id: userId, username: '', displayName: '', avatarUrl: null, status: 'offline' };
      setDms(prev => { const exists = prev.find(x => x.id === dm.id); if (exists) return prev; return [{ ...dm, otherUser, lastMessage: null }, ...prev]; });
      setView({ type: 'dm', dmId: dm.id });
    }
  }, []);

  const handleLogout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/'; };

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  const currentServer = servers.find(s => s.id === (view?.type === 'channel' ? view.serverId : ''));
  const currentChannel = channels.find(c => c.id === (view?.type === 'channel' ? view.channelId : ''));
  const currentDm = dms.find(d => d.id === (view?.type === 'dm' ? view.dmId : ''));

  const channelIcon = (type: string) => type === 'voice' ? '[V]' : type === 'media' ? '[M]' : '#';

  return (
    <ToastProvider>
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-[#0a2540]">
      {/* Reconnection Banner */}
      {connectionState !== 'connected' && (
        <div className={`w-full px-4 py-2 text-center text-sm font-medium z-50 transition-all duration-300 ${connectionState === 'reconnecting' ? 'bg-amber-900/80 text-amber-200 border-b border-amber-700/50' : 'bg-red-900/80 text-red-200 border-b border-red-700/50'}`}>
          {connectionState === 'reconnecting' ? '[~] Reconectando...' : '[!] Desconectado -- intentando reconectar...'}
        </div>
      )}
      {/* Mobile Header Bar */}
      <div className="md:hidden h-14 bg-white/[.08] border-b border-white/10 flex items-center px-3 gap-2 flex-shrink-0 z-20">
        {mobilePanel !== 'servers' && (
          <button onClick={() => setMobilePanel('servers')} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover transition-all duration-200">[=]</button>
        )}
        {mobilePanel === 'chat' && view && (
          <button onClick={() => setMobilePanel(view.type === 'dm' || !view ? 'channels' : 'channels')} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover transition-all duration-200">←</button>
        )}
        <div className="flex-1 min-w-0">
          {mobilePanel === 'servers' && <h3 className="font-semibold text-white truncate">Servidores</h3>}
          {mobilePanel === 'channels' && <h3 className="font-semibold text-white truncate">{view?.type === 'dm' ? 'Mensajes Directos' : currentServer?.name || 'Selecciona un servidor'}</h3>}
          {mobilePanel === 'chat' && view?.type === 'channel' && <h3 className="font-semibold text-white truncate">#{currentChannel?.name || '...'}</h3>}
          {mobilePanel === 'chat' && view?.type === 'dm' && <h3 className="font-semibold text-white truncate">{currentDm?.otherUser.displayName || 'DM'}</h3>}
          {mobilePanel === 'chat' && !view && <h3 className="font-semibold text-white truncate">Chat</h3>}
          {mobilePanel === 'members' && <h3 className="font-semibold text-white truncate">Miembros</h3>}
        </div>
        {mobilePanel === 'chat' && view?.type === 'channel' && (
          <button onClick={() => setShowSearch(!showSearch)} className="p-2 rounded-lg text-white/70 hover:text-[#6dd5fa] hover:bg-[#6dd5fa]/10 transition-all duration-200">[?]</button>
        )}
        {mobilePanel === 'chat' && view?.type === 'channel' && (
          <button onClick={() => setMobilePanel('members')} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover transition-all duration-200">[@]</button>
        )}
        {mobilePanel === 'members' && (
          <button onClick={() => setMobilePanel('chat')} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover transition-all duration-200">[X]</button>
        )}
      </div>

      {/* Server Sidebar - hidden on mobile unless panel active */}
      <div className={`${isMobile && mobilePanel !== 'servers' ? 'hidden' : ''} ${isMobile ? 'w-full' : 'w-[72px]'} flex-shrink-0 bg-white/[.08] border-r border-white/10 flex ${isMobile ? 'flex-row overflow-x-auto' : 'flex-col items-center'} py-3 gap-2 overflow-y-auto`}>
        {/* DM button */}
        <button onClick={() => { setView(null); setMessages([]); setActiveGroupDmId(null); }} className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg transition-all duration-200 ${!view ? 'bg-[#6dd5fa] text-[#0a2540] shadow-glow' : 'bg-[#0a2540] text-white/70 hover:bg-white/[.08]-hover'}`} title="Mensajes Directos">[M]</button>
        {/* Friends button */}
        <button onClick={() => setShowFriendsPanel(true)} className="w-12 h-12 rounded-xl flex items-center justify-center text-lg transition-all duration-200 bg-[#0a2540] text-white/70 hover:bg-white/[.08]-hover" title="Amigos">[@]</button>
        <div className="w-8 h-0.5 bg-white/10 rounded-full my-1" />
        {servers.map(server => {
          const hasUnread = channels.some(ch => ch.serverId === server.id && (unreadCounts.get(ch.id) || 0) > 0);
          return (
            <div key={server.id} className="relative">
              <button onClick={async () => { const res = await fetch(`/api/servers/${server.id}/channels`); if (res.ok) { const d = await res.json(); setChannels(d.channels); if (d.channels.length > 0) setView({ type: 'channel', serverId: server.id, channelId: d.channels[0].id }); } }}
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-200 overflow-hidden ${view?.type === 'channel' && view.serverId === server.id ? 'bg-[#6dd5fa] text-[#0a2540] shadow-glow' : 'bg-[#0a2540] text-white/70 hover:bg-white/[.08]-hover hover:text-white'}`}
                title={server.name}>
                {server.iconUrl ? <img src={server.iconUrl} alt="" className="w-full h-full object-cover" /> : server.isMain ? '[*]' : server.name.charAt(0).toUpperCase()}
              </button>
              {hasUnread && view?.serverId !== server.id && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#6dd5fa] rounded-full shadow-glow" />}
            </div>
          );
        })}
        <button onClick={() => setShowCreateServer(true)} className="w-12 h-12 rounded-2xl bg-[#0a2540] text-[#6dd5fa] hover:bg-[#6dd5fa] hover:text-[#0a2540] flex items-center justify-center text-2xl transition-all duration-200" title="Crear servidor">+</button>
        <button onClick={() => setShowJoinServer(true)} className="w-12 h-12 rounded-2xl bg-[#0a2540] text-green-400 hover:bg-green-400 hover:text-[#0a2540] flex items-center justify-center text-lg transition-all duration-200" title="Unirse con código">[+]</button>
      </div>

      {/* Channel List / DM List */}
      <div className={`${isMobile && mobilePanel !== 'channels' ? 'hidden' : ''} ${isMobile ? 'w-full' : 'w-60'} flex-shrink-0 bg-white/[.08] border-r border-white/10 flex flex-col`}>
        {/* Server Banner */}
        {currentServer?.bannerUrl && (
          <div className="h-24 overflow-hidden flex-shrink-0">
            <img src={currentServer.bannerUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-white truncate text-sm">{view?.type === 'dm' ? 'Mensajes Directos' : currentServer?.name || 'Selecciona un servidor'}</h2>
          {view?.type === 'channel' && currentServer && !currentServer.isMain && (
            <button onClick={() => setShowServerSettings(true)} className="text-white/70 hover:text-[#6dd5fa] transition-colors text-xs">[*]</button>
          )}
        </div>

        {/* Stories Bar - only in server view */}
        {view?.type === 'channel' && stories.length > 0 && (
          <StoriesBar
            stories={stories}
            onViewStory={(storyId) => fetch(`/api/stories/${storyId}/view`, { method: 'POST' }).catch(() => {})}
            onOpenViewer={(userId) => setShowStoriesViewer(userId)}
            onCreateStory={() => setShowCreateStory(true)}
          />
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {view?.type === 'dm' || !view ? (
            <>
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider px-3 py-2">Conversaciones</p>
              {dms.map(dm => (
                <button key={dm.id} onClick={() => setView({ type: 'dm', dmId: dm.id })}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-3 ${view?.type === 'dm' && view.dmId === dm.id ? 'bg-[#6dd5fa]/15 text-[#6dd5fa] glow-active' : 'text-white/70 hover:bg-white/[.08]-hover hover:text-white'}`}>
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-xs font-bold overflow-hidden">
                      {dm.otherUser.avatarUrl ? <img src={dm.otherUser.avatarUrl} alt="" className="w-full h-full object-cover" /> : (dm.otherUser.displayName || dm.otherUser.username).charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white/[.08] ${dm.otherUser.status === 'online' ? 'bg-green-500' : dm.otherUser.status === 'away' ? 'bg-yellow-500' : dm.otherUser.status === 'dnd' ? 'bg-red-500' : 'bg-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{dm.otherUser.displayName || dm.otherUser.username}</p>
                    {dm.lastMessage && <p className="text-xs text-white/70/60 truncate">{dm.lastMessage.content}</p>}
                  </div>
                  {(unreadCounts.get(dm.id) || 0) > 0 && <span className="ml-auto bg-[#6dd5fa] text-[#0a2540] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">{unreadCounts.get(dm.id)}</span>}
                </button>
              ))}
              {dms.length === 0 && <p className="text-xs text-white/70/50 text-center py-4">Sin conversaciones</p>}

              {/* Group DMs */}
              {groupDms.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-3 py-2 mt-2">
                    <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Grupos</p>
                  </div>
                  {groupDms.map(gdm => (
                    <button
                      key={gdm.id}
                      onClick={() => {
                        setActiveGroupDmId(gdm.id);
                        setView(null);
                        socket.current?.emit('join_group_dm', gdm.id);
                        fetch(`/api/group-dm/${gdm.id}/messages`).then(async res => {
                          if (res.ok) { const d = await res.json(); setGroupMessages(d.messages || []); }
                        }).catch(() => {});
                      }}
                      className={`w-full text-left rounded-lg text-sm transition-all duration-200 flex items-center gap-2 px-3 py-2 ${activeGroupDmId === gdm.id ? 'glow-active' : 'hover:bg-white/[.08]-hover'}`}
                    >
                      <span className="text-base">[@]</span>
                      <div className="flex-1 min-w-0">
                        <p className={`truncate ${activeGroupDmId === gdm.id ? 'text-[#6dd5fa] font-medium' : 'text-white/70'}`}>{gdm.name || 'Grupo sin nombre'}</p>
                        {gdm.lastMessage && <p className="text-xs text-white/70/60 truncate">{gdm.lastMessage.content}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Canales</p>
                <button onClick={() => setShowCreateChannel(true)} className="text-white/70 hover:text-[#6dd5fa] transition-colors text-lg leading-none">+</button>
              </div>
              {channels.map(channel => {
                const isVoiceConnected = voice.isConnected && voice.currentRoom === channel.id;
                const voiceParticipants = isVoiceConnected ? Array.from(voice.participants.values()) : [];
                return (
                  <div key={channel.id} className="mb-0.5">
                    <button onClick={() => {
                      setView({ type: 'channel', serverId: view!.serverId, channelId: channel.id });
                      if (channel.type === 'voice') {
                        if (voice.isConnected && voice.currentRoom === channel.id) {
                          voice.leaveVoice();
                        } else {
                          if (voice.isConnected) voice.leaveVoice();
                          voice.joinVoice(channel.id, 'channel', { id: user!.id, username: user!.username, displayName: user!.displayName || user!.username, avatarUrl: user!.avatarUrl });
                        }
                      }
                    }}
                      className={`w-full text-left rounded-lg text-sm transition-all duration-200 flex items-center gap-2 overflow-hidden relative ${view?.type === 'channel' && view.channelId === channel.id ? 'glow-active' : 'hover:bg-white/[.08]-hover'} ${channel.type === 'voice' && voice.isConnected && voice.currentRoom === channel.id ? 'ring-1 ring-green-500/50' : ''}`}
                      style={channel.gradient ? { background: channel.gradient, padding: '8px 12px' } : { padding: '8px 12px' }}>
                      <span className={channel.gradient ? 'text-white/80' : 'text-white/70/60'}>{channelIcon(channel.type)}</span>
                      <span className={channel.gradient ? 'text-white font-medium' : view?.type === 'channel' && view.channelId === channel.id ? 'text-[#6dd5fa]' : 'text-white/70'}>{channel.name}</span>
                      {channel.type === 'voice' && voice.isConnected && voice.currentRoom === channel.id && <span className="ml-auto text-[10px] text-green-400 font-medium">● Conectado</span>}
                      {(unreadCounts.get(channel.id) || 0) > 0 && channel.type !== 'voice' && <span className="ml-auto bg-[#6dd5fa] text-[#0a2540] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadCounts.get(channel.id)}</span>}
                      {channel.isPrivate === 1 && <span className={`text-xs ${(unreadCounts.get(channel.id) || 0) > 0 && channel.type !== 'voice' ? '' : 'ml-auto'} opacity-60`}>[P]</span>}
                    </button>
                    {isVoiceConnected && voiceParticipants.length > 0 && (
                      <div className="pl-8 pr-3 pb-1 pt-0.5 flex flex-wrap gap-1.5">
                        {voiceParticipants.map(p => (
                          <div key={p.userId} className={`relative group`} title={p.displayName || p.username}>
                            <div className={`w-6 h-6 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-[9px] font-bold text-[#6dd5fa] overflow-hidden ${p.isSpeaking ? 'ring-2 ring-green-500 shadow-glow' : ''}`}>
                              {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" /> : (p.displayName || p.username || '?').charAt(0).toUpperCase()}
                            </div>
                            {p.isMuted && <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-[#0a2540] rounded-full px-0.5">[x]</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Clips Button - only visible in server view */}
        {view?.type === 'channel' && (
          <div className="px-2 pb-2">
            <button
              onClick={() => setShowClips(true)}
              className={`w-full text-left rounded-lg text-sm transition-all duration-200 flex items-center gap-2 px-3 py-2 ${showClips ? 'glow-active' : 'hover:bg-white/[.08]-hover'}`}
            >
              <span className="text-base">[&gt;]</span>
              <span className={showClips ? 'text-[#6dd5fa] font-medium' : 'text-white/70'}>Clips</span>
            </button>
          </div>
        )}

        {/* User mini profile */}
        <div className="p-3 border-t border-white/10 bg-[#0a2540]/50">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowProfileModal(true)} className="relative flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" title="Editar perfil">
              <div className="w-9 h-9 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-[#6dd5fa] font-bold text-sm overflow-hidden">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user?.username.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0a2540] ${user?.status === 'online' ? 'bg-green-500 status-pulse' : user?.status === 'away' ? 'bg-yellow-500' : user?.status === 'dnd' ? 'bg-red-500' : 'bg-gray-500'}`} />
            </button>
            <button onClick={() => setShowProfileModal(true)} className="flex-1 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity" title="Editar perfil">
              <p className="text-sm font-medium text-white truncate">{user?.displayName}</p>
              <p className="text-xs text-white/70 truncate">@{user?.username}</p>
            </button>
            <div className="flex gap-1">
              <button onClick={() => setShowSettings(true)} className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/[.08]-hover transition-colors" title="Ajustes">[*]</button>
              {user?.role === 'admin' && <button onClick={() => setShowAdminPanel(true)} className="p-1.5 rounded-md text-[#6dd5fa] hover:bg-[#6dd5fa]/10 transition-colors" title="Admin">[A]</button>}
              <button onClick={handleLogout} className="p-1.5 rounded-md text-white/70 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Cerrar sesión">↪</button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${isMobile && mobilePanel !== 'chat' ? 'hidden' : ''} flex-1 flex flex-col min-w-0`}>
        {/* Header */}
        <div className="h-14 border-b border-white/10 flex items-center px-4 gap-2 flex-shrink-0">
          {view?.type === 'channel' ? (
            <>
              <span className="text-white/70 text-lg">{currentChannel ? channelIcon(currentChannel.type) : '#'}</span>
              <h3 className="font-semibold text-white flex-1 min-w-0 truncate">{currentChannel?.name || 'Selecciona un canal'}</h3>
              {currentChannel?.type === 'voice' && <span className="text-xs bg-[#6dd5fa]/20 text-[#6dd5fa] px-2 py-0.5 rounded-full">Voz</span>}
              {currentChannel?.type === 'media' && <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Media</span>}
              <button onClick={() => setShowSearch(!showSearch)} className={`hidden md:flex p-2 rounded-lg transition-all duration-200 ${showSearch ? 'text-[#6dd5fa] bg-[#6dd5fa]/10' : 'text-white/70 hover:text-[#6dd5fa] hover:bg-[#6dd5fa]/10'}`} title="Buscar">[?]</button>
            </>
          ) : view?.type === 'dm' ? (
            <>
              <div className="w-6 h-6 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-xs font-bold overflow-hidden">
                {currentDm?.otherUser.avatarUrl ? <img src={currentDm.otherUser.avatarUrl} alt="" className="w-full h-full object-cover" /> : (currentDm?.otherUser.displayName || '?').charAt(0)}
              </div>
              <h3 className="font-semibold text-white flex-1 min-w-0 truncate">{currentDm?.otherUser.displayName || currentDm?.otherUser.username || 'DM'}</h3>
            </>
          ) : (
            <h3 className="font-semibold text-white flex-1">Mensajes Directos</h3>
          )}
        </div>

        {/* Search Overlay */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-white/10 bg-white/[.08]/50 overflow-hidden"
            >
              <div className="p-3">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar mensajes..."
                    className="w-full bg-[#0a2540] border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-white/40/50 focus:outline-none focus:border-[#6dd5fa]/50 focus:ring-1 focus:ring-[#6dd5fa]/30 transition-all duration-200"
                    autoFocus
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70/50 text-sm">[?]</span>
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors text-xs">[X]</button>
                  )}
                </div>
                {searching && <p className="text-xs text-white/70 mt-2 animate-pulse">Buscando...</p>}
                {!searching && searchResults.length > 0 && (
                  <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                    {searchResults.map((r: any) => (
                      <button
                        key={r.messageId}
                        onClick={() => {
                          setShowSearch(false);
                          setSearchQuery('');
                          setSearchResults([]);
                          if (r.channelId && r.channelId !== view?.channelId) {
                            setView({ type: 'channel', serverId: view?.serverId || '', channelId: r.channelId });
                          }
                        }}
                        className="w-full text-left p-2 rounded-lg hover:bg-white/[.08]-hover transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-5 h-5 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-[9px] font-bold text-[#6dd5fa] overflow-hidden flex-shrink-0">
                            {r.author.avatarUrl ? <img src={r.author.avatarUrl} alt="" className="w-full h-full object-cover" /> : (r.author.displayName || '?').charAt(0)}
                          </div>
                          <span className="text-xs font-medium text-white">{r.author.displayName}</span>
                          {r.channelName && <span className="text-xs text-white/70/60">#{r.channelName}</span>}
                          <span className="text-xs text-white/70/40 ml-auto">{formatTime(r.createdAt)}</span>
                        </div>
                        <p className="text-xs text-white/70 truncate pl-7">{r.content}</p>
                      </button>
                    ))}
                  </div>
                )}
                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-white/70 mt-2">No se encontraron resultados</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {!view && (
            <div className="flex flex-col items-center justify-center h-full text-white/70/50">
              <p className="text-4xl mb-4">[M]</p>
              <p>Selecciona una conversación o un canal</p>
            </div>
          )}
          {messages.length === 0 && view && (
            <div className="flex flex-col items-center justify-center h-full text-white/70/50">
              <p className="text-4xl mb-4">[*]</p>
              <p>No hay mensajes aún. ¡Sé el primero en escribir!</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const showHeader = i === 0 || messages[i - 1].author.id !== msg.author.id || msg.createdAt - messages[i - 1].createdAt > 60000;
            const isImage = msg.attachmentType?.startsWith('image/');
            const isVideo = msg.attachmentType?.startsWith('video/');
            const isGif = msg.attachmentType === 'image/gif';
            return (
              <div key={msg.id} className={`group flex gap-3 ${showHeader ? 'mt-1.5 pt-0.5' : ''} hover:bg-white/[.08]/30 -mx-4 px-4 py-px transition-colors relative`}>
                {showHeader ? (
                  <div className="w-10 h-10 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-[#6dd5fa] font-bold text-sm flex-shrink-0 overflow-hidden mt-0.5 cursor-pointer" onClick={() => msg.author.id !== user?.id && handleOpenDm(msg.author.id)}>
                    {msg.author.avatarUrl ? <img src={msg.author.avatarUrl} alt="" className="w-full h-full object-cover" /> : msg.author.username.charAt(0).toUpperCase()}
                  </div>
                ) : <div className="w-10 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  {showHeader && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="font-medium text-white cursor-pointer hover:underline" onClick={() => msg.author.id !== user?.id && handleOpenDm(msg.author.id)}>{msg.author.displayName}</span>
                      <span className="text-xs text-white/70/60">{formatDate(msg.createdAt)} {formatTime(msg.createdAt)}</span>
                      {msg.editedAt && <span className="text-xs text-white/70/40 italic">(editado)</span>}
                    </div>
                  )}
                  {/* Reply quote */}
                  {msg.replyTo && (
                    <div className="flex items-center gap-2 mb-1 text-xs text-white/70/70 pl-1 border-l-2 border-[#6dd5fa]/30">
                      <span className="font-medium">{msg.replyTo.author.displayName}</span>
                      <span className="truncate max-w-[300px]">{msg.replyTo.content}</span>
                    </div>
                  )}
                  {msg.content && <p className="text-white/90 whitespace-pre-wrap break-words text-[15px] leading-snug">{msg.content}</p>}
                  {/* Attachment preview */}
                  {msg.attachmentUrl && isImage && (
                    <div className="mt-2 max-w-md">
                      <img src={msg.attachmentUrl} alt={msg.attachmentName || ''} className="rounded-xl max-h-80 object-contain bg-[#0a2540]/50" />
                      {isGif && <span className="text-xs text-[#6dd5fa] mt-1 block">GIF</span>}
                    </div>
                  )}
                  {msg.attachmentUrl && isVideo && (
                    <div className="mt-2 max-w-md">
                      <video src={msg.attachmentUrl} controls className="rounded-xl max-h-80 bg-black" />
                    </div>
                  )}
                  {msg.attachmentUrl && !isImage && !isVideo && (
                    <a href={msg.attachmentUrl} download={msg.attachmentName || ''} className="mt-2 inline-flex items-center gap-3 bg-[#0a2540] border border-white/10 rounded-xl p-3 hover:border-[#6dd5fa]/30 transition-colors max-w-xs">
                      <span className="text-2xl">[F]</span>
                      <div>
                        <p className="text-sm text-white font-medium truncate">{msg.attachmentName}</p>
                        <p className="text-xs text-white/70">Descargar</p>
                      </div>
                    </a>
                  )}
                  {/* Link preview */}
                  {msg.linkPreview && (
                    <a href={msg.linkPreview.url} target="_blank" rel="noopener noreferrer" className="mt-2 block max-w-md bg-[#0a2540] border border-white/10 rounded-xl overflow-hidden hover:border-[#6dd5fa]/30 transition-colors">
                      {msg.linkPreview.image && <img src={msg.linkPreview.image} alt="" className="w-full h-40 object-cover" />}
                      <div className="p-3">
                        <p className="text-sm font-medium text-[#6dd5fa] truncate">{msg.linkPreview.title}</p>
                        <p className="text-xs text-white/70 mt-1 line-clamp-2">{msg.linkPreview.description}</p>
                        <p className="text-xs text-white/70/50 mt-1 truncate">{msg.linkPreview.url}</p>
                      </div>
                    </a>
                  )}
                  {/* Reactions */}
                  {msg.reactions.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {msg.reactions.map(r => (
                        <button key={r.emoji} onClick={() => handleReaction(msg.id, r.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${r.userIds.includes(user?.id || '') ? 'border-[#6dd5fa] bg-[#6dd5fa]/15 text-[#6dd5fa]' : 'border-white/10 bg-[#0a2540] text-white/70 hover:border-[#6dd5fa]/30'}`}>
                          <span>{r.emoji}</span><span>{r.userIds.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Message actions */}
                <div className="absolute -top-3 right-4 hidden group-hover:flex items-center gap-0.5 bg-white/[.08] border border-white/10 rounded-lg shadow-lg px-1 py-0.5 z-10">
                  <button onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)} className="p-1 text-white/70 hover:text-[#6dd5fa] transition-colors text-sm" title="Reaccionar">[:]</button>
                  <button onClick={() => setReplyingTo(msg)} className="p-1 text-white/70 hover:text-[#6dd5fa] transition-colors text-sm" title="Responder">↩</button>
                  {msg.author.id === user?.id && <button onClick={() => { setEditingMessage(msg); setEditContent(msg.content); }} className="p-1 text-white/70 hover:text-[#6dd5fa] transition-all duration-200 text-sm" title="Editar">[E]</button>}
                  {(msg.author.id === user?.id || user?.role === 'admin') && <button onClick={() => { setConfirmModal({ title: 'Eliminar mensaje', message: '¿Estás seguro de que quieres eliminar este mensaje?', onConfirm: () => { socket.current?.emit('delete_message', { messageId: msg.id }); setConfirmModal(null); } }); }} className="p-1 text-white/70 hover:text-red-400 transition-all duration-200 text-sm" title="Eliminar">[D]</button>}
                  <button onClick={() => { setReportModal({ messageId: msg.id }); setReportReason(''); }} className="p-1 text-white/70 hover:text-orange-400 transition-all duration-200 text-sm" title="Reportar">[!]</button>
                </div>
                {/* Emoji picker popup */}
                {showEmojiPicker === msg.id && (
                  <div className="absolute -top-12 right-4 bg-white/[.08] border border-white/10 rounded-xl p-2 shadow-glow-strong z-20 flex gap-1">
                    {EMOJI_LIST.map(e => <button key={e} onClick={() => handleReaction(msg.id, e)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[.08]-hover transition-colors text-lg">{e}</button>)}
                  </div>
                )}
              </div>
            );
          })}
          {typingUsers.size > 0 && <div className="text-xs text-white/70/60 italic mt-2 animate-pulse">{Array.from(typingUsers.values()).join(', ')} está escribiendo...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply bar */}
        {replyingTo && (
          <div className="px-4 py-2 bg-white/[.08] border-t border-white/10 flex items-center gap-3 text-sm">
            <span className="text-[#6dd5fa]">↩</span>
            <span className="text-white/70">Respondiendo a <span className="text-white font-medium">{replyingTo.author.displayName}</span></span>
            <span className="text-white/70/60 truncate flex-1">{replyingTo.content}</span>
            <button onClick={() => setReplyingTo(null)} className="text-white/70 hover:text-white">[X]</button>
          </div>
        )}

        {/* Mute Banner */}
        {mutedUntil && mutedUntil > Date.now() && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3"
          >
            <span className="text-red-400 text-lg">[x]</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">Estás silenciado</p>
              <p className="text-xs text-red-400/70">No puedes enviar mensajes hasta {new Date(mutedUntil).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <button onClick={() => setMutedUntil(null)} className="text-red-400/50 hover:text-red-400 text-xs">[X]</button>
          </motion.div>
        )}

        {/* Message Input */}
        <div className="p-4 flex-shrink-0 relative">
          {/* @mention autocomplete dropdown */}
          {showMentionDropdown && mentionResults.length > 0 && (
            <div ref={mentionDropdownRef} className="absolute bottom-full left-4 right-4 mb-2 bg-white/[.08] border border-white/10 rounded-xl shadow-glow-strong overflow-hidden z-30 max-h-60 overflow-y-auto">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-white/70 uppercase tracking-wider border-b border-white/10">Mencionar usuario</p>
              {mentionResults.map((u: any) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => insertMention(u)}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-white/[.08]-hover transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-[#6dd5fa] font-bold text-xs overflow-hidden flex-shrink-0">
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : (u.displayName || u.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.displayName || u.username}</p>
                    <p className="text-xs text-white/70/60 truncate">@{u.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {view ? (
            <form onSubmit={handleSend} className="relative flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg text-white/70 hover:text-[#6dd5fa] hover:bg-[#6dd5fa]/10 transition-all flex-shrink-0" title="Adjuntar archivo">[+]</button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*,.pdf,.txt,.zip,.mp3,.ogg,.wav" />
              <input type="text" value={inputValue} onChange={e => handleTyping(e.target.value)}
                disabled={!!(mutedUntil && mutedUntil > Date.now())}
                placeholder={mutedUntil && mutedUntil > Date.now() ? 'Estás silenciado...' : view.type === 'channel' ? `Escribe en #${currentChannel?.name}...` : activeGroupDmId ? 'Escribe al grupo...' : `Escribe a ${currentDm?.otherUser.displayName}...`}
                className={`flex-1 bg-white/[.08] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40/40 focus:outline-none focus:border-[#6dd5fa] focus:shadow-glow transition-all duration-200 ${mutedUntil && mutedUntil > Date.now() ? 'opacity-50 cursor-not-allowed' : ''}`} />
              <button type="submit" disabled={!inputValue.trim() || !!(mutedUntil && mutedUntil > Date.now())} className="p-2 rounded-lg text-[#6dd5fa] hover:bg-[#6dd5fa]/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-200 flex-shrink-0">[&gt;]</button>
            </form>
          ) : (
            <div className="text-center text-white/70/40 py-3">Selecciona una conversación para comenzar</div>
          )}
        </div>
      </div>

      {/* Members Panel */}
      {view?.type === 'channel' && (
        <div className={`${isMobile && mobilePanel !== 'members' ? 'hidden' : ''} ${isMobile ? 'w-full flex-shrink-0' : ''}`}>
          <MemberList serverId={view.serverId} />
        </div>
      )}

      {/* Modals */}
      {user && <ProfileModal user={user} isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} onStatusChange={(s) => { setUser(prev => prev ? { ...prev, status: s } : null); socket.current?.emit('status_update', { status: s }); }} />}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <AdminPanel isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)} />
      <CreateChannelModal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)} onCreate={handleCreateChannel} />
      <CreateServerModal isOpen={showCreateServer} onClose={() => setShowCreateServer(false)} onCreate={handleCreateServer} />

      {/* Clips Panel */}
      {view?.type === 'channel' && (
        <ClipsPanel
          serverId={view.serverId}
          isOpen={showClips}
          onClose={() => setShowClips(false)}
        />
      )}

      {/* Voice Call UI */}
      {voice.isConnected && (
        <div className="fixed bottom-20 left-[88px] z-40 bg-white/[.08] border border-[#6dd5fa]/30 rounded-xl shadow-glow-strong p-3 flex items-center gap-3 min-w-[280px]">
          <div className="flex -space-x-2">
            {Array.from(voice.participants.values()).slice(0, 4).map(p => (
              <div key={p.userId} className={`w-8 h-8 rounded-full border-2 border-white/[.08] overflow-hidden flex items-center justify-center text-xs font-bold ${p.isSpeaking ? 'ring-2 ring-green-500' : ''} ${p.isMuted ? 'opacity-50' : ''}`}>
                {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" /> : <span className="bg-[#6dd5fa]/20 text-[#6dd5fa] w-full h-full flex items-center justify-center">{(p.displayName || p.username || '?').charAt(0)}</span>}
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#6dd5fa] font-medium truncate">[V] Conectado a voz</p>
            <p className="text-[10px] text-white/70 truncate">{voice.participants.size} participante{voice.participants.size !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={voice.toggleMute} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${voice.isMuted ? 'bg-red-500/20 text-red-400' : 'bg-[#0a2540] text-white/70 hover:text-white'}`} title={voice.isMuted ? 'Activar mic' : 'Silenciar'}>{voice.isMuted ? '[x]' : '[m]'}</button>
            <button onClick={voice.toggleVideo} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${!voice.isVideoOff ? 'bg-[#6dd5fa]/20 text-[#6dd5fa]' : 'bg-[#0a2540] text-white/70 hover:text-white'}`} title={voice.isVideoOff ? 'Activar cámara' : 'Desactivar cámara'}>{voice.isVideoOff ? '[c]' : '[v]'}</button>
            <button onClick={voice.toggleScreenShare} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${voice.isScreenSharing ? 'bg-[#6dd5fa]/20 text-[#6dd5fa]' : 'bg-[#0a2540] text-white/70 hover:text-white'}`} title="Compartir pantalla">[S]</button>
            <button onClick={voice.leaveVoice} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors" title="Desconectar">[X]</button>
          </div>
        </div>
      )}

      {/* Voice Grid Overlay (when video/screen active) */}
      {voice.isConnected && (!voice.isVideoOff || voice.isScreenSharing || voice.localScreenStream || Array.from(voice.participants.values()).some(p => !p.isVideoOff || p.screenStream)) && (
        <div className="fixed inset-0 z-30 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8">
          {/* Screen share takes priority — show full-width */}
          {voice.localScreenStream ? (
            <div className="relative bg-black rounded-2xl overflow-hidden max-w-5xl w-full mb-4" style={{ maxHeight: '70vh' }}>
              <video ref={(el) => { if (el) (el as any).srcObject = voice.localScreenStream; }} autoPlay playsInline muted className="w-full h-full object-contain" />
              <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded-md text-xs text-white">[S] Tu pantalla</div>
            </div>
          ) : Array.from(voice.participants.values()).some(p => p.screenStream) ? (
            Array.from(voice.participants.values()).filter(p => p.screenStream).map(p => (
              <div key={'screen-' + p.userId} className="relative bg-black rounded-2xl overflow-hidden max-w-5xl w-full mb-4" style={{ maxHeight: '70vh' }}>
                <video ref={(el) => { if (el) (el as any).srcObject = p.screenStream; }} autoPlay playsInline className="w-full h-full object-contain" />
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded-md text-xs text-white">[S] {p.displayName || p.username}</div>
              </div>
            ))
          ) : (
            <div className="grid grid-cols-2 gap-4 max-w-4xl w-full">
              {/* Local user tile */}
              <div className={`relative bg-white/[.08] rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-white/10`}>
                {voice.localStream && !voice.isVideoOff ? (
                  <video ref={(el) => { if (el) (el as any).srcObject = voice.localStream; }} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-2xl font-bold text-[#6dd5fa] overflow-hidden">
                      {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : (user?.displayName || user?.username || '?').charAt(0)}
                    </div>
                    <p className="text-sm text-white">{user?.displayName || user?.username}</p>
                    {voice.isVideoOff && <span className="text-xs text-white/50">[c] Camara off</span>}
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded-md text-xs text-white flex items-center gap-1">
                  {user?.displayName || user?.username} (tu)
                </div>
              </div>
              {/* Remote participants */}
              {Array.from(voice.participants.values()).map(p => (
                <div key={p.userId} className={`relative bg-white/[.08] rounded-2xl overflow-hidden aspect-video flex items-center justify-center ${p.isSpeaking ? 'ring-2 ring-green-500 shadow-glow' : 'border border-white/10'}`}>
                  {p.stream && !p.isVideoOff ? (
                    <video ref={(el) => { if (el) (el as any).srcObject = p.stream; }} autoPlay playsInline className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-2xl font-bold text-[#6dd5fa] overflow-hidden">
                        {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" /> : (p.displayName || p.username || '?').charAt(0)}
                      </div>
                      <p className="text-sm text-white">{p.displayName || p.username}</p>
                      {p.isMuted && <span className="text-xs text-red-400">[x] Silenciado</span>}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded-md text-xs text-white flex items-center gap-1">
                    {p.isSpeaking && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                    {p.displayName || p.username}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={voice.leaveVoice} className="mt-6 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium shadow-lg transition-colors">[X] Colgar</button>
        </div>
      )}

      {/* Incoming Call Overlay */}
      {voice.incomingCall && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white/[.08] border border-[#6dd5fa]/30 rounded-2xl p-8 shadow-glow-strong text-center max-w-sm w-full mx-4">
            <div className="w-20 h-20 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-3xl font-bold text-[#6dd5fa] mx-auto mb-4 animate-pulse">[C]</div>
            <h3 className="text-xl font-bold text-white mb-2">Llamada entrante</h3>
            <p className="text-white/70 mb-6">{voice.incomingCall.fromDisplayName || voice.incomingCall.fromUsername}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => voice.rejectCall(voice.incomingCall!.fromUserId, voice.incomingCall!.dmChannelId)} className="px-6 py-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium transition-colors">[X] Rechazar</button>
              <button onClick={() => user && voice.acceptCall(voice.incomingCall!.fromUserId, voice.incomingCall!.dmChannelId, { id: user.id, username: user.username, displayName: user.displayName || user.username, avatarUrl: user.avatarUrl })} className="px-6 py-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium transition-colors">[V] Aceptar</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Join Server Modal */}
      <AnimatePresence>
        {showJoinServer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowJoinServer(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-white/[.08] border border-white/10 rounded-2xl w-full max-w-md shadow-glow-strong overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/10"><h2 className="text-xl font-bold text-white">Unirse a un servidor</h2></div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Código de invitación</label>
                  <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="XXXXXXXXXX" className="w-full bg-[#0a2540] border border-white/10 rounded-lg px-4 py-2.5 text-white font-mono tracking-wider placeholder-white/40/50 focus:outline-none focus:border-[#6dd5fa] focus:shadow-glow transition-all" autoFocus />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowJoinServer(false)} className="flex-1 px-4 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover border border-white/10 transition-colors font-medium">Cancelar</button>
                  <button onClick={handleJoinServer} disabled={!joinCode.trim()} className="flex-1 px-4 py-2.5 rounded-lg bg-[#6dd5fa] text-[#0a2540] font-semibold hover:bg-[#6dd5fa]-hover shadow-glow transition-all disabled:opacity-50">Unirse</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Server Settings Modal */}
      <AnimatePresence>
        {showServerSettings && currentServer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowServerSettings(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-white/[.08] border border-white/10 rounded-2xl w-full max-w-lg shadow-glow-strong overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Configuración del servidor</h2>
                <button onClick={() => setShowServerSettings(false)} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover transition-colors">[X]</button>
              </div>
              <div className="p-6 space-y-4">
                <ServerSettingsContent server={currentServer} onUpdate={() => { fetch('/api/servers').then(r => r.json()).then(d => setServers(d.servers)); }} onDelete={() => { setShowServerSettings(false); setShowDeleteConfirm(true); }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Server Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && currentServer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-white/[.08] border border-red-500/50 rounded-2xl w-full max-w-md shadow-glow-strong overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-red-500/30 bg-red-500/10">
                <h2 className="text-xl font-bold text-red-400">¿Estás seguro?</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-white/70 text-sm">
                  Estás a punto de eliminar el servidor <strong className="text-white">{currentServer.name}</strong>. Esta acción es irreversible. Todos los canales, mensajes y configuraciones se perderán permanentemente.
                </p>
                <div>
                  <label className="block text-xs font-medium text-red-400 mb-1.5">Escribe <strong>{currentServer.name}</strong> para confirmar:</label>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={e => setDeleteConfirmName(e.target.value)}
                    placeholder={currentServer.name}
                    className="w-full bg-[#0a2540] border border-red-500/30 rounded-lg px-4 py-2.5 text-white placeholder-white/40/30 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}
                    className="flex-1 px-4 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover border border-white/10 transition-colors font-medium"
                  >Cancelar</button>
                  <button
                    onClick={async () => {
                      if (deleteConfirmName !== currentServer.name) return;
                      setDeletingServer(true);
                      try {
                        const res = await fetch(`/api/servers/${currentServer.id}`, { method: 'DELETE' });
                        if (res.ok) {
                          setServers(prev => {
                            const updated = prev.filter(s => s.id !== currentServer.id);
                            const main = updated.find(s => s.isMain === 1) || updated[0];
                            if (main) {
                              fetch(`/api/servers/${main.id}/channels`).then(r => r.json()).then(d => {
                                setChannels(d.channels);
                                if (d.channels.length > 0) setView({ type: 'channel', serverId: main.id, channelId: d.channels[0].id });
                              });
                            } else {
                              setView(null);
                              setChannels([]);
                            }
                            return updated;
                          });
                          setShowDeleteConfirm(false);
                          setDeleteConfirmName('');
                        }
                      } finally {
                        setDeletingServer(false);
                      }
                    }}
                    disabled={deleteConfirmName !== currentServer.name || deletingServer}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >{deletingServer ? 'Eliminando...' : 'Eliminar servidor'}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stories Viewer */}
      <AnimatePresence>
        {showStoriesViewer && (
          <StoriesViewer
            stories={stories}
            initialUserId={showStoriesViewer}
            onClose={() => setShowStoriesViewer(null)}
            onAllViewed={() => {
              fetch('/api/stories').then(r => r.json()).then(d => setStories(d.stories || []));
            }}
          />
        )}
      </AnimatePresence>

      {/* Create Story Modal */}
      <AnimatePresence>
        {showCreateStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setShowCreateStory(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/[.08] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-glow-strong"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Crear historia</h3>
              <p className="text-white/70 text-sm mb-4">
                Sube una imagen o video. Las historias desapare después de 24 horas.
              </p>
              <label className="block w-full border-2 border-dashed border-white/10 hover:border-[#6dd5fa] rounded-lg p-8 text-center cursor-pointer transition-colors group">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append('file', file);
                    try {
                      const res = await fetch('/api/stories', { method: 'POST', body: formData });
                      if (res.ok) {
                        setShowCreateStory(false);
                        fetch('/api/stories').then(r => r.json()).then(d => setStories(d.stories || []));
                      }
                    } catch { /* ignore */ }
                  }}
                />
                <div className="text-3xl mb-2 text-white/70 group-hover:text-[#6dd5fa] transition-colors">[C]</div>
                <span className="text-white font-medium">Haz clic para seleccionar archivo</span>
                <span className="block text-white/70 text-xs mt-1">JPG, PNG, GIF, WebP, MP4, WebM (máx 50MB)</span>
              </label>
              <button
                onClick={() => setShowCreateStory(false)}
                className="mt-4 w-full px-4 py-2 rounded-lg bg-[#0a2540] border border-white/10 text-white/70 hover:text-white transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Message Modal */}
      <AnimatePresence>
        {editingMessage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditingMessage(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-white/[.08] border border-white/10 rounded-2xl w-full max-w-md shadow-glow-strong overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Editar mensaje</h2>
                <button onClick={() => setEditingMessage(null)} className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover transition-all duration-200">[X]</button>
              </div>
              <div className="p-6 space-y-4">
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="w-full bg-[#0a2540] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40/50 focus:outline-none focus:border-[#6dd5fa]/50 focus:ring-1 focus:ring-[#6dd5fa]/30 transition-all duration-200 min-h-[120px] resize-y text-sm"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => setEditingMessage(null)} className="flex-1 px-4 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover border border-white/10 transition-all duration-200 font-medium">Cancelar</button>
                  <button
                    onClick={() => {
                      if (editContent.trim() && editContent !== editingMessage.content) {
                        socket.current?.emit('edit_message', { messageId: editingMessage.id, content: editContent });
                      }
                      setEditingMessage(null);
                    }}
                    disabled={!editContent.trim() || editContent === editingMessage.content}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[#6dd5fa] text-white font-semibold hover:bg-[#6dd5fa]/90 shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >Guardar</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConfirmModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-white/[.08] border border-white/10 rounded-2xl w-full max-w-sm shadow-glow-strong overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="text-lg font-bold text-white">{confirmModal.title}</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-white/70 text-sm">{confirmModal.message}</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover border border-white/10 transition-all duration-200 font-medium">Cancelar</button>
                  <button onClick={confirmModal.onConfirm} className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 shadow-lg transition-all duration-200">Confirmar</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {reportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setReportModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-white/[.08] border border-white/10 rounded-2xl w-full max-w-md shadow-glow-strong overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                <span className="text-lg">[!]</span>
                <h2 className="text-lg font-bold text-white">Reportar mensaje</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-white/70">Describe el motivo del reporte. Los administradores lo revisarán.</p>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Motivo del reporte..."
                  rows={3}
                  className="w-full bg-[#0a2540] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40/40 focus:outline-none focus:border-[#6dd5fa]/50 resize-none"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button onClick={() => setReportModal(null)} className="flex-1 px-4 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[.08]-hover border border-white/10 transition-all duration-200 font-medium">Cancelar</button>
                  <button onClick={handleSubmitReport} disabled={!reportReason.trim() || reportLoading} className="flex-1 px-4 py-2.5 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">{reportLoading ? 'Enviando...' : 'Enviar reporte'}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friends Panel */}
      <FriendsPanel
        isOpen={showFriendsPanel}
        onClose={() => setShowFriendsPanel(false)}
        onOpenDm={handleOpenDmFromFriends}
      />
    </div>
    </ToastProvider>
  );
}

function ServerSettingsContent({ server, onUpdate, onDelete }: { server: Server; onUpdate: () => void; onDelete?: () => void }) {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // Word filter state
  const [filters, setFilters] = useState<{ id: string; word: string }[]>([]);
  const [newFilterWord, setNewFilterWord] = useState('');
  const [filterLoading, setFilterLoading] = useState(false);
  // Audit log state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/servers/${server.id}/invites`).then(r => r.ok ? r.json() : { invites: [] }).then(d => setInvites(d.invites));
    // Load word filters
    fetch(`/api/servers/${server.id}/filters`).then(r => r.ok ? r.json() : { filters: [] }).then(d => setFilters(d.filters || []));
    // Load audit logs
    setAuditLoading(true);
    fetch(`/api/servers/${server.id}/audit?limit=20`).then(r => r.ok ? r.json() : { logs: [] }).then(d => { setAuditLogs(d.logs || []); setAuditLoading(false); });
  }, [server.id]);

  async function generateInvite() {
    setLoading(true);
    const res = await fetch(`/api/servers/${server.id}/invites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (res.ok) {
      const d = await res.json();
      setInvites(prev => [{ code: d.code, uses: 0, revoked: 0, createdAt: Date.now() }, ...prev]);
    }
    setLoading(false);
  }

  async function revokeInvite(code: string) {
    await fetch(`/api/servers/${server.id}/invites/${code}/revoke`, { method: 'DELETE' });
    setInvites(prev => prev.map(i => i.code === code ? { ...i, revoked: 1 } : i));
  }

  async function uploadIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(`/api/servers/${server.id}/icon`, { method: 'POST', body: fd });
    if (res.ok) onUpdate();
  }

  async function uploadBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(`/api/servers/${server.id}/banner`, { method: 'POST', body: fd });
    if (res.ok) onUpdate();
  }

  async function addWordFilter() {
    if (!newFilterWord.trim()) return;
    setFilterLoading(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/filters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newFilterWord.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setFilters(prev => [...prev, { id: d.id, word: d.word }]);
        setNewFilterWord('');
      }
    } catch { /* ignore */ }
    setFilterLoading(false);
  }

  async function removeWordFilter(word: string) {
    try {
      const res = await fetch(`/api/servers/${server.id}/filters?word=${encodeURIComponent(word)}`, { method: 'DELETE' });
      if (res.ok) {
        setFilters(prev => prev.filter(f => f.word !== word));
      }
    } catch { /* ignore */ }
  }

  const ACTION_LABELS: Record<string, string> = {
    ban: 'Baneó usuario', kick: 'Expulsó usuario', delete_message: 'Eliminó mensaje',
    role_change: 'Cambió rol', channel_change: 'Modificó canal', mute: 'Silenció usuario',
    unmute: 'Quitó silencio', server_delete: 'Eliminó servidor',
  };

  return (
    <div className="space-y-6">
      {/* Icon & Banner */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Apariencia</h3>
        <div className="flex gap-4 items-start">
          <div className="text-center">
            <div className="w-16 h-16 rounded-xl bg-[#0a2540] border border-white/10 overflow-hidden flex items-center justify-center text-2xl mb-2">
              {server.iconUrl ? <img src={server.iconUrl} alt="" className="w-full h-full object-cover" /> : server.name.charAt(0)}
            </div>
            <label className="text-xs text-[#6dd5fa] cursor-pointer hover:underline">
              Cambiar icono
              <input type="file" accept="image/*" className="hidden" onChange={uploadIcon} />
            </label>
          </div>
          <div className="flex-1">
            <div className="h-20 rounded-xl bg-[#0a2540] border border-white/10 overflow-hidden flex items-center justify-center text-white/70/50 text-sm mb-2">
              {server.bannerUrl ? <img src={server.bannerUrl} alt="" className="w-full h-full object-cover" /> : 'Sin banner'}
            </div>
            <label className="text-xs text-[#6dd5fa] cursor-pointer hover:underline">
              Cambiar banner
              <input type="file" accept="image/*" className="hidden" onChange={uploadBanner} />
            </label>
          </div>
        </div>
      </div>

      {/* Invites */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Invitaciones al servidor</h3>
          <button onClick={generateInvite} disabled={loading} className="px-3 py-1.5 text-xs font-medium bg-[#6dd5fa] text-[#0a2540] rounded-lg hover:bg-[#6dd5fa]-hover transition-colors disabled:opacity-50">
            {loading ? '...' : '+ Generar'}
          </button>
        </div>
        {invites.length === 0 ? (
          <p className="text-xs text-white/70/50">No hay invitaciones activas</p>
        ) : (
          <div className="space-y-2">
            {invites.map(inv => (
              <div key={inv.code} className={`flex items-center gap-3 bg-[#0a2540] border rounded-lg p-3 ${inv.revoked ? 'border-red-500/20 opacity-50' : 'border-white/10'}`}>
                <code className="text-sm text-white font-mono tracking-wider flex-1">{inv.code}</code>
                {inv.revoked ? (
                  <span className="text-xs text-red-400">Revocada</span>
                ) : (
                  <>
                    <button onClick={() => navigator.clipboard.writeText(inv.code)} className="text-xs text-white/70 hover:text-[#6dd5fa] px-2 py-1 rounded hover:bg-white/[.08]-hover transition-colors">Copiar</button>
                    <button onClick={() => revokeInvite(inv.code)} className="text-xs text-red-400 hover:bg-red-400/10 px-2 py-1 rounded transition-colors">Revocar</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Word Filter */}
      {(server.memberRole === 'admin' || server.memberRole === 'owner') && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Filtro de palabras</h3>
          <p className="text-xs text-white/70 mb-3">Las palabras bloqueadas se reemplazan automáticamente con asteriscos en los mensajes del servidor.</p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newFilterWord}
              onChange={(e) => setNewFilterWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWordFilter()}
              placeholder="Añadir palabra..."
              className="flex-1 bg-[#0a2540] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40/40 focus:outline-none focus:border-[#6dd5fa]/50"
            />
            <button onClick={addWordFilter} disabled={!newFilterWord.trim() || filterLoading} className="px-3 py-2 text-xs font-medium bg-[#6dd5fa] text-[#0a2540] rounded-lg hover:bg-[#6dd5fa]-hover transition-colors disabled:opacity-50">
              {filterLoading ? '...' : 'Añadir'}
            </button>
          </div>
          {filters.length === 0 ? (
            <p className="text-xs text-white/70/50">No hay palabras filtradas</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1.5 bg-[#0a2540] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white">
                  {f.word}
                  <button onClick={() => removeWordFilter(f.word)} className="text-white/70 hover:text-red-400 transition-colors">[X]</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Log */}
      {(server.memberRole === 'admin' || server.memberRole === 'owner') && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Registro de auditoría</h3>
          {auditLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-[#6dd5fa]/30 border-t-[#6dd5fa] rounded-full animate-spin" />
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-xs text-white/70/50">No hay registros de auditoría</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-2.5 bg-[#0a2540] border border-white/10 rounded-lg p-3">
                  <div className="w-6 h-6 rounded-full bg-[#6dd5fa]/20 flex items-center justify-center text-[#6dd5fa] font-bold text-[10px] overflow-hidden flex-shrink-0 mt-0.5">
                    {log.actor?.avatarUrl ? (
                      <img src={log.actor.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (log.actor?.displayName || log.actor?.username || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-medium text-white text-xs">{log.actor?.displayName || log.actor?.username || 'Desconocido'}</span>
                      <span className="text-[10px] text-[#6dd5fa] bg-[#6dd5fa]/10 px-1 py-0.5 rounded">{ACTION_LABELS[log.action] || log.action}</span>
                    </div>
                    {log.target && (
                      <p className="text-[11px] text-white/70">Objetivo: <span className="text-white">{log.target.displayName || log.target.username}</span></p>
                    )}
                    {log.details && (
                      <p className="text-[10px] text-white/70/70 mt-0.5">
                        {log.details.reason || log.details.duration ? `${log.details.duration ? `${log.details.duration} min` : ''}${log.details.reason ? ` - ${log.details.reason}` : ''}` : JSON.stringify(log.details)}
                      </p>
                    )}
                    <p className="text-[10px] text-white/70/50 mt-0.5">{new Date(log.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Danger Zone */}
      {server.isMain !== 1 && onDelete && (
        <div className="border border-red-500/30 rounded-xl p-4 bg-red-500/5">
          <h3 className="text-sm font-semibold text-red-400 mb-2">Zona de peligro</h3>
          <p className="text-xs text-white/70 mb-3">Eliminar este servidor es una acción irreversible. Todos los canales, mensajes y configuraciones se perderán permanentemente.</p>
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm font-semibold text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/10 hover:text-red-300 hover:border-red-500 transition-all"
          >
            Eliminar servidor
          </button>
        </div>
      )}
    </div>
  );
}