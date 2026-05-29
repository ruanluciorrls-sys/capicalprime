'use client';

import { useEffect, useState } from 'react';
import { useAsaasStore, AsaasEnvironmentConfig } from '@/store/asaasStore';
import { authHeaders, getApiKey } from '@/lib/apiKey';
import { updateAsaasConfig, getBalance } from '@/services/api';
import {
  Building2, CheckCircle2, ChevronDown, ChevronRight,
  Eye, EyeOff, KeyRound, Landmark, Loader2, RefreshCw,
  RotateCcw, ShieldCheck, Trash2, Wallet, Wifi, WifiOff, XCircle,
} from 'lucide-react';

type ConnectionStatus = 'idle' | 'connected' | 'failed' | 'loading';
type SlotKey = 'production' | 'production2' | 'production3';

const BRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const SLOTS: { key: SlotKey; label: string; sublabel: string }[] = [
  { key: 'production',  label: 'API Asaas — Conta 1 (Principal)', sublabel: 'Conta principal para pagamentos Pix reais.' },
  { key: 'production2', label: 'API Asaas — Conta 2',             sublabel: 'Segunda conta Asaas para rodízio.' },
  { key: 'production3', label: 'API Asaas — Conta 3',             sublabel: 'Terceira conta Asaas para rodízio.' },
];

interface SlotState {
  token: string;
  showToken: boolean;
  status: ConnectionStatus;
  statusMsg: string;
  open: boolean;
}

const defaultSlot = (): SlotState => ({
  token: '', showToken: false, status: 'idle', statusMsg: '', open: false,
});

export default function SettingsPage() {
  const { fetchAsaasData, productionConfig } = useAsaasStore();

  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>({
    production:  defaultSlot(),
    production2: defaultSlot(),
    production3: defaultSlot(),
  });

  const [configs, setConfigs]   = useState<Record<SlotKey, AsaasEnvironmentConfig | null>>({
    production: null, production2: null, production3: null,
  });

  const [rotationInterval, setRotationInterval] = useState(10);
  const [savingRotation, setSavingRotation]     = useState(false);
  const [rotationMsg, setRotationMsg]           = useState('');

  const [saving, setSaving] = useState(false);

  // ── Load configs from backend ──────────────────────────────────────────
  const loadConfigs = async () => {
    const apiKey = getApiKey();
    if (!apiKey) return;
    try {
      const res = await fetch('/api/users/me/bank-config', { headers: { 'X-Api-Key': apiKey } });
      if (!res.ok) return;
      const data = await res.json();
      const asaas = data?.bankConfig?.asaas ?? {};

      const mapped: Record<SlotKey, AsaasEnvironmentConfig | null> = {
        production:  asaas.production  ?? null,
        production2: asaas.production2 ?? null,
        production3: asaas.production3 ?? null,
      };
      setConfigs(mapped);

      // Set rotation interval
      const ri = asaas.rotationInterval;
      if (typeof ri === 'number') setRotationInterval(ri);

      // Open connected slots by default
      setSlots(prev => {
        const next = { ...prev };
        (Object.keys(mapped) as SlotKey[]).forEach(k => {
          if (mapped[k]?.connected) next[k] = { ...next[k], open: true, status: 'connected' };
        });
        return next;
      });
    } catch {}
  };

  useEffect(() => { loadConfigs(); }, []);

  // ── Slot helpers ───────────────────────────────────────────────────────
  const setSlot = (key: SlotKey, patch: Partial<SlotState>) =>
    setSlots(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleToggleOpen = (key: SlotKey) =>
    setSlot(key, { open: !slots[key].open });

  const handleTest = async (key: SlotKey) => {
    const localKey = getApiKey();
    const token = slots[key].token.trim();

    if (!localKey) { setSlot(key, { status: 'failed', statusMsg: 'API Key local não encontrada' }); return; }
    if (!token) {
      if (!configs[key]?.hasApiKey) {
        setSlot(key, { status: 'failed', statusMsg: 'Insira o token antes de testar' }); return;
      }
      await fetchAsaasData(); return;
    }

    setSlot(key, { status: 'loading', statusMsg: '' });
    try {
      const res = await updateAsaasConfig(localKey, key, { bankAdapter: 'asaas', bankConfig: { apiKey: token }, dryRun: true } as any);
      if (!res.ok) {
        const err = await res.json();
        setSlot(key, { status: 'failed', statusMsg: err?.message || 'Falha na autenticação.' }); return;
      }
      setSlot(key, { status: 'connected', statusMsg: 'Testado com sucesso. Clique em Salvar.' });
    } catch (e: any) {
      setSlot(key, { status: 'failed', statusMsg: e.message || 'Erro inesperado.' });
    }
  };

  const handleSave = async (key: SlotKey) => {
    const localKey = getApiKey();
    const token = slots[key].token.trim();
    if (!localKey || !token) return;

    setSlot(key, { status: 'loading', statusMsg: '' });
    try {
      const res = await updateAsaasConfig(localKey, key, { bankAdapter: 'asaas', bankConfig: { apiKey: token } } as any);
      if (!res.ok) {
        const err = await res.json();
        setSlot(key, { status: 'failed', statusMsg: err?.message || 'Falha ao salvar.' }); return;
      }
      setSlot(key, { status: 'connected', statusMsg: 'Salvo com sucesso.', token: '' });
      await loadConfigs();
      window.dispatchEvent(new Event('asaas-config-updated'));
    } catch (e: any) {
      setSlot(key, { status: 'failed', statusMsg: e.message || 'Erro ao salvar.' });
    }
  };

  const handleRemove = async (key: SlotKey) => {
    if (!confirm(`Remover configuração da ${SLOTS.find(s => s.key === key)?.label}?`)) return;
    const localKey = getApiKey();
    if (!localKey) return;
    setSlot(key, { status: 'loading', statusMsg: '' });
    try {
      const res = await updateAsaasConfig(localKey, key, { bankAdapter: 'asaas', bankConfig: { apiKey: '' } } as any);
      if (res.ok) {
        setSlot(key, { status: 'idle', statusMsg: 'Removido.', token: '' });
        await loadConfigs();
        window.dispatchEvent(new Event('asaas-config-updated'));
      } else {
        setSlot(key, { status: 'failed', statusMsg: 'Falha ao remover.' });
      }
    } catch {
      setSlot(key, { status: 'failed', statusMsg: 'Erro ao remover.' });
    }
  };

  const handleSaveRotation = async () => {
    setSavingRotation(true);
    setRotationMsg('');
    try {
      const res = await fetch('/api/users/me/preferences', {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotationInterval }),
      });
      if (res.ok) setRotationMsg('Intervalo salvo!');
      else setRotationMsg('Falha ao salvar.');
    } catch { setRotationMsg('Erro de conexão.'); }
    setSavingRotation(false);
    setTimeout(() => setRotationMsg(''), 3000);
  };

  const connectedCount = (Object.values(configs) as (AsaasEnvironmentConfig | null)[]).filter(c => c?.connected).length;

  const statusUI = (status: ConnectionStatus) => ({
    idle:      { icon: <WifiOff  className="w-3.5 h-3.5" />, text: 'Não configurado', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
    loading:   { icon: <Loader2  className="w-3.5 h-3.5 animate-spin" />, text: 'Verificando...', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    connected: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: 'Conectado', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    failed:    { icon: <XCircle  className="w-3.5 h-3.5" />, text: 'Falha', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  }[status]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4 animate-fade-in">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-white">Configurações de Integração</h1>
        <p className="text-xs text-slate-500 mt-0.5">Gerencie suas contas Asaas e configure o rodízio de pagamentos</p>
      </div>

      {/* Account sections */}
      {SLOTS.map(slot => {
        const s = slots[slot.key];
        const cfg = configs[slot.key];
        const sUI = statusUI(s.status);
        const isConnected = s.status === 'connected' || cfg?.connected === true;
        const hasToken = s.token.trim().length > 0;

        return (
          <div
            key={slot.key}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--surface-1)',
              border: isConnected ? '1px solid rgba(16,185,129,0.22)' : '1px solid var(--border-subtle)',
            }}
          >
            {/* Section header — click to open/close */}
            <button
              type="button"
              onClick={() => handleToggleOpen(slot.key)}
              className="w-full flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
              style={{ borderBottom: s.open ? '1px solid var(--border-subtle)' : 'none' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isConnected ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.10)',
                    border: isConnected ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(245,158,11,0.20)',
                  }}
                >
                  <ShieldCheck className={`w-4 h-4 ${isConnected ? 'text-emerald-400' : 'text-amber-500'}`} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">{slot.label}</p>
                  <p className="text-[11px] text-slate-500">{slot.sublabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${sUI.cls}`}>
                  {sUI.icon} {sUI.text}
                </span>
                {s.open
                  ? <ChevronDown className="w-4 h-4 text-slate-500" />
                  : <ChevronRight className="w-4 h-4 text-slate-500" />}
              </div>
            </button>

            {/* Collapsible body */}
            {s.open && (
              <div className="px-5 py-4 space-y-3">
                {/* Token input */}
                <div className="relative">
                  <input
                    type={s.showToken ? 'text' : 'password'}
                    value={s.token}
                    onChange={e => setSlot(slot.key, { token: e.target.value })}
                    placeholder={cfg?.hasApiKey ? `•••••••• (${cfg.maskedApiKey})` : `Token API Asaas (Produção)`}
                    className="input pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setSlot(slot.key, { showToken: !s.showToken })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {s.showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleTest(slot.key)}
                    disabled={s.status === 'loading'}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8' }}
                  >
                    {s.status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                    Testar
                  </button>

                  {hasToken && (
                    <button
                      onClick={() => handleSave(slot.key)}
                      disabled={s.status === 'loading'}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all"
                      style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 2px 10px rgba(245,158,11,0.25)' }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Salvar
                    </button>
                  )}

                  {cfg?.hasApiKey && (
                    <button
                      onClick={() => handleRemove(slot.key)}
                      disabled={s.status === 'loading'}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#f87171' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remover
                    </button>
                  )}
                </div>

                {s.statusMsg && (
                  <p className={`text-xs ${s.status === 'failed' ? 'text-red-400' : 'text-emerald-400'}`}>{s.statusMsg}</p>
                )}

                {/* Connected account info */}
                {cfg?.connected && (
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}
                  >
                    {/* Balance */}
                    {cfg.balance !== null && cfg.balance !== undefined && (
                      <div
                        className="flex items-center justify-between px-4 py-3"
                        style={{ borderBottom: '1px solid rgba(16,185,129,0.10)' }}
                      >
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-emerald-400" />
                          <span className="text-[11px] text-slate-400 font-medium">Saldo disponível</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black font-mono text-emerald-400">{BRL(cfg.balance)}</span>
                          <button
                            onClick={loadConfigs}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                            title="Atualizar"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Account info row */}
                    <div className="flex items-center gap-4 px-4 py-2.5">
                      {cfg.accountHolderName && (
                        <>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Building2 className="w-3 h-3 text-slate-500 flex-shrink-0" />
                            <span
                              className="text-[11px] text-slate-400 truncate"
                              style={{ maxWidth: 180 }}
                              title={cfg.accountHolderName}
                            >
                              {cfg.accountHolderName.trim().split(/\s+/).slice(0, 2).join(' ')}
                            </span>
                          </div>
                          <div className="h-3 w-px bg-slate-700" />
                        </>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Landmark className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="text-[11px] text-slate-500 font-mono">
                          {cfg.agency || '—'} / {cfg.accountNumber || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Rotation config — only visible when 2+ accounts are connected */}
      {connectedCount >= 2 && (
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'var(--surface-1)', border: '1px solid rgba(245,158,11,0.18)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Rodízio de Contas</p>
              <p className="text-[11px] text-slate-500">Alterna entre contas a cada N pagamentos Pix</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Intervalo de rodízio (pagamentos por conta)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={rotationInterval}
                  onChange={e => setRotationInterval(Number(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
                <span
                  className="text-lg font-black font-mono text-amber-400 w-8 text-center"
                >
                  {rotationInterval}
                </span>
              </div>
              <p className="text-[10px] text-slate-600">
                A cada <strong className="text-amber-400">{rotationInterval}</strong> pagamentos, rotaciona para a próxima conta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveRotation}
              disabled={savingRotation}
              className="btn-primary text-sm"
            >
              {savingRotation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Salvar Rodízio
            </button>
            {rotationMsg && (
              <span className={`text-xs font-medium ${rotationMsg.includes('alvo') ? 'text-red-400' : 'text-emerald-400'}`}>
                {rotationMsg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
