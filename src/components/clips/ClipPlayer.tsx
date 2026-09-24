'use client';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { ClipData } from './ClipsPanel';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  createdAt: number;
}

interface ClipPlayerProps {
  clip: ClipData;
  onClose: () => void;
  onUpdate: () => void;
}

export function ClipPlayer({ clip, onClose, onUpdate }: ClipPlayerProps) {
  const [liked, setLiked] = useState(clip.userLiked);
  const [likes, setLikes] = useState(clip.likes);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function loadComments() {
      try {
        const res = await fetch(`/api/clips/${clip.id}/comments`);
        if (res.ok) {
          const data = await res.json();
          setComments(data.comments);
        }
      } catch (err) {
        console.error('Failed to load comments:', err);
      } finally {
        setLoadingComments(false);
      }
    }
    loadComments();
  }, [clip.id]);

  const handleLike = async () => {
    try {
      const res = await fetch(`/api/clips/${clip.id}/like`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLikes(data.likes);
        onUpdate();
      }
    } catch (err) {
      console.error('Like failed:', err);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clips/${clip.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [data.comment, ...prev]);
        setCommentInput('');
        onUpdate();
      }
    } catch (err) {
      console.error('Comment failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/clips/${clip.id}`, { method: 'DELETE' });
      if (res.ok) {
        onClose();
        onUpdate();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const avatarGrad = { background: 'linear-gradient(135deg, #6dd5fa, #2980b9)' };

  return (
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
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl"
        style={{ background: 'linear-gradient(to bottom, rgba(30,60,90,.95) 0%, rgba(20,40,60,.95) 100%)', border: '2px solid rgba(255,255,255,.2)', boxShadow: '0 20px 60px rgba(0,0,0,.5), 0 0 60px rgba(100,180,255,.1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Video Player */}
        <div className="relative aspect-video flex-shrink-0" style={{ background: '#000' }}>
          <video ref={videoRef} src={clip.videoUrl} controls autoPlay className="w-full h-full object-contain" />
          <button onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors"
            style={{ background: 'rgba(0,0,0,.5)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,.7)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,.5)')}>
            [X]
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title & Author */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">{clip.title}</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden" style={avatarGrad}>
                  {clip.author.avatarUrl ? <img src={clip.author.avatarUrl} alt="" className="w-full h-full object-cover" /> : clip.author.displayName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{clip.author.displayName}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,.6)' }}>@{clip.author.username}</p>
                </div>
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,.5)' }}>{formatTime(clip.createdAt)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,.1)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <button onClick={handleLike}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: liked ? 'rgba(255,100,80,.2)' : 'rgba(0,0,0,.2)',
                color: liked ? '#ffa694' : 'rgba(255,255,255,.7)',
                border: liked ? '1px solid rgba(255,100,80,.3)' : '1px solid rgba(255,255,255,.1)',
              }}
              onMouseEnter={e => { if (!liked) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,.1)'; } }}
              onMouseLeave={e => { if (!liked) { e.currentTarget.style.color = 'rgba(255,255,255,.7)'; e.currentTarget.style.background = 'rgba(0,0,0,.2)'; } }}>
              <span>{liked ? '[<3]' : '[ ]'}</span>
              <span>{likes}</span>
            </button>
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm" style={{ color: 'rgba(255,255,255,.6)' }}>
              [M] {comments.length}
            </span>
            <button onClick={handleDelete}
              className="ml-auto px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ color: '#ffa694' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,100,80,.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              Eliminar
            </button>
          </div>

          {/* Comments */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Comentarios</h3>

            <form onSubmit={handleComment} className="flex gap-2">
              <input type="text" value={commentInput} onChange={e => setCommentInput(e.target.value)}
                placeholder="Escribe un comentario..." maxLength={500}
                className="an-input flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none transition-all"
                style={{ background: 'rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.15)' }} />
              <button type="submit" disabled={!commentInput.trim() || submitting}
                className="an-btn-primary px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50">
                {submitting ? '...' : 'Enviar'}
              </button>
            </form>

            {loadingComments ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,.4)' }}>Cargando comentarios...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,.4)' }}>Sin comentarios aún</p>
            ) : (
              <div className="space-y-2">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-2 p-2 rounded-lg" style={{ background: 'rgba(0,0,0,.2)' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white overflow-hidden flex-shrink-0" style={avatarGrad}>
                      {comment.author.avatarUrl ? <img src={comment.author.avatarUrl} alt="" className="w-full h-full object-cover" /> : comment.author.displayName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{comment.author.displayName}</span>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,.5)' }}>{formatTime(comment.createdAt)}</span>
                      </div>
                      <p className="text-sm break-words" style={{ color: 'rgba(255,255,255,.7)' }}>{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}