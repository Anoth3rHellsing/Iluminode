'use client';
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++toastIdCounter}`;
    setToasts(prev => [...prev, { id, message, type }]);
    const timer = setTimeout(() => removeToast(id), 4000);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const iconForType = (type: ToastType) => {
    switch (type) {
      case 'success': return '[V]';
      case 'error': return '[X]';
      case 'warning': return '[!]';
      case 'info': return 'ℹ';
    }
  };

  const styleForType = (type: ToastType) => {
    switch (type) {
      case 'success': return { borderColor: 'rgba(143,217,95,.5)', background: 'rgba(143,217,95,.1)', color: '#8fd95f' };
      case 'error': return { borderColor: 'rgba(255,166,148,.5)', background: 'rgba(255,100,80,.1)', color: '#ffa694' };
      case 'warning': return { borderColor: 'rgba(255,217,122,.5)', background: 'rgba(255,217,122,.1)', color: '#ffd97a' };
      case 'info': return { borderColor: 'rgba(109,213,250,.5)', background: 'rgba(109,213,250,.1)', color: '#6dd5fa' };
    }
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md cursor-pointer"
              style={{ ...styleForType(t.type), boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}
              onClick={() => removeToast(t.id)}
            >
              <span className="text-base font-bold flex-shrink-0">{iconForType(t.type)}</span>
              <p className="text-sm font-medium flex-1" style={{ color: '#fff' }}>{t.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}