'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Friend { id: string; username: string; displayName: string | null; avatarUrl: string | null; status: string; customStatus: string | null; customStatusEmoji: string | null; friendshipId: string; }
interface PendingRequest { id: string; userId: string; username: string; displayName: string | null; avatarUrl: string | null; createdAt: number; }
interface SearchResult { id: string; username: string; displayName: string | null; avatarUrl: string | null; }
interface FriendsPanelProps { isOpen: boolean; onClose: () => void; onOpenDm: (userId: string) => void; }

export function FriendsPanel({ isOpen, onClose, onOpenDm }: FriendsPanelProps) {
  const [tab, setTab] = useState<'friends' | 'pending' | 'add'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<PendingRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch('/api/friends'); if (res.ok) { const data = await res.json(); setFriends(data.friends || []); setIncoming(data.incoming || []); setOutgoing(data.outgoing || []); } }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isOpen) loadData(); }, [isOpen, loadData]);

  const handleAccept = async (friendshipId: string) => { const res = await fetch(`/api/friends/${friendshipId}/accept`, { method: 'POST' }); if (res.ok) loadData(); };
  const handleReject = async (friendshipId: string) => { const res = await fetch(`/api/friends/${friendshipId}/reject`, { method: 'POST' }); if (res.ok) loadData(); };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try { const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`); if (res.ok) { const data = await res.json(); setSearchResults(data.users || []); } }
    catch {} finally { setSearching(false); }
  };

  const handleSendRequest = async (userId: string) => {
    const res = await fetch('/api/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    if (res.ok) { setSearchResults(prev => prev.filter(u => u.id !== userId)); loadData(); }
  };

  const statusColor: Record<string, string> = { online: '#8fd95f', away: '#ffd97a', dnd: '#ffa694', offline: 'rgba(255,255,255,.3)' };
  const tabs = [{ key: 'friends' as const, label: 'Amigos', count: friends.length }, { key: 'pending' as const, label: 'Pendientes', count: incoming.length + outgoing.length }, { key: 'add' as const, label: 'Agregar', count: null }];

  const avatarStyle = { background: 'linear-gradient(135deg, #6dd5fa, #2980b9)' };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,10,20,.8)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[80vh]"
            style={{ background: 'linear-gradient(to bottom, rgba(30,60,90,.95) 0%, rgba(20,40,60,.95) 100%)', border: '2px solid rgba(255,255,255,.2)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              <h2 className="text-xl font-bold text-white">Amigos</h2>
              <button onClick={onClose} className="p-2 rounded-lg text-white/60 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,.1)' }}>[X]</button>
            </div>
            <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex-1 px-4 py-3 text-sm font-medium transition-colors relative"
                  style={{ color: tab === t.key ? '#6dd5fa' : 'rgba(255,255,255,.6)' }}>
                  {t.label}
                  {t.count !== null && t.count > 0 && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(109,213,250,.2)', color: '#6dd5fa' }}>{t.count}</span>}
                  {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#6dd5fa' }} />}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
              {loading && <div className="flex items-center justify-center py-12"><div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid rgba(109,213,250,.2)', borderTopColor: '#6dd5fa' }} /></div>}

              {!loading && tab === 'friends' && (
                <>
                  {friends.length === 0 && (
                    <div className="text-center py-12" style={{ color: 'rgba(255,255,255,.4)' }}>
                      <p className="text-3xl mb-3">[@]</p><p className="text-sm">No tienes amigos aún</p><p className="text-xs mt-1">Busca usuarios en la pestaña &ldquo;Agregar&rdquo;</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    {friends.map(friend => (
                      <div key={friend.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden" style={avatarStyle}>
                            {friend.avatarUrl ? <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" /> : (friend.displayName || friend.username).charAt(0).toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${friend.status === 'online' ? 'status-pulse' : ''}`}
                            style={{ background: statusColor[friend.status] || statusColor.offline, border: '2px solid rgba(30,60,90,.95)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{friend.displayName || friend.username}</p>
                          {friend.customStatus ? (
                            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,.5)' }}>{friend.customStatusEmoji && <span className="mr-1">{friend.customStatusEmoji}</span>}{friend.customStatus}</p>
                          ) : <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,.4)' }}>@{friend.username}</p>}
                        </div>
                        <button onClick={() => { onOpenDm(friend.id); onClose(); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100"
                          style={{ background: 'rgba(109,213,250,.15)', color: '#6dd5fa' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(to bottom, #6dd5fa, #2980b9)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(109,213,250,.15)'; e.currentTarget.style.color = '#6dd5fa'; }}>
                          Mensaje
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!loading && tab === 'pending' && (
                <>
                  {incoming.length === 0 && outgoing.length === 0 && (
                    <div className="text-center py-12" style={{ color: 'rgba(255,255,255,.4)' }}><p className="text-3xl mb-3">[ ]</p><p className="text-sm">No hay solicitudes pendientes</p></div>
                  )}
                  {incoming.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ color: 'rgba(255,255,255,.5)' }}>Entrantes ({incoming.length})</p>
                      {incoming.map(req => (
                        <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0" style={avatarStyle}>
                            {req.avatarUrl ? <img src={req.avatarUrl} alt="" className="w-full h-full object-cover" /> : (req.displayName || req.username).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{req.displayName || req.username}</p>
                            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,.4)' }}>@{req.username}</p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={() => handleAccept(req.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: 'rgba(143,217,95,.2)', color: '#8fd95f' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#8fd95f'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(143,217,95,.2)'; e.currentTarget.style.color = '#8fd95f'; }}>Aceptar</button>
                            <button onClick={() => handleReject(req.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: 'rgba(255,100,80,.2)', color: '#ffa694' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#ffa694'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,100,80,.2)'; e.currentTarget.style.color = '#ffa694'; }}>Rechazar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {outgoing.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider px-3 py-2" style={{ color: 'rgba(255,255,255,.5)' }}>Enviadas ({outgoing.length})</p>
                      {outgoing.map(req => (
                        <div key={req.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0" style={avatarStyle}>
                            {req.avatarUrl ? <img src={req.avatarUrl} alt="" className="w-full h-full object-cover" /> : (req.displayName || req.username).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{req.displayName || req.username}</p>
                            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,.4)' }}>@{req.username}</p>
                          </div>
                          <button onClick={() => handleReject(req.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                            style={{ color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.15)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ffa694'; e.currentTarget.style.borderColor = 'rgba(255,100,80,.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; }}>Cancelar</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {!loading && tab === 'add' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder="Buscar por nombre de usuario..."
                      className="an-input flex-1 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                      style={{ background: 'rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.15)' }} />
                    <button onClick={handleSearch} disabled={!searchQuery.trim() || searching}
                      className="an-btn-primary px-4 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-50">
                      {searching ? '...' : 'Buscar'}
                    </button>
                  </div>
                  {searchResults.length === 0 && searchQuery && !searching && <p className="text-center text-sm py-8" style={{ color: 'rgba(255,255,255,.4)' }}>No se encontraron usuarios</p>}
                  <div className="space-y-1">
                    {searchResults.map(user => (
                      <div key={user.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0" style={avatarStyle}>
                          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : (user.displayName || user.username).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{user.displayName || user.username}</p>
                          <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,.4)' }}>@{user.username}</p>
                        </div>
                        <button onClick={() => handleSendRequest(user.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                          style={{ background: 'rgba(109,213,250,.15)', color: '#6dd5fa' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(to bottom, #6dd5fa, #2980b9)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(109,213,250,.15)'; e.currentTarget.style.color = '#6dd5fa'; }}>
                          Agregar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}