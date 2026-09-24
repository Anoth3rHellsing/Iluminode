'use client';
import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateStoryButtonProps {
  onCreated: () => void;
}

export function CreateStoryButton({ onCreated }: CreateStoryButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/stories', { method: 'POST', body: formData });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Error al subir historia');
        return;
      }

      onCreated();
    } catch {
      setError('Error de conexión');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm"
            style={{ background: 'rgba(255,100,80,.9)', color: '#fff', border: '1px solid rgba(255,166,148,.5)' }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      {uploading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,10,20,.7)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-xl px-6 py-4 flex items-center gap-3"
            style={{
              background: 'linear-gradient(to bottom, rgba(30,60,90,.95) 0%, rgba(20,40,60,.95) 100%)',
              border: '2px solid rgba(255,255,255,.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,.5), 0 0 30px rgba(100,180,255,.2)',
            }}>
            <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid rgba(109,213,250,.2)', borderTopColor: '#6dd5fa' }} />
            <span className="font-medium text-white">Subiendo historia...</span>
          </div>
        </div>
      )}
    </>
  );
}