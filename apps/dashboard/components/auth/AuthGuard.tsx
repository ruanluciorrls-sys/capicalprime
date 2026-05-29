'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken, getAuthUser, clearAuth, AuthUser } from '@/lib/apiKey';
import { Loader2, Crown } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  requireRole?: AuthUser['role'][];
}

/**
 * Bloqueia acesso à rota se:
 *  - não autenticado → redireciona /login
 *  - role insuficiente → mostra tela de "acesso negado"
 *
 * Faz validação do /auth/me em mount para detectar sessão revogada cedo.
 */
export function AuthGuard({ children, requireRole }: Props) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden'>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  // Estabiliza requireRole para evitar re-run do effect quando o pai
  // passa um array literal novo a cada render (ex: requireRole={['MASTER_ADMIN','ADMIN']}).
  // Sem isso, o fetch /auth/me dispara em loop e causa re-renders constantes que
  // quebram formularios filhos (perda de foco / reset de state).
  const requireRoleKey = requireRole?.join(',') ?? '';

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    const roles = requireRoleKey ? requireRoleKey.split(',') as AuthUser['role'][] : null;

    // Valida sessão
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (!res.ok) {
          clearAuth();
          router.replace('/login');
          return;
        }
        const u = await res.json();
        setUser(u);

        if (roles && roles.length > 0 && !roles.includes(u.role)) {
          setState('forbidden');
          return;
        }
        setState('ok');
      })
      .catch(() => {
        // Sem backend, deixa passar pra não travar o dev (mas idealmente bloquearia)
        const cached = getAuthUser();
        if (!cached) {
          clearAuth();
          router.replace('/login');
          return;
        }
        if (roles && roles.length > 0 && !roles.includes(cached.role)) {
          setState('forbidden');
          return;
        }
        setUser(cached);
        setState('ok');
      });
  }, [router, requireRoleKey]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: 'var(--surface-0)' }}>
        <Crown className="w-10 h-10 text-amber-500 animate-pulse" />
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
        <p className="text-xs text-slate-600 tracking-widest uppercase">Verificando sessão...</p>
      </div>
    );
  }

  if (state === 'forbidden') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ background: 'var(--surface-0)' }}>
        <div className="text-center max-w-sm">
          <Crown className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h1 className="text-white font-bold text-lg mb-2">Acesso Restrito</h1>
          <p className="text-sm text-slate-400">
            Esta área é exclusiva para administradores. Sua conta ({user?.role}) não tem permissão.
          </p>
          <button onClick={() => router.replace('/dashboard')} className="btn-outline mt-4">
            Voltar ao dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
