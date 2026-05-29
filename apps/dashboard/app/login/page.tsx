'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Crown, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { setAuthToken } from '@/lib/apiKey';
import { APP_VERSION_LABEL } from '@/lib/version';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || 'Erro ao autenticar.');
        return;
      }
      setAuthToken(data.token, data.user);
      router.push('/dashboard');
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'var(--surface-0)' }}
    >
      {/* Decorative gold glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #f59e0b, transparent 70%)' }}
      />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 hover:scale-105 transition-transform"
            style={{
              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
              boxShadow: '0 8px 32px rgba(245,158,11,0.5)',
            }}
          >
            <Crown className="w-7 h-7 text-white" />
          </div>
          <h1
            className="gold-text text-2xl font-black tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Capital Prime
          </h1>
          <p className="section-label mt-1 text-[10px]">Pix Dashboard · Acesso Restrito</p>
        </div>

        {/* Card */}
        <form
          onSubmit={submit}
          className="rounded-2xl p-7 space-y-5"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 20px 60px -20px rgba(0,0,0,0.7)',
          }}
        >
          <h2 className="text-white font-bold text-base">Entrar</h2>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className="input pl-9"
                disabled={loading}
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="input pl-9 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="text-center pt-2">
            <Link href="/forgot-password" className="text-xs text-amber-500/70 hover:text-amber-400 transition-colors">
              Esqueci minha senha
            </Link>
          </div>
        </form>

        <p className="text-center text-[10px] text-slate-600 mt-6 tracking-wider uppercase">
          © 2026 Capital Prime · Acesso por assinatura
        </p>
        <p className="text-center text-[10px] text-slate-700 mt-1 font-mono tracking-widest">
          Sistema {APP_VERSION_LABEL}
        </p>
      </div>
    </div>
  );
}
