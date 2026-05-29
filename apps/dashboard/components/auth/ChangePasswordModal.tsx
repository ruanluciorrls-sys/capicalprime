'use client';

import { useState } from 'react';
import { authHeaders } from '@/lib/apiKey';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (next !== confirm) {
      setResult({ ok: false, msg: 'As senhas novas não conferem.' });
      return;
    }
    if (next.length < 8) {
      setResult({ ok: false, msg: 'Nova senha deve ter ao menos 8 caracteres.' });
      return;
    }
    if (next === current) {
      setResult({ ok: false, msg: 'A nova senha deve ser diferente da atual.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      setResult({ ok: res.ok, msg: data.message || (res.ok ? 'Senha alterada.' : 'Erro') });
      if (res.ok) {
        setCurrent(''); setNext(''); setConfirm('');
        setTimeout(() => onClose(), 1800);
      }
    } catch {
      setResult({ ok: false, msg: 'Erro de conexão.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl w-full max-w-sm my-auto"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.8)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 rounded-t-2xl"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <h2 className="text-white font-bold text-base">Alterar Senha</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <Field label="Senha atual">
            <input
              type={show ? 'text' : 'password'}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              className="input"
              disabled={loading || result?.ok}
            />
          </Field>

          <Field label="Nova senha (mín. 8 caracteres)">
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={next}
                onChange={e => setNext(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="input pr-10"
                disabled={loading || result?.ok}
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                tabIndex={-1}
              >
                {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </Field>

          <Field label="Confirmar nova senha">
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="input"
              disabled={loading || result?.ok}
            />
          </Field>

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

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={loading || result?.ok} className="btn-primary flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Alterar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
