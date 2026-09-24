'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function seededRandom(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

function WaveBackground() {
  const stars = useMemo(() => {
    const rng = seededRandom(42);
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: `${rng() * 100}%`,
      top: `${rng() * 100}%`,
      delay: `${rng() * 3}s`,
      size: `${1 + rng() * 2}px`,
    }));
  }, []);

  return (
    <div className="an-wave-bg">
      {stars.map(s => (
        <div key={s.id} className="an-star" style={{ left: s.left, top: s.top, animationDelay: s.delay, width: s.size, height: s.size }} />
      ))}
      <div className="absolute bottom-0 left-0 w-[200%] h-full animate-an-wave1 opacity-[.15] pointer-events-none">
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-full">
          <path fill="rgba(109,213,250,.3)" d="M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,218.7C672,213,768,171,864,165.3C960,160,1056,192,1152,197.3C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
      </div>
      <div className="absolute bottom-0 left-0 w-[200%] h-full animate-an-wave2 opacity-[.1] pointer-events-none">
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-full">
          <path fill="rgba(109,213,250,.2)" d="M0,288L48,272C96,256,192,224,288,213.3C384,203,480,213,576,229.3C672,245,768,267,864,261.3C960,256,1056,224,1152,208C1248,192,1344,192,1392,192L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
        </svg>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const inviteCode = formData.get('inviteCode') as string | undefined;

    try {
      const url = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body: Record<string, string> = { username, password };
      if (!isLogin && inviteCode) body.inviteCode = inviteCode;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error inesperado');
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <WaveBackground />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold tracking-tight inline-block px-4 py-2"
            style={{
              color: '#fff',
              textShadow: '0 2px 12px rgba(100,180,255,.6), 0 0 40px rgba(100,180,255,.3)',
              fontStyle: 'italic',
            }}>
            iluminode
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,.6)' }}>
            A.N.O.T.H.E.R. Private
          </p>
        </div>

        {/* Auth Card — glass tile */}
        <div className="rounded-2xl p-8 an-glass-panel"
          style={{ boxShadow: '0 8px 40px rgba(0,0,0,.4), 0 0 60px rgba(100,180,255,.1)' }}>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 rounded-xl p-1" style={{ background: 'rgba(0,0,0,.3)' }}>
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                isLogin ? 'an-btn-primary text-white' : 'text-white/60 hover:text-white/90'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                !isLogin ? 'an-btn-primary text-white' : 'text-white/60 hover:text-white/90'
              }`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,.7)' }}>
                Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                className="an-input w-full rounded-xl px-4 py-3 text-white outline-none transition-all duration-200"
                style={{
                  background: 'rgba(0,0,0,.3)',
                  border: '2px solid rgba(255,255,255,.15)',
                }}
                placeholder="tu_usuario"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,.7)' }}>
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="an-input w-full rounded-xl px-4 py-3 text-white outline-none transition-all duration-200"
                style={{
                  background: 'rgba(0,0,0,.3)',
                  border: '2px solid rgba(255,255,255,.15)',
                }}
                placeholder="••••••••"
              />
            </div>

            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div>
                    <label htmlFor="inviteCode" className="block text-sm font-medium mb-1.5" style={{ color: 'rgba(255,255,255,.7)' }}>
                      Código de Invitación
                    </label>
                    <input
                      id="inviteCode"
                      name="inviteCode"
                      type="text"
                      className="an-input w-full rounded-xl px-4 py-3 text-white outline-none transition-all duration-200"
                      style={{
                        background: 'rgba(0,0,0,.3)',
                        border: '2px solid rgba(255,255,255,.15)',
                      }}
                      placeholder="XXXXXXXXXXXX"
                    />
                    <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,.4)' }}>
                      El primer usuario no necesita código
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm rounded-xl px-4 py-3"
                style={{
                  color: '#ffa694',
                  background: 'rgba(255,100,80,.1)',
                  border: '1px solid rgba(255,100,80,.25)',
                }}
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="an-btn-primary w-full text-white font-bold py-3 rounded-xl text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Procesando...' : isLogin ? 'Entrar' : 'Crear Cuenta'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,.3)' }}>
          Plataforma privada · Solo por invitación
        </p>
      </motion.div>
    </div>
  );
}