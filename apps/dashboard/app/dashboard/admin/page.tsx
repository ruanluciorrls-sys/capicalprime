'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { authHeaders } from '@/lib/apiKey';
import {
  Crown, Plus, Search, Loader2, Shield, User, Eye, Trash2, RotateCcw,
  CalendarPlus, KeyRound, CheckCircle2, XCircle, AlertCircle, X, Settings as Cog, Mail,
} from 'lucide-react';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'MASTER_ADMIN' | 'ADMIN' | 'USER' | 'VIEWER';
  features: string[] | null;
  isActive: boolean;
  subscriptionExpiresAt: string | null;
  subscriptionDaysRemaining: number | null;
  hasActiveSession: boolean;
  apiKey: string;
  lastLoginAt: string | null;
  createdAt: string;
}

import { FEATURE_LABELS, ALL_FEATURES } from '@/lib/featureLabels';
import { APP_VERSION_LABEL } from '@/lib/version';

function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/users?${search ? `search=${encodeURIComponent(search)}&` : ''}limit=100`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) setUsers(data.items ?? []);
      else setToast({ ok: false, msg: data.message || 'Falha ao carregar' });
    } catch {
      setToast({ ok: false, msg: 'Erro de conexão' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleExtend = async (id: string, days: number) => {
    const res = await fetch(`/api/admin/users/${id}/extend-subscription`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    if (res.ok) {
      setToast({ ok: true, msg: `Assinatura estendida em ${days} dias.` });
      load();
    } else {
      const e = await res.json().catch(() => ({}));
      setToast({ ok: false, msg: e.message || 'Falha ao estender' });
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Desconectar este usuário de todos os dispositivos?')) return;
    const res = await fetch(`/api/admin/users/${id}/revoke-session`, {
      method: 'POST', headers: authHeaders(),
    });
    if (res.ok) { setToast({ ok: true, msg: 'Sessão revogada.' }); load(); }
    else setToast({ ok: false, msg: 'Falha ao revogar' });
  };

  const handleDelete = async (u: AdminUser) => {
    if (!confirm(`Excluir DEFINITIVAMENTE o usuário ${u.email}?`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (res.ok) { setToast({ ok: true, msg: 'Usuário excluído.' }); load(); }
    else {
      const e = await res.json().catch(() => ({}));
      setToast({ ok: false, msg: e.message || 'Falha ao excluir' });
    }
  };

  const handleResetPassword = async (id: string, email: string) => {
    if (!confirm(`Enviar email de recuperação de senha para ${email}?`)) return;
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST', headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      setToast({ ok: true, msg: `Email de reset enviado para ${email}.` });
      // Em DEV, mostra o link também
      if (data.devLink) {
        alert(`DEV LINK:\n${data.devLink}`);
      }
    } else {
      const e = await res.json().catch(() => ({}));
      setToast({ ok: false, msg: e.message || 'Falha ao enviar reset' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.4)' }}
          >
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Painel Master Admin</h1>
              <span
                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md tracking-wider"
                style={{
                  background: 'rgba(245,158,11,0.10)',
                  border: '1px solid rgba(245,158,11,0.28)',
                  color: '#fbbf24',
                }}
                title="Versão do sistema"
              >
                {APP_VERSION_LABEL}
              </span>
            </div>
            <p className="text-xs text-slate-500">Gerencie usuários, assinaturas e permissões</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo usuário
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
        <input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') load(); }}
          className="input pl-9"
        />
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm animate-slide-in-right"
          style={{
            background: toast.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            border: toast.ok ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
            color: toast.ok ? '#34d399' : '#f87171',
            backdropFilter: 'blur(10px)',
          }}
        >
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* User cards */}
      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-slate-500">Nenhum usuário encontrado.</div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <UserRow
              key={u.id}
              user={u}
              onExtend={(days) => handleExtend(u.id, days)}
              onRevoke={() => handleRevoke(u.id)}
              onDelete={() => handleDelete(u)}
              onEdit={() => setEditing(u)}
              onResetPassword={() => handleResetPassword(u.id, u.email)}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); setToast({ ok: true, msg: 'Usuário criado.' }); }} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); setToast({ ok: true, msg: 'Usuário atualizado.' }); }} />}
    </div>
  );
}

function UserRow({ user, onExtend, onRevoke, onDelete, onEdit, onResetPassword }: {
  user: AdminUser;
  onExtend: (days: number) => void;
  onRevoke: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const roleConfig = {
    MASTER_ADMIN: { color: '#fcd34d', bg: 'rgba(245,158,11,0.15)', label: '👑 Master', border: 'rgba(245,158,11,0.3)' },
    ADMIN:        { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Admin',  border: 'rgba(167,139,250,0.25)' },
    USER:         { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', label: 'Usuário', border: 'rgba(148,163,184,0.20)' },
    VIEWER:       { color: '#64748b', bg: 'rgba(100,116,139,0.10)', label: 'Visualizador', border: 'rgba(100,116,139,0.20)' },
  }[user.role];

  const subColor =
    user.role === 'MASTER_ADMIN' ? '#fcd34d' :
    !user.subscriptionExpiresAt ? '#f87171' :
    (user.subscriptionDaysRemaining ?? 0) <= 0 ? '#f87171' :
    (user.subscriptionDaysRemaining ?? 0) <= 3 ? '#fbbf24' :
    '#34d399';

  return (
    <div
      className="rounded-2xl p-4 transition-all duration-200"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: roleConfig.bg, border: `1px solid ${roleConfig.border}`, color: roleConfig.color }}
          >
            {user.role === 'MASTER_ADMIN' ? <Crown className="w-4 h-4" /> : user.role === 'ADMIN' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-white font-semibold text-sm truncate">{user.name}</p>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{ background: roleConfig.bg, color: roleConfig.color, border: `1px solid ${roleConfig.border}` }}>
                {roleConfig.label}
              </span>
              {!user.isActive && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Inativo
                </span>
              )}
              {user.hasActiveSession && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-emerald-400" title="Sessão ativa">●</span>
              )}
            </div>
            <p className="text-slate-500 text-xs truncate">{user.email}</p>
          </div>
        </div>

        {/* Subscription */}
        <div className="flex items-center gap-2 text-xs">
          <CalendarPlus className="w-3.5 h-3.5" style={{ color: subColor }} />
          <span style={{ color: subColor }} className="font-bold">
            {user.role === 'MASTER_ADMIN' ? '∞ Ilimitado' :
             user.subscriptionDaysRemaining === null ? 'Sem assinatura' :
             `${user.subscriptionDaysRemaining} dias`}
          </span>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => onExtend(30)} title="Adicionar 30 dias"
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
            style={{ background: 'rgba(245,158,11,0.10)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.20)' }}>
            +30d
          </button>
          <button onClick={() => onExtend(7)} title="Adicionar 7 dias"
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
            style={{ background: 'rgba(245,158,11,0.10)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.20)' }}>
            +7d
          </button>
          <div className="w-px h-5 bg-slate-700 mx-1" />
          <button onClick={onEdit} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
            <Cog className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowApiKey(s => !s)} title="API Key" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
            <KeyRound className="w-3.5 h-3.5" />
          </button>
          <button onClick={onResetPassword} title="Enviar email de reset de senha" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
            <Mail className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRevoke} title="Revogar sessão" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {user.role !== 'MASTER_ADMIN' && (
            <button onClick={onDelete} title="Excluir" className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* API Key reveal */}
      {showApiKey && (
        <div className="mt-3 pt-3 border-t border-slate-700/30 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">API Key:</span>
          <code className="text-xs font-mono text-amber-400 flex-1 truncate">{user.apiKey}</code>
          <button onClick={() => navigator.clipboard.writeText(user.apiKey)} className="text-xs text-slate-500 hover:text-slate-300">Copiar</button>
        </div>
      )}

      {/* Features (PT-BR) */}
      {user.features && user.features.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {user.features.map(f => {
            const meta = FEATURE_LABELS[f];
            return (
              <span
                key={f}
                title={meta?.description}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1"
                style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.18)' }}
              >
                <span>{meta?.icon ?? '✓'}</span>
                {meta?.label ?? f}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'USER' as const,
    subscriptionDays: 30, features: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Erro'); return; }
      onCreated();
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Novo Usuário" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="input" />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="input" />
        </Field>
        <Field label="Senha inicial">
          <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="input">
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MASTER_ADMIN">MASTER_ADMIN</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </Field>
          <Field label="Dias de assinatura">
            <input type="number" min={0} value={form.subscriptionDays} onChange={e => setForm({ ...form, subscriptionDays: Number(e.target.value) })} className="input" />
          </Field>
        </div>
        <Field label="Recursos Premium liberados">
          <div className="space-y-2">
            {ALL_FEATURES.map(f => {
              const meta = FEATURE_LABELS[f];
              const checked = form.features.includes(f);
              return (
                <label
                  key={f}
                  className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: checked ? 'rgba(245,158,11,0.08)' : 'var(--surface-2)',
                    border: checked ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => setForm({ ...form, features: e.target.checked ? [...form.features, f] : form.features.filter(x => x !== f) })}
                    className="mt-0.5 flex-shrink-0 accent-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <span>{meta.icon}</span> {meta.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{meta.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar usuário'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    features: user.features ?? [],
    isActive: user.isActive,
    subscriptionExpiresAt: user.subscriptionExpiresAt?.split('T')[0] ?? '',
  });
  // Configurações de pagamento (auto-pay + rodízio)
  const [paySettings, setPaySettings] = useState<{
    autoPayEnabled: boolean;
    autoPayDelaySeconds: number;
    rotationInterval: number;
  } | null>(null);
  const [loadingPaySettings, setLoadingPaySettings] = useState(false);

  // Carrega preferências atuais do usuário
  useEffect(() => {
    setLoadingPaySettings(true);
    fetch(`/api/admin/users/${user.id}/preferences`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setPaySettings({ autoPayEnabled: d.autoPayEnabled ?? false, autoPayDelaySeconds: d.autoPayDelaySeconds ?? 5, rotationInterval: d.rotationInterval ?? 10 });
        else setPaySettings({ autoPayEnabled: false, autoPayDelaySeconds: 5, rotationInterval: 10 });
      })
      .catch(() => setPaySettings({ autoPayEnabled: false, autoPayDelaySeconds: 5, rotationInterval: 10 }))
      .finally(() => setLoadingPaySettings(false));
  }, [user.id]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          subscriptionExpiresAt: form.subscriptionExpiresAt ? new Date(form.subscriptionExpiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Erro'); return; }

      // Salvar preferências de pagamento se carregadas
      if (paySettings) {
        await fetch(`/api/admin/users/${user.id}/preferences`, {
          method: 'PATCH',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(paySettings),
        }).catch(() => {});
      }

      onSaved();
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Editar ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })} className="input">
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MASTER_ADMIN">MASTER_ADMIN</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </Field>
          <Field label="Vence em">
            <input type="date" value={form.subscriptionExpiresAt} onChange={e => setForm({ ...form, subscriptionExpiresAt: e.target.value })} className="input" />
          </Field>
        </div>
        <Field label="Status">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
            Conta ativa
          </label>
        </Field>
        <Field label="Recursos Premium liberados">
          <div className="space-y-2">
            {ALL_FEATURES.map(f => {
              const meta = FEATURE_LABELS[f];
              const checked = form.features.includes(f);
              return (
                <label
                  key={f}
                  className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: checked ? 'rgba(245,158,11,0.08)' : 'var(--surface-2)',
                    border: checked ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => setForm({ ...form, features: e.target.checked ? [...form.features, f] : form.features.filter(x => x !== f) })}
                    className="mt-0.5 flex-shrink-0 accent-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <span>{meta.icon}</span> {meta.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{meta.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </Field>
        {/* Configurações de Pagamento */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'var(--surface-2)', border: '1px solid rgba(245,158,11,0.12)' }}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgba(245,158,11,0.65)' }}>
            ⚡ Configurações de Pagamento
          </p>

          {loadingPaySettings ? (
            <div className="flex items-center gap-2 text-slate-500 text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</div>
          ) : paySettings ? (
            <div className="space-y-3">
              {/* Auto PIX */}
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-white">PIX Automático</p>
                  <p className="text-[11px] text-slate-500">Aprova QRs automaticamente assim que chegam</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaySettings(p => p ? { ...p, autoPayEnabled: !p.autoPayEnabled } : p)}
                  className={`w-10 h-6 rounded-full transition-all relative ${paySettings.autoPayEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${paySettings.autoPayEnabled ? 'left-4' : 'left-0.5'}`}
                  />
                </button>
              </label>

              {paySettings.autoPayEnabled && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Delay de Aprovação ({paySettings.autoPayDelaySeconds}s)
                  </label>
                  <div className="flex gap-1.5">
                    {[5,6,7,8,9,10].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPaySettings(p => p ? { ...p, autoPayDelaySeconds: d } : p)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: paySettings.autoPayDelaySeconds === d ? 'rgba(245,158,11,0.20)' : 'var(--surface-1)',
                          color: paySettings.autoPayDelaySeconds === d ? '#fbbf24' : '#64748b',
                          border: paySettings.autoPayDelaySeconds === d ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(255,255,255,0.04)',
                        }}
                      >{d}s</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rodízio */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Rodízio de Contas (a cada {paySettings.rotationInterval} pagamentos)
                </label>
                <input
                  type="range" min={2} max={20} value={paySettings.rotationInterval}
                  onChange={e => setPaySettings(p => p ? { ...p, rotationInterval: Number(e.target.value) } : p)}
                  className="w-full accent-amber-500"
                />
                <p className="text-[10px] text-slate-600">
                  Alterna entre as contas Asaas a cada {paySettings.rotationInterval} Pix enviados
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl w-full max-w-md my-auto"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)', boxShadow: '0 24px 60px -20px rgba(0,0,0,0.8)' }}
      >
        {/* Header sticky */}
        <div
          className="flex items-center justify-between px-6 py-4 rounded-t-2xl sticky top-0 z-10"
          style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' }}
        >
          <h2 className="text-white font-bold text-base">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
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

export default function AdminPage() {
  return (
    <AuthGuard requireRole={['MASTER_ADMIN', 'ADMIN']}>
      <AdminPanel />
    </AuthGuard>
  );
}
