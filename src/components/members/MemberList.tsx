'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Member { id: string; username: string; displayName: string | null; avatarUrl: string | null; status: string; role: string; customStatus: string | null; customStatusEmoji: string | null; }
interface MemberListProps { serverId: string | null; currentUserId?: string; currentUserRole?: string; }

const MUTE_DURATIONS = [{ label: '10 min', value: 10 }, { label: '1 hora', value: 60 }, { label: '1 día', value: 1440 }, { label: '7 días', value: 10080 }];

export function MemberList({ serverId, currentUserId, currentUserRole }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [muteMenuOpen, setMuteMenuOpen] = useState<string | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';

  useEffect(() => {
    if (!serverId) { setMembers([]); return; }
    async function loadMembers() {
      setLoading(true);
      try { const res = await fetch(`/api/servers/${serverId}/members`); if (res.ok) { const data = await res.json(); setMembers(data.members || []); } }
      catch {} finally { setLoading(false); }
    }
    loadMembers();
  }, [serverId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) { setMuteMenuOpen(null); setMuteReason(''); setError(''); } }
    if (muteMenuOpen) { document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }
  }, [muteMenuOpen]);

  async function handleMute(userId: string, duration: number) {
    if (!serverId) return;
    setActionLoading(true); setError('');
    try {
      const res = await fetch(`/api/servers/${serverId}/mute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, duration, reason: muteReason.trim() || undefined }) });
      if (res.ok) { setMuteMenuOpen(null); setMuteReason(''); } else { const data = await res.json(); setError(data.error || 'Error al silenciar'); }
    } catch { setError('Error de conexión'); } finally { setActionLoading(false); }
  }

  const statusColor: Record<string, string> = { online: '#8fd95f', away: '#ffd97a', dnd: '#ffa694', offline: 'rgba(255,255,255,.3)' };
  const statusLabel: Record<string, string> = { online: 'En línea', away: 'Ausente', dnd: 'No molestar', offline: 'Desconectado' };

  const sortedMembers = [...members].sort((a, b) => {
    const aOnline = a.status === 'online' ? 0 : 1; const bOnline = b.status === 'online' ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    return (a.displayName || a.username).localeCompare(b.displayName || b.username);
  });
  const onlineCount = members.filter(m => m.status === 'online').length;

  if (!serverId) {
    return (
      <div className="w-60 flex-shrink-0 p-4" style={{ background: 'rgba(0,20,40,.6)', borderLeft: '1px solid rgba(255,255,255,.1)' }}>
        <p className="text-sm text-center" style={{ color: 'rgba(255,255,255,.4)' }}>Selecciona un servidor</p>
      </div>
    );
  }

  return (
    <div className="w-60 flex-shrink-0 flex flex-col" style={{ background: 'rgba(0,20,40,.6)', borderLeft: '1px solid rgba(255,255,255,.1)' }}>
      <div className="p-4" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.6)' }}>Miembros — {members.length}</h3>
        {onlineCount > 0 && <p className="text-xs mt-1" style={{ color: '#8fd95f' }}>{onlineCount} en línea</p>}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading && members.length === 0 && <div className="flex items-center justify-center py-8"><div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid rgba(109,213,250,.2)', borderTopColor: '#6dd5fa' }} /></div>}
        {!loading && sortedMembers.length === 0 && <p className="text-sm text-center py-8" style={{ color: 'rgba(255,255,255,.4)' }}>Sin miembros</p>}
        {sortedMembers.map(member => (
          <div key={member.id} className="relative">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group cursor-default" style={{ background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden" style={{ background: 'linear-gradient(135deg, #6dd5fa, #2980b9)' }}>
                  {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" /> : (member.displayName || member.username).charAt(0).toUpperCase()}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${member.status === 'online' ? 'status-pulse' : ''}`}
                  style={{ background: statusColor[member.status] || statusColor.offline, border: '2px solid rgba(0,20,40,.9)' }}
                  title={statusLabel[member.status] || member.status} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-[#6dd5fa] transition-colors">{member.displayName || member.username}</p>
                {member.customStatus ? (
                  <p className="text-[11px] truncate leading-tight" style={{ color: 'rgba(255,255,255,.5)' }}>{member.customStatusEmoji && <span className="mr-0.5">{member.customStatusEmoji}</span>}{member.customStatus}</p>
                ) : member.role !== 'member' ? (
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,.4)' }}>{member.role === 'owner' ? 'Propietario' : member.role === 'admin' ? 'Admin' : member.role}</p>
                ) : null}
              </div>
              {isAdmin && member.id !== currentUserId && member.role !== 'owner' && (
                <button onClick={e => { e.stopPropagation(); setMuteMenuOpen(muteMenuOpen === member.id ? null : member.id); setMuteReason(''); setError(''); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-xs transition-all"
                  style={{ color: 'rgba(255,255,255,.5)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ffd97a'; e.currentTarget.style.background = 'rgba(255,217,122,.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.5)'; e.currentTarget.style.background = 'transparent'; }}
                  title="Silenciar">[x]</button>
              )}
            </div>
            <AnimatePresence>
              {muteMenuOpen === member.id && (
                <motion.div ref={menuRef} initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-2 top-full z-20 mt-1 w-52 rounded-xl p-3"
                  style={{ background: 'linear-gradient(to bottom, rgba(30,60,90,.98) 0%, rgba(20,40,60,.98) 100%)', border: '2px solid rgba(255,255,255,.2)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
                  <p className="text-xs font-semibold text-white mb-2">Silenciar a {member.displayName || member.username}</p>
                  {error && <p className="text-xs mb-2 rounded px-2 py-1" style={{ color: '#ffa694', background: 'rgba(255,100,80,.1)' }}>{error}</p>}
                  <input type="text" placeholder="Motivo (opcional)" value={muteReason} onChange={e => setMuteReason(e.target.value)}
                    className="an-input w-full rounded-lg px-2.5 py-1.5 text-xs text-white outline-none mb-2"
                    style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.15)' }} />
                  <div className="space-y-1">
                    {MUTE_DURATIONS.map(d => (
                      <button key={d.value} onClick={() => handleMute(member.id, d.value)} disabled={actionLoading}
                        className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50"
                        style={{ color: 'rgba(255,255,255,.7)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.7)'; }}>
                        {actionLoading ? '...' : d.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}