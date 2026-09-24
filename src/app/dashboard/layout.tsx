'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/');
          return;
        }
      } catch {
        router.push('/');
        return;
      }
      setLoading(false);
    }
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 120%, #1a4a7a 0%, #0a2540 40%, #051525 100%)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full animate-spin" style={{ border: '4px solid rgba(109,213,250,.2)', borderTopColor: '#6dd5fa' }} />
          <p className="text-sm animate-pulse" style={{ color: 'rgba(255,255,255,.6)' }}>Cargando iluminode...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}