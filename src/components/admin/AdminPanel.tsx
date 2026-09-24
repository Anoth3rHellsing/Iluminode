'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminUser { id: string; username: string; displayName: string | null; avatarUrl: string | null; role: string; status: string; isBanned: number; createdAt: number; }
interface InviteCode { code: string; createdBy: string; usedBy: string | null; usedAt: number | null; revoked: number; createdAt: number; }
interface Stats { users: number; messages: number; servers: number; activeInvites: number; }
interface AuditEntry { id: string; action: string; targetId: string | null; details: any; createdAt: number; actor: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null; target: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null; }
interface ReportEntry { id: string; messageId: string; reason: string; status: string; createdAt: number; reporter: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null; messageContent: string | null; messageAuthor: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null; }
interface AdminPanelProps { isOpen: boolean; onClose: () => void; }

const ACTION_LABELS: Record<string, string> = { ban: 'Baneó usuario', kick: 'Expulsó usuario', delete_message: 'Eliminó mensaje', role_change: 'Cambió rol', channel_change: 'Modificó canal', mute: 'Silenció usuario', unmute: 'Quitó silencio', server_delete: 'Eliminó servidor' };

export function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<'stats' | 'users' | 'invites' | 'audit' | 'reports'>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { if (!isOpen) return; loadData(); }, [isOpen, tab]);

  async function loadData() {
    setLoading(true); setError('');
    try {
      if (tab === 'stats') { const res = await fetch('/api/admin/stats'); if (res.ok) { const data = await res.json(); setStats(data.stats); } }
      else if (tab === 'users') { const res = await fetch('/api/admin/users'); if (res.ok) { const data = await res.json(); setUsers(data.users); } }
      else if (tab === 'invites') { const res = await fetch('/api/admin/invites'); if (res.ok) { const data = await res.json(); setInvites(data.invites); } }
      else if (tab === 'audit') {
        const srvRes = await fetch('/api/servers');
        if (srvRes.ok) { const srvData = await srvRes.json(); const mainServer = srvData.servers?.find((s: any) => s.isMain === 1) || srvData.servers?.[0];
          if (mainServer) { const res = await fetch(`/api/servers/${mainServer.id}/audit?limit=50`); if (res.ok) { const data = await res.json(); setAuditLogs(data.logs || []); } } }
      } else if (tab === 'reports') {
        const srvRes = await fetch('/api/servers');
        if (srvRes.ok) { const srvData = await srvRes.json(); const mainServer = srvData.servers?.find((s: any) => s.isMain === 1) || srvData.servers?.[0];
          if (mainServer) { const res = await fetch(`/api/servers/${mainServer.id}/reports?status=pending`); if (res.ok) { const data = await res.json(); setReports(data.reports || []); } } }
      }
    } catch { setError('Error al cargar datos'); } finally { setLoading(false); }
  }

  async function handleBan(userId: string) {
    setActionLoading(userId);
    try { const res = await fetch(`/api/admin/users/${userId}/ban`, { method: 'POST' }); if (res.ok) { setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned: 1, status: 'offline' } : u)); } else { const data = await res.json(); setError(data.error || 'Error al banear'); } }
    catch { setError('Error de conexión'); } finally { setActionLoading(null); }
  }

  async function handleGenerateInvite() {
    setActionLoading('generate');
    try { const res = await fetch('/api/admin/invites', { method: 'POST' }); if (res.ok) { const data = await res.json(); setInvites(prev => [{ code: data.code, createdBy: '', usedBy: null, usedAt: null, revoked: 0, createdAt: Date.now() }, ...prev]); } else { const data = await res.json(); setError(data.error || 'Error'); } }
    catch { setError('Error de conexión'); } finally { setActionLoading(null); }
  }

  async function handleRevokeInvite(code: string) {
    setActionLoading(code);
    try { const res = await fetch(`/api/admin/invites/${code}/revoke`, { method: 'DELETE' }); if (res.ok) { setInvites(prev => prev.map(i => i.code === code ? { ...i, revoked: 1 } : i)); } else { const data = await res.json(); setError(data.error || 'Error'); } }
    catch { setError('Error de conexión'); } finally { setActionLoading(null); }
  }

  async function handleReportAction(reportId: string, status: string, action?: string) {
    setActionLoading(reportId);
    try { const res = await fetch(`/api/reports/${reportId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, action }) }); if (res.ok) { setReports(prev => prev.filter(r => r.id !== reportId)); } else { const data = await res.json(); setError(data.error || 'Error'); } }
    catch { setError('Error de conexión'); } finally { setActionLoading(null); }
  }

  function copyToClipboard(text: string) { navigator.clipboard.writeText(text); }
  function formatTime(ts: number) { return new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }

  const tabs = [
    { id: 'stats' as const, label: 'Estadísticas', icon: '[#]' },
    { id: 'users' as const, label: 'Usuarios', icon: '[@]' },
    { id: 'invites' as const, label: 'Invitaciones', icon: '[I]' },
    { id: 'audit' as const, label: 'Auditoría', icon: '[L]' },
    { id: 'reports' as const, label: 'Reportes', icon: '[!]' },
  ];

  const glassCard = { background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '12px' };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,10,20,.8)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
            style={{ background: 'linear-gradient(to bottom, rgba(30,60,90,.95) 0%, rgba(20,40,60,.95) 100%)', border: '2px solid rgba(255,255,255,.2)', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              <div className="flex items-center gap-3"><span className="text-2xl">[A]</span><h2 className="text-xl font-bold text-white">Panel de Administración</h2></div>
              <button onClick={onClose} className="p-2 rounded-lg text-white/60 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,.1)' }}>[X]</button>
            </div>
            <div className="flex px-6 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all relative"
                  style={{ color: tab === t.id ? '#6dd5fa' : 'rgba(255,255,255,.6)' }}>
                  <span>{t.icon}</span>{t.label}
                  {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#6dd5fa' }} />}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 text-sm rounded-lg px-3 py-2" style={{ color: '#ffa694', background: 'rgba(255,100,80,.1)', border: '1px solid rgba(255,100,80,.25)' }}>{error}</motion.div>}
              {loading && <div className="flex items-center justify-center py-12"><div className="w-8 h-8 rounded-full animate-spin" style={{ border: '4px solid rgba(109,213,250,.2)', borderTopColor: '#6dd5fa' }} /></div>}

              {!loading && tab === 'stats' && stats && (
                <div className="grid grid-cols-2 gap-4">
                  {[{ label: 'Usuarios Totales', value: stats.users, icon: '[@]', grad: 'linear-gradient(135deg, #6fc7f0, #1f86c8)' },
                    { label: 'Mensajes Enviados', value: stats.messages, icon: '[M]', grad: 'linear-gradient(135deg, #8fd95f, #4ca22b)' },
                    { label: 'Servidores Creados', value: stats.servers, icon: '[S]', grad: 'linear-gradient(135deg, #c79cff, #7b4cd9)' },
                    { label: 'Invitaciones Activas', value: stats.activeInvites, icon: '[I]', grad: 'linear-gradient(135deg, #6dd5fa, #2980b9)' },
                  ].map(stat => (
                    <div key={stat.label} className="p-5 flex items-center gap-4 rounded-xl transition-colors hover:border-white/20" style={glassCard}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl relative overflow-hidden" style={{ background: stat.grad, boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}>
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,.3) 0%, transparent 50%)' }} />
                        <span className="relative z-10">{stat.icon}</span>
                      </div>
                      <div><p className="text-2xl font-bold text-white">{stat.value.toLocaleString()}</p><p className="text-sm" style={{ color: 'rgba(255,255,255,.6)' }}>{stat.label}</p></div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && tab === 'users' && (
                <div className="space-y-2">
                  {users.length === 0 ? <p className="text-center py-8" style={{ color: 'rgba(255,255,255,.5)' }}>No hay usuarios registrados</p> :
                    users.map(user => (
                      <div key={user.id} className="flex items-center gap-4 p-4 rounded-xl transition-colors hover:border-white/20" style={glassCard}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6dd5fa, #2980b9)' }}>
                          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">{user.displayName || user.username}</p>
                            {user.role === 'admin' && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(109,213,250,.2)', color: '#6dd5fa' }}>ADMIN</span>}
                            {user.isBanned === 1 && <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(255,100,80,.2)', color: '#ffa694' }}>BANEADO</span>}
                          </div>
                          <p className="text-sm" style={{ color: 'rgba(255,255,255,.5)' }}>@{user.username}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: user.status === 'online' ? '#8fd95f' : user.status === 'away' ? '#ffd97a' : user.status === 'dnd' ? '#ffa694' : 'rgba(255,255,255,.3)' }} />
                          {user.role !== 'admin' && user.isBanned === 0 && (
                            <button onClick={() => handleBan(user.id)} disabled={actionLoading === user.id}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                              style={{ color: '#ffa694', background: 'rgba(255,100,80,.1)' }}>
                              {actionLoading === user.id ? '...' : 'Banear'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {!loading && tab === 'invites' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,.6)' }}>Genera códigos de invitación de un solo uso.</p>
                    <button onClick={handleGenerateInvite} disabled={actionLoading === 'generate'}
                      className="an-btn-primary px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50">
                      {actionLoading === 'generate' ? 'Generando...' : '+ Generar Código'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {invites.length === 0 ? <p className="text-center py-8" style={{ color: 'rgba(255,255,255,.5)' }}>No hay invitaciones generadas</p> :
                      invites.map(invite => {
                        const isUsed = invite.usedBy !== null; const isRevoked = invite.revoked === 1; const isActive = !isUsed && !isRevoked;
                        return (
                          <div key={invite.code} className="flex items-center gap-4 p-4 rounded-xl transition-colors"
                            style={{ ...glassCard, opacity: isRevoked ? 0.5 : isUsed ? 0.6 : 1, borderColor: isRevoked ? 'rgba(255,100,80,.3)' : isUsed ? 'rgba(143,217,95,.3)' : 'rgba(109,213,250,.3)' }}>
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm text-white tracking-wider">{invite.code}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.5)' }}>{isRevoked ? 'Revocada' : isUsed ? `Usada el ${new Date(invite.usedAt!).toLocaleDateString('es-ES')}` : `Creada el ${new Date(invite.createdAt).toLocaleDateString('es-ES')}`}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isActive && (<><button onClick={() => copyToClipboard(invite.code)} className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,.7)', background: 'rgba(255,255,255,.1)' }}>Copiar</button>
                                <button onClick={() => handleRevokeInvite(invite.code)} disabled={actionLoading === invite.code} className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50" style={{ color: '#ffa694', background: 'rgba(255,100,80,.1)' }}>{actionLoading === invite.code ? '...' : 'Revocar'}</button></>)}
                              {isUsed && <span className="text-xs font-medium" style={{ color: '#8fd95f' }}>[V] Usada</span>}
                              {isRevoked && <span className="text-xs font-medium" style={{ color: '#ffa694' }}>[X] Revocada</span>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {!loading && tab === 'audit' && (
                <div className="space-y-2">
                  {auditLogs.length === 0 ? <p className="text-center py-8" style={{ color: 'rgba(255,255,255,.5)' }}>No hay registros de auditoría</p> :
                    auditLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 p-4 rounded-xl transition-colors hover:border-white/20" style={glassCard}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, #6dd5fa, #2980b9)' }}>
                          {log.actor?.avatarUrl ? <img src={log.actor.avatarUrl} alt="" className="w-full h-full object-cover" /> : (log.actor?.displayName || log.actor?.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-white text-sm">{log.actor?.displayName || log.actor?.username || 'Desconocido'}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#6dd5fa', background: 'rgba(109,213,250,.15)' }}>{ACTION_LABELS[log.action] || log.action}</span>
                          </div>
                          {log.target && <p className="text-sm" style={{ color: 'rgba(255,255,255,.6)' }}>Objetivo: <span className="text-white">{log.target.displayName || log.target.username}</span></p>}
                          {log.details && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.4)' }}>{log.details.reason || log.details.duration ? `${log.details.duration ? `${log.details.duration} min` : ''}${log.details.reason ? ` - ${log.details.reason}` : ''}` : JSON.stringify(log.details)}</p>}
                          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,.3)' }}>{formatTime(log.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {!loading && tab === 'reports' && (
                <div className="space-y-3">
                  {reports.length === 0 ? <p className="text-center py-8" style={{ color: 'rgba(255,255,255,.5)' }}>No hay reportes pendientes</p> :
                    reports.map(report => (
                      <div key={report.id} className="p-4 rounded-xl" style={glassCard}>
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5" style={{ background: 'rgba(255,100,80,.2)', color: '#ffa694' }}>[!]</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white">Reportado por {report.reporter?.displayName || report.reporter?.username || 'Desconocido'}</span>
                              <span className="text-xs" style={{ color: 'rgba(255,255,255,.4)' }}>{formatTime(report.createdAt)}</span>
                            </div>
                            <p className="text-sm italic" style={{ color: 'rgba(255,255,255,.6)' }}>&ldquo;{report.reason}&rdquo;</p>
                          </div>
                        </div>
                        {report.messageContent && (
                          <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.05)' }}>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden" style={{ background: 'linear-gradient(135deg, #6dd5fa, #2980b9)', color: '#fff' }}>
                                {report.messageAuthor?.avatarUrl ? <img src={report.messageAuthor.avatarUrl} alt="" className="w-full h-full object-cover" /> : (report.messageAuthor?.displayName || '?').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-medium text-white">{report.messageAuthor?.displayName || report.messageAuthor?.username || 'Desconocido'}</span>
                            </div>
                            <p className="text-sm line-clamp-3" style={{ color: 'rgba(255,255,255,.7)' }}>{report.messageContent}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => handleReportAction(report.id, 'dismissed')} disabled={actionLoading === report.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50" style={{ color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.15)' }}>Descartar</button>
                          <button onClick={() => handleReportAction(report.id, 'resolved', 'delete_message')} disabled={actionLoading === report.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50" style={{ color: '#ffa694', border: '1px solid rgba(255,100,80,.3)' }}>Borrar mensaje</button>
                          <button onClick={() => handleReportAction(report.id, 'resolved', 'mute_user')} disabled={actionLoading === report.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50" style={{ color: '#ffd97a', border: '1px solid rgba(255,217,122,.3)' }}>Silenciar autor</button>
                          <button onClick={() => handleReportAction(report.id, 'resolved', 'ban_user')} disabled={actionLoading === report.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50" style={{ color: '#ffa694', border: '1px solid rgba(255,100,80,.3)' }}>Banear autor</button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}