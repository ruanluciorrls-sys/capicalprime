'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Crown, Mail, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; devToken?: string; devLink?: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      setResult({
        ok: res.ok,
        msg: data.message || (res.ok ? 'Pedido enviado.' : 'Erro.'),
        devToken: data.devToken,
        devLink: data.devLink,
      });
    } catch {
      setResult({ ok: false, msg: 'Erro de conexão.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--surface-0)' }}>
      <div className="relative w-full max-w-sm animate-fade-in">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
        </Link>

        <div className="text-center mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 20px rgba(245,158,11,0.4)' }}
          >
            <Crown className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-white font-bold text-lg">Recuperar Senha</h1>
          <p className="text-xs text-slate-500 mt-1">Informe seu email para receber o link de redefinição.</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl p-6 space-y-4"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="input pl-9"
              disabled={loading || (result?.ok ?? false)}
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
              <div className="flex-1">
                <p>{result.msg}</p>
                {result.devLink && (
                  <div className="mt-2 pt-2 border-t border-slate-700">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Link (DEV):</p>
                    <Link
                      href={result.devLink}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      Clique aqui para resetar
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {!result?.ok && (
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar link'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
