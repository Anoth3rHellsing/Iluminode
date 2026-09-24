'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string }) => void;
  onJoin?: (code: string) => void;
}

export function CreateServerModal({ isOpen, onClose, onCreate, onJoin }: CreateServerModalProps) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim() });
    setName('');
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim() || !onJoin) return;
    onJoin(joinCode.trim());
    setJoinCode('');
  }

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
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(to bottom, rgba(30,60,90,.95) 0%, rgba(20,40,60,.95) 100%)',
              border: '2px solid rgba(255,255,255,.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              <h2 className="text-xl font-bold text-white">{mode === 'create' ? 'Crear servidor' : 'Unirse a servidor'}</h2>
              <button onClick={onClose} className="p-2 rounded-lg text-white/60 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,.1)' }}>[X]</button>
            </div>

            <div className="flex gap-1 mx-6 mt-4 rounded-xl p-1" style={{ background: 'rgba(0,0,0,.3)' }}>
              <button onClick={() => setMode('create')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'create' ? 'an-btn-primary text-white' : 'text-white/60 hover:text-white/90'}`}>Crear</button>
              {onJoin && <button onClick={() => setMode('join')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'join' ? 'an-btn-primary text-white' : 'text-white/60 hover:text-white/90'}`}>Unirse</button>}
            </div>

            <div className="p-6">
              {mode === 'create' ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,.7)' }}>Nombre del servidor</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Mi Servidor"
                      maxLength={100}
                      className="an-input w-full rounded-xl px-4 py-3 text-white outline-none"
                      style={{ background: 'rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.15)' }}
                      autoFocus
                    />
                  </div>
                  <button type="submit" disabled={!name.trim()} className="an-btn-primary w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Crear Servidor</button>
                </form>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,.7)' }}>Código de invitación</label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="XXXXXXXXXXXX"
                      className="an-input w-full rounded-xl px-4 py-3 text-white outline-none"
                      style={{ background: 'rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.15)' }}
                      autoFocus
                    />
                  </div>
                  <button type="submit" disabled={!joinCode.trim()} className="an-btn-primary w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Unirse</button>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}