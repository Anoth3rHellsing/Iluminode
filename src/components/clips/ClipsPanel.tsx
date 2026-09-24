'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipPlayer } from './ClipPlayer';

interface ClipAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ClipData {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  likes: number;
  author: ClipAuthor;
  commentCount: number;
  userLiked: boolean;
  createdAt: number;
}

interface ClipsPanelProps {
  serverId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ClipsPanel({ serverId, isOpen, onClose }: ClipsPanelProps) {
  const [clips, setClips] = useState<ClipData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedClip, setSelectedClip] = useState<ClipData | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const LIMIT = 20;

  const loadClips = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    try {
      const res = await fetch(`/api/servers/${serverId}/clips?limit=${LIMIT}&offset=${currentOffset}`);
      if (res.ok) {
        const data = await res.json();
        if (reset) {
          setClips(data.clips);
        } else {
          setClips(prev => [...prev, ...data.clips]);
        }
        setHasMore(data.clips.length === LIMIT);
        setOffset(currentOffset + data.clips.length);
      }
    } catch (err) {
      console.error('Failed to load clips:', err);
    } finally {
      setLoading(false);
    }
  }, [serverId, offset, loading]);

  useEffect(() => {
    if (isOpen) {
      setClips([]);
      setOffset(0);
      setHasMore(true);
      loadClips(true);
    }
  }, [isOpen, serverId]);

  const handleLoadMore = () => {
    if (!loading && hasMore) loadClips(false);
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim());
      const res = await fetch(`/api/servers/${serverId}/clips`, { method: 'POST', body: formData });
      if (res.ok) {
        setShowUpload(false);
        setUploadTitle('');
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setClips([]);
        setOffset(0);
        setHasMore(true);
        loadClips(true);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleClipUpdate = () => {
    if (selectedClip) {
      fetch(`/api/servers/${serverId}/clips?limit=1&offset=0`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setClips(prev => prev.map(c => c.id === selectedClip.id ? data.clips.find((x: ClipData) => x.id === c.id) || c : c));
          }
        });
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;
    if (diff < 60000) return 'ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  if (!isOpen) return null;

  const glassCard = { background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '12px' };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-20 flex flex-col"
        style={{ background: 'radial-gradient(ellipse at 50% 120%, #1a4a7a 0%, #0a2540 40%, #051525 100%)' }}
      >
        {/* Header */}
        <div className="h-14 flex items-center px-4 gap-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,.1)', background: 'rgba(0,20,40,.6)' }}>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,.7)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.7)'; e.currentTarget.style.background = 'transparent'; }}>
            ←
          </button>
          <span className="text-xl">[&gt;]</span>
          <h3 className="font-semibold text-white flex-1">Clips</h3>
          <button
            onClick={() => setShowUpload(true)}
            className="an-btn-primary px-3 py-1.5 rounded-lg text-white text-sm font-medium"
          >
            + Subir clip
          </button>
        </div>

        {/* Upload Form */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
              style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}
            >
              <div className="p-4 space-y-3" style={{ background: 'rgba(0,20,40,.4)' }}>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Título del clip"
                  maxLength={100}
                  className="an-input w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                  style={{ background: 'rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.15)' }}
                />
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg p-4 text-center transition-colors"
                      style={{
                        borderColor: uploadFile ? 'rgba(109,213,250,.5)' : 'rgba(255,255,255,.15)',
                        background: uploadFile ? 'rgba(109,213,250,.05)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!uploadFile) e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)'; }}
                      onMouseLeave={e => { if (!uploadFile) e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)'; }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={e => setUploadFile(e.target.files?.[0] || null)}
                      />
                      {uploadFile ? (
                        <p className="text-sm font-medium truncate" style={{ color: '#6dd5fa' }}>{uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                      ) : (
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,.5)' }}>Haz clic para seleccionar un video (mp4, webm, mov)</p>
                      )}
                    </div>
                  </label>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowUpload(false); setUploadTitle(''); setUploadFile(null); }}
                    className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                    style={{ color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.15)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.6)'; e.currentTarget.style.background = 'transparent'; }}>
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!uploadFile || !uploadTitle.trim() || uploading}
                    className="an-btn-primary px-4 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  >
                    {uploading ? 'Subiendo...' : 'Subir'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Clips Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {clips.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: 'rgba(255,255,255,.4)' }}>
              <p className="text-4xl mb-4">[&gt;]</p>
              <p>No hay clips aún. ¡Sube el primero!</p>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {clips.map(clip => (
              <motion.div
                key={clip.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedClip(clip)}
                className="group cursor-pointer overflow-hidden an-tile-hover"
                style={glassCard}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(109,213,250,.5)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(100,180,255,.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {/* Thumbnail / Video Preview */}
                <div className="aspect-video relative overflow-hidden" style={{ background: 'rgba(0,0,0,.3)' }}>
                  {clip.thumbnailUrl ? (
                    <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl" style={{ color: 'rgba(255,255,255,.2)' }}>
                      [V]
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center transition-colors"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,.2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(4px)', color: '#fff' }}>
                      ▶
                    </div>
                  </div>
                </div>
                {/* Info */}
                <div className="p-3 space-y-2">
                  <h4 className="text-sm font-medium text-white truncate">{clip.title}</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #6dd5fa, #2980b9)', color: '#fff' }}>
                      {clip.author.avatarUrl ? <img src={clip.author.avatarUrl} alt="" className="w-full h-full object-cover" /> : clip.author.displayName.charAt(0)}
                    </div>
                    <span className="text-xs truncate" style={{ color: 'rgba(255,255,255,.6)' }}>{clip.author.displayName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,.5)' }}>
                    <span className="flex items-center gap-1">[&lt;3] {clip.likes}</span>
                    <span className="flex items-center gap-1">[M] {clip.commentCount}</span>
                    <span className="ml-auto">{formatTime(clip.createdAt)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          {hasMore && clips.length > 0 && (
            <div className="mt-4 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                style={{ color: 'rgba(255,255,255,.6)', border: '1px solid rgba(255,255,255,.15)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.6)'; e.currentTarget.style.background = 'transparent'; }}
              >
                {loading ? 'Cargando...' : 'Cargar más'}
              </button>
            </div>
          )}
          {loading && clips.length === 0 && (
            <div className="flex items-center justify-center py-12" style={{ color: 'rgba(255,255,255,.4)' }}>
              <p>Cargando clips...</p>
            </div>
          )}
        </div>

        {/* Clip Player Modal */}
        {selectedClip && (
          <ClipPlayer
            clip={selectedClip}
            onClose={() => setSelectedClip(null)}
            onUpdate={handleClipUpdate}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}