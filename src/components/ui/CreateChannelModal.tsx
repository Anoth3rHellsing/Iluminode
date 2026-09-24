'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; type: 'text' | 'voice' | 'media'; gradient?: string; isPrivate: boolean }) => void;
}

const channelTypes = [
  { value: 'text' as const, label: 'Texto', icon: '#', desc: 'Envía mensajes, imágenes, GIFs y archivos' },
  { value: 'voice' as const, label: 'Voz', icon: '[V]', desc: 'Reúnete con voz y video en tiempo real' },
  { value: 'media' as const, label: 'Media / Foro', icon: '[M]', desc: 'Comparte contenido multimedia y discusiones' },
];

const gradients = [
  null,
  'linear-gradient(135deg, #6dd5fa 0%, #2980b9 100%)',
  'linear-gradient(135deg, #8fd95f 0%, #4ca22b 100%)',
  'linear-gradient(135deg, #ffd97a 0%, #e08c1e 100%)',
  'linear-gradient(135deg, #ffa694 0%, #c63c22 100%)',
  'linear-gradient(135deg, #c79cff 0%, #7b4cd9 100%)',
  'linear-gradient(135deg, #7fffff 0%, #00b8b8 100%)',
];

export function CreateChannelModal({ isOpen, onClose, onCreate }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice' | 'media'>('text');
  const [gradient, setGradient] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      type,
      gradient: gradient || undefined,
      isPrivate,
    });
    setName('');
    setType('text');
    setGradient(null);
    setIsPrivate(false);
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
            className="w-full max-w-lg rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(to bottom, rgba(30,60,90,.95) 0%, rgba(20,40,60,.95) 100%)',
              border: '2px solid rgba(255,255,255,.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>
              <h2 className="text-xl font-bold text-white">Crear un canal</h2>
              <button onClick={onClose} className="p-2 rounded-lg text-white/60 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,.1)' }}>[X]</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,.7)' }}>Tipo de canal</label>
                <div className="space-y-2">
                  {channelTypes.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className="w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200"
                      style={{
                        background: type === t.value ? 'rgba(109,213,250,.15)' : 'rgba(0,0,0,.2)',
                        border: type === t.value ? '2px solid rgba(109,213,250,.5)' : '2px solid rgba(255,255,255,.1)',
                        boxShadow: type === t.value ? '0 0 12px rgba(100,180,255,.2)' : 'none',
                      }}
                    >
                      <span className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: 'rgba(255,255,255,.1)' }}>{t.icon}</span>
                      <div className="text-left">
                        <p className="font-medium text-white">{t.label}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,.5)' }}>{t.desc}</p>
                      </div>
                      {type === t.value && <span className="ml-auto" style={{ color: '#6dd5fa' }}>[V]</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,.7)' }}>Nombre del canal</label>
                <div className="flex items-center rounded-xl px-3 an-input" style={{ background: 'rgba(0,0,0,.3)', border: '2px solid rgba(255,255,255,.15)' }}>
                  <span className="mr-2" style={{ color: 'rgba(255,255,255,.5)' }}>#</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="nuevo-canal"
                    maxLength={100}
                    className="flex-1 bg-transparent py-2.5 text-white outline-none"
                    style={{ color: '#fff' }}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(255,255,255,.7)' }}>Color del canal (opcional)</label>
                <div className="flex gap-2 flex-wrap">
                  {gradients.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setGradient(g)}
                      className="w-10 h-10 rounded-lg transition-all"
                      style={{
                        background: g || 'rgba(255,255,255,.1)',
                        border: gradient === g ? '2px solid #6dd5fa' : '2px solid rgba(255,255,255,.15)',
                        transform: gradient === g ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: gradient === g ? '0 0 12px rgba(100,180,255,.3)' : 'none',
                      }}
                    >
                      {!g && <span className="text-xs" style={{ color: 'rgba(255,255,255,.4)' }}>∅</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.1)' }}>
                <div>
                  <p className="font-medium text-white text-sm">Canal privado</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,.5)' }}>Solo miembros seleccionados pueden verlo</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivate(!isPrivate)}
                  className="w-11 h-6 rounded-full transition-colors relative"
                  style={{ background: isPrivate ? '#6dd5fa' : 'rgba(255,255,255,.2)' }}
                >
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ left: isPrivate ? '22px' : '2px' }} />
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white/70 hover:text-white transition-colors" style={{ border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.05)' }}>Cancelar</button>
                <button type="submit" disabled={!name.trim()} className="an-btn-primary flex-1 px-4 py-2.5 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Crear Canal</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}