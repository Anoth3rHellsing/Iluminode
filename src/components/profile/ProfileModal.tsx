'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  status: string;
  role: string;
}

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: string) => void;
}

export function ProfileModal({ user, isOpen, onClose, onStatusChange }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [status, setStatus] = useState(user.status);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(user.bannerUrl);
  const [error, setError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, bio, status }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error al guardar');
        return;
      }
      if (onStatusChange && status !== user.status) {
        onStatusChange(status);
      }
      onClose();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/users/me/avatar', { method: 'POST', body: formData });
      if (!res.ok) { const data = await res.json(); setError(data.error || 'Error al subir avatar'); return; }
      const data = await res.json();
      setAvatarUrl(data.avatarUrl);
    } catch { setError('Error al subir avatar'); } finally { setUploadingAvatar(false); }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/users/me/banner', { method: 'POST', body: formData });
      if (!res.ok) { const data = await res.json(); setError(data.error || 'Error al subir banner'); return; }
      const data = await res.json();
      setBannerUrl(data.bannerUrl);
    } catch { setError('Error al subir banner'); } finally { setUploadingBanner(false); }
  }

  const statusOptions = [
    { value: 'online', label: 'En línea', color: '#8fd95f' },
    { value: 'away', label: 'Ausente', color: '#ffd97a' },
    { value: 'dnd', label: 'No molestar', color: '#ffa694' },
    { value: 'offline', label: 'Desconectado', color: 'rgba(255,255,255,.3)' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,10,20,.8)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(to bottom, rgba(30,60,90,.95) 0%, rgba(20,40,60,.95) 100%)',
              border: '2px solid rgba(255,255,255,.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,.5), 0 0 60px rgba(100,180,255,.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Banner */}
            <div className="relative h-32" style={{ background: 'linear-gradient(135deg, #1a4a7a 0%, #0a2540 100%)' }}>
              {bannerUrl && <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />}
              <button
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploadingBanner}
                className="absolute bottom-2 right-2 px-3 py-1 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}
              >
                {uploadingBanner ? 'Subiendo...' : 'Cambiar banner'}
              </button>
              <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleBannerUpload} />
            </div>

            {/* Avatar */}
            <div className="relative px-6 -mt-10 mb-4">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #6dd5fa 0%, #2980b9 100%)', border: '4px solid rgba(30,60,90,.95)', boxShadow: '0 0 20px rgba(100,180,255,.3)' }}>
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : user.username.charAt(0).toUpperCase()}
                </div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(to bottom, #6dd5fa, #2980b9)', border: '2px solid rgba(255,255,255,.3)' }}
                  title="Cambiar avatar"
                >
                  {uploadingAvatar ? '...' : '[C]'}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarUpload} />
              </div>
              <div className="ml-24 -mt-6">
                <h2 className="text-xl font-bold text-white">{user.displayName || user.username}</h2>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,.6)' }}>@{user.username}</p>
              </div>
            </div>

            {/* Form */}
            <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,.7)' }}>Nombre para mostrar</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50}
                  className="an-input w-full rounded-xl px-4 py-2.5 text-white outline-none transition-all"
                  style={{ background: 'rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.15)' }}
                  placeholder="Tu nombre visible" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,.7)' }}>Biografía</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3}
                  className="an-input w-full rounded-xl px-4 py-2.5 text-white outline-none transition-all resize-none"
                  style={{ background: 'rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.15)' }}
                  placeholder="Cuéntanos algo sobre ti..." />
                <p className="text-xs mt-1 text-right" style={{ color: 'rgba(255,255,255,.4)' }}>{bio.length}/500</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,.7)' }}>Estado</label>
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map((opt) => (
                    <button key={opt.value} onClick={() => setStatus(opt.value)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-200"
                      style={{
                        background: status === opt.value ? 'rgba(109,213,250,.15)' : 'rgba(0,0,0,.2)',
                        border: status === opt.value ? '2px solid rgba(109,213,250,.5)' : '2px solid rgba(255,255,255,.1)',
                        color: status === opt.value ? '#6dd5fa' : 'rgba(255,255,255,.7)',
                        boxShadow: status === opt.value ? '0 0 12px rgba(100,180,255,.2)' : 'none',
                      }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: opt.color }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-sm rounded-xl px-3 py-2"
                  style={{ color: '#ffa694', background: 'rgba(255,100,80,.1)', border: '1px solid rgba(255,100,80,.25)' }}>
                  {error}
                </motion.p>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors"
                  style={{ color: 'rgba(255,255,255,.7)', border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.05)' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="an-btn-primary flex-1 px-4 py-2.5 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}