'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Crown, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initialToken = params.get('token') ?? '';

  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setResult({ ok: false, msg: 'As senhas não conferem.' });
      return;
    }
    if (password.length < 8) {
      setResult({ ok: false, msg: 'Senha deve ter ao menos 8 caracteres.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword: password }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, msg: data.message || (res.ok ? 'OK' : 'Erro') });
      if (res.ok) setTimeout(() => router.push('/login'), 2000);
    } catch {
      setResult({ ok: false, msg: 'Erro de conexão.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--surface-0)' }}>
      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="text-center mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
          >
            <Crown className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-white font-bold text-lg">Nova Senha</h1>
          <p className="text-xs text-slate-500 mt-1">Defina sua nova senha segura.</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl p-6 space-y-4"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
        >
          {!initialToken && (
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Token recebido por email"
              required
              className="input font-mono text-xs"
              disabled={loading}
            />
          )}

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nova senha (mín. 8 caracteres)"
              required
              className="input pl-9 pr-10"
              disabled={loading}
            />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" tabIndex={-1}>
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirmar senha"
              required
              className="input pl-9"
              disabled={loading}
            />
          </div>

          {result && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{
                background: result.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: result.ok ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                color: result.ok ? '#34d399' : '#f87171',
              }}
            >
              {result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {result.msg}
            </div>
          )}

          <button type="submit" disabled={loading || (result?.ok ?? false)} className="btn-primary w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redefinir senha'}
          </button>

          <div className="text-center pt-2">
            <Link href="/login" className="text-xs text-slate-500 hover:text-slate-300">Voltar ao login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--surface-0)' }}>
      <div className="rounded-2xl p-6 text-sm text-slate-300"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
        Carregando...
      </div>
    </div>
  );
}
