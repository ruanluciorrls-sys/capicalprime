'use client';

import { useQrStore } from '@/store/qrStore';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Check, X, ShieldAlert, Store, Clock, Ban, KeyRound, EyeOff,
  SearchCode, Trash2, Building2, AlertCircle, Loader2, Zap, BotMessageSquare,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authHeaders } from '@/lib/apiKey';
import { updatePreferences } from '@/services/api';

export function QrQueue() {
  const { qrCodes, rawCaptures, approveQr, rejectQr, cancelQr } = useQrStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkPaying, setBulkPaying] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // ── Pix Automático ────────────────────────────────────────────
  const [autoPayEnabled, setAutoPayEnabled]     = useState(false);
  const [autoPayDelay, setAutoPayDelay]         = useState(5);
  const [savingAutoPay, setSavingAutoPay]       = useState(false);
  const [autoPayLoaded, setAutoPayLoaded]       = useState(false);

  // Carrega configurações do backend
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/users/me/bank-config', { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const bc = data?.bankConfig ?? data;
        if (typeof bc?.autoPayEnabled === 'boolean') setAutoPayEnabled(bc.autoPayEnabled);
        if (typeof bc?.autoPayDelaySeconds === 'number') setAutoPayDelay(bc.autoPayDelaySeconds);
      } catch {} finally { setAutoPayLoaded(true); }
    })();
  }, []);

  const toggleAutoPay = async () => {
    setSavingAutoPay(true);
    const next = !autoPayEnabled;
    try {
      const res = await updatePreferences(authHeaders(), { autoPayEnabled: next, autoPayDelaySeconds: autoPayDelay });
      if (res.ok) {
        setAutoPayEnabled(next);
        toast(next ? `⚡ PIX Automático ATIVO (${autoPayDelay}s)` : '🛑 PIX Automático desativado', {
          style: {
            background: '#0c1018',
            color: next ? '#fbbf24' : '#94a3b8',
            border: `1px solid ${next ? 'rgba(245,158,11,0.25)' : 'rgba(148,163,184,0.15)'}`,
          },
        });
      }
    } catch {} finally { setSavingAutoPay(false); }
  };

  const saveDelay = async (d: number) => {
    setAutoPayDelay(d);
    if (autoPayEnabled) {
      await updatePreferences(authHeaders(), { autoPayDelaySeconds: d });
    }
  };

  const pendingQrs = qrCodes
    .filter(q => q.status === 'PENDING' || q.status === 'RAW_CAPTURED')
    .filter(q => {
      if (!searchTerm) return true;
      const t = searchTerm.toLowerCase();
      return q.merchantName?.toLowerCase().includes(t)
        || q.amount?.toString().includes(t)
        || q.payload?.toLowerCase().includes(t);
    });

  const pendingRaw = rawCaptures
    .filter(c => c.validationStatus === 'pending_validation')
    .filter(c => !searchTerm || c.rawContent?.toLowerCase().includes(searchTerm.toLowerCase()));

  const payableQrs = pendingQrs.filter(q => q.status === 'PENDING' && q.canPay);

  const handlePayAll = async () => {
    if (payableQrs.length === 0) return;
    if (!confirm(`Aprovar e pagar ${payableQrs.length} QR Code(s) em sequência?`)) return;

    setBulkPaying(true);
    setBulkProgress({ done: 0, total: payableQrs.length });

    let ok = 0;
    let fail = 0;
    for (const qr of payableQrs) {
      try {
        await approveQr(qr.id);
        ok++;
      } catch {
        fail++;
      }
      setBulkProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setBulkPaying(false);
    if (fail === 0) {
      toast.success(`${ok} QR(s) aprovados e em processamento.`);
    } else {
      toast.error(`${ok} aprovados, ${fail} falharam.`);
    }
  };

  // ── PIX Automático panel — renderizado SEMPRE (mesmo com fila vazia) ────
  const autoPayPanel = (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
      style={{
        background: autoPayEnabled ? 'rgba(245,158,11,0.06)' : 'var(--surface-1)',
        border: autoPayEnabled ? '1px solid rgba(245,158,11,0.22)' : '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: autoPayEnabled ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.08)',
          border: autoPayEnabled ? '1px solid rgba(245,158,11,0.30)' : '1px solid rgba(148,163,184,0.15)',
        }}
      >
        {autoPayLoaded
          ? <BotMessageSquare className={`w-4 h-4 ${autoPayEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
          : <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${autoPayEnabled ? 'text-amber-300' : 'text-slate-400'}`}>
          PIX Automático{autoPayEnabled ? ' — ATIVO ⚡' : ''}
        </p>
        <p className="text-[11px] text-slate-500">
          {!autoPayLoaded
            ? 'Carregando configurações...'
            : autoPayEnabled
              ? `Aprovando QRs automaticamente após ${autoPayDelay}s`
              : 'Pagamentos em modo manual — clique para ativar'}
        </p>
      </div>
      {/* Delay selector — só visível quando ativo */}
      {autoPayEnabled && autoPayLoaded && (
        <div className="flex items-center gap-1">
          {[5, 6, 7, 8, 9, 10].map(d => (
            <button
              key={d}
              onClick={() => saveDelay(d)}
              className="w-7 h-7 rounded-lg text-xs font-bold transition-all"
              style={{
                background: autoPayDelay === d ? 'rgba(245,158,11,0.25)' : 'var(--surface-2)',
                color: autoPayDelay === d ? '#fbbf24' : '#64748b',
                border: autoPayDelay === d ? '1px solid rgba(245,158,11,0.40)' : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {d}s
            </button>
          ))}
        </div>
      )}
      <button
        onClick={toggleAutoPay}
        disabled={savingAutoPay || !autoPayLoaded}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        style={autoPayEnabled
          ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', color: '#f87171' }
          : { background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', boxShadow: '0 2px 10px rgba(245,158,11,0.25)' }
        }
      >
        {savingAutoPay ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {autoPayEnabled ? 'Desativar' : 'Ativar Auto PIX'}
      </button>
    </div>
  );

  if (pendingQrs.length === 0 && pendingRaw.length === 0 && !searchTerm) {
    return (
      <div className="space-y-4">
        {autoPayPanel}
        <div
          className="flex flex-col items-center justify-center py-14 rounded-2xl text-center animate-fade-in"
          style={{ background: 'var(--surface-1)', border: '1px dashed rgba(245,158,11,0.15)' }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}
          >
            <Check className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Fila Vazia</h3>
          <p className="text-slate-500 text-sm max-w-xs">
            Nenhum QR Code aguardando aprovação. A extensão enviará novos QRs automaticamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Bulk Pay */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar por recebedor ou valor..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 text-sm text-slate-200 placeholder:text-slate-600 px-4 py-2.5 rounded-xl focus:outline-none transition-all"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(245,158,11,0.35)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(245,158,11,0.10)'; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.target as HTMLInputElement).style.boxShadow = ''; }}
        />

        {payableQrs.length > 0 && (
          <button
            onClick={handlePayAll}
            disabled={bulkPaying}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
              boxShadow: '0 2px 12px rgba(245,158,11,0.35)',
            }}
          >
            {bulkPaying
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {bulkProgress.done}/{bulkProgress.total}</>
              : <><Zap className="w-4 h-4" /> Pagar todos ({payableQrs.length})</>}
          </button>
        )}
      </div>

      {/* PIX Automático — sempre visível */}
      {autoPayPanel}

      {pendingQrs.length === 0 && pendingRaw.length === 0 ? (
        <p className="text-center py-8 text-slate-500 text-sm">
          Nenhum resultado para "{searchTerm}".
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-slide-up">
          {pendingRaw.map(raw => <RawQrCard key={raw.id} raw={raw} />)}
          {pendingQrs.map(qr => (
            <QrCard
              key={qr.id}
              qr={qr}
              onApprove={() => approveQr(qr.id)}
              onReject={() => rejectQr(qr.id)}
              onCancel={() => cancelQr(qr.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QrCard({ qr, onApprove, onReject, onCancel }: any) {
  const [loading, setLoading] = useState<'approve' | 'reject' | 'cancel' | null>(null);

  const act = async (type: 'approve' | 'reject' | 'cancel', fn: () => Promise<void>) => {
    setLoading(type);
    try { await fn(); } catch { alert('Erro ao realizar ação'); } finally { setLoading(null); }
  };

  const timeAgo = formatDistanceToNow(new Date(qr.capturedAt), { addSuffix: true, locale: ptBR });
  const BRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  // Re-renderiza a cada 5s para atualizar o estado de "buscando vs expirado"
  const [, force] = useState(0);
  useEffect(() => {
    if (qr.amount || qr.institutionName) return; // já enriquecido, não precisa atualizar
    const t = setInterval(() => force(n => n + 1), 5000);
    return () => clearInterval(t);
  }, [qr.amount, qr.institutionName]);

  const secondsSinceCapture = (Date.now() - new Date(qr.capturedAt).getTime()) / 1000;
  const enrichmentTimedOut = secondsSinceCapture > 15;

  return (
    <div
      className="rounded-2xl flex flex-col transition-all duration-300 overflow-hidden"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid rgba(245,158,11,0.12)',
        boxShadow: '0 4px 20px -8px rgba(0,0,0,0.5)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.28)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(245,158,11,0.10)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.12)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px -8px rgba(0,0,0,0.5)';
      }}
    >
      {/* Gold top accent bar */}
      <div style={{ height: '2px', background: 'linear-gradient(90deg,#f59e0b,#d97706,transparent)' }} />

      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge-pending">
              <Clock className="w-2.5 h-2.5" /> Pendente
            </span>
            {qr.isRaw && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1"
                style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.22)' }}
              >
                <ShieldAlert className="w-2.5 h-2.5" /> Bruto
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500">{timeAgo}</span>
        </div>

        {/* Amount + merchant */}
        <div className="text-center space-y-1.5">
          <div className="text-2xl font-black text-white text-money tracking-tight">
            {qr.amount ? BRL(qr.amount) : (
              <span className="text-slate-500 text-base font-semibold">Valor em aberto</span>
            )}
          </div>
          <div className="flex items-center justify-center gap-1.5 text-sm text-slate-400">
            <Store className="w-3.5 h-3.5 text-amber-500/60" />
            <span className="truncate max-w-[180px]">{qr.merchantName ?? 'Destinatário desconhecido'}</span>
          </div>
          {qr.pixKey && (
            <div
              className="flex items-center justify-center gap-1 text-[10px] font-mono mx-auto w-fit px-2.5 py-1 rounded-lg"
              style={{ background: 'var(--surface-2)', color: '#64748b' }}
            >
              <KeyRound className="w-3 h-3" />
              {String(qr.pixKey).length > 22
                ? `${String(qr.pixKey).slice(0, 10)}…${String(qr.pixKey).slice(-10)}`
                : qr.pixKey}
            </div>
          )}
        </div>

        {/* Asaas enrichment */}
        {(qr.institutionName || qr.asaasStatus) && (
          <div
            className="rounded-xl px-3 py-2 space-y-1 text-xs"
            style={{ background: 'var(--surface-2)', border: '1px solid rgba(245,158,11,0.08)' }}
          >
            {qr.institutionName && (
              <div className="flex items-center gap-1.5 text-slate-400">
                <Building2 className="w-3 h-3 text-amber-500/50 flex-shrink-0" />
                <span className="truncate">{qr.institutionName}</span>
              </div>
            )}
            {qr.asaasStatus && (
              <span className={`font-semibold text-[11px] ${
                qr.asaasStatus === 'PAID' ? 'text-emerald-400' :
                qr.asaasStatus === 'EXPIRED' ? 'text-red-400' : 'text-amber-400'}`}>
                {qr.asaasStatus === 'PAID' ? '✓ Já pago' :
                 qr.asaasStatus === 'EXPIRED' ? '✗ Expirado' :
                 qr.asaasStatus === 'ACTIVE' ? '● Ativo' : qr.asaasStatus}
              </span>
            )}
          </div>
        )}

        {/* Consulting — PIX dinâmico aguardando enriquecimento via Asaas */}
        {qr.canPay && !qr.institutionName && !qr.amount && !enrichmentTimedOut && (
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="animate-pulse">Buscando valor via Asaas...</span>
          </div>
        )}

        {/* Timeout — Asaas não retornou valor após 15s (PIX provavelmente expirado) */}
        {qr.canPay && !qr.institutionName && !qr.amount && enrichmentTimedOut && (
          <div
            className="flex items-start gap-2 p-2.5 rounded-xl text-[11px]"
            style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.22)', color: '#fb923c' }}
          >
            <ShieldAlert className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              Valor indisponível — PIX dinâmico expirado ou inativo. O valor será re-consultado automaticamente ao aprovar.
            </span>
          </div>
        )}

        {/* Warnings */}
        {!qr.amount && !qr.isRaw && qr.institutionName && (
          <div
            className="flex items-start gap-2 p-3 rounded-xl text-xs"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', color: '#fbbf24' }}
          >
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Pix sem valor fixo — pode exigir intervenção manual no banco.
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 mt-auto">
          <button
            onClick={() => act('cancel', onCancel)}
            disabled={!!loading}
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-all disabled:opacity-40"
            style={{ background: 'var(--surface-2)' }}
          >
            {loading === 'cancel' ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Ban className="w-3 h-3" /> Cancelar</>}
          </button>

          <button
            onClick={() => act('reject', onReject)}
            disabled={!!loading}
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-40"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.18)',
              color: '#f87171',
            }}
          >
            {loading === 'reject' ? <Loader2 className="w-3 h-3 animate-spin" /> : <><X className="w-3 h-3" /> Rejeitar</>}
          </button>

          <button
            onClick={() => act('approve', onApprove)}
            disabled={!!loading || !qr.canPay}
            title={!qr.canPay ? 'Não é um Pix válido' : 'Aprovar e pagar'}
            className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold text-white transition-all disabled:opacity-40"
            style={qr.canPay ? {
              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
              boxShadow: '0 2px 10px rgba(245,158,11,0.30)',
            } : {
              background: 'var(--surface-2)',
              color: '#475569',
            }}
          >
            {loading === 'approve'
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <><Check className="w-3 h-3" /> {qr.canPay ? 'Aprovar' : 'Inválido'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function RawQrCard({ raw }: any) {
  const { deleteRawCapture } = useQrStore();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Excluir este conteúdo bruto?')) return;
    setDeleting(true);
    try { await deleteRawCapture(raw.id); } catch { alert('Erro ao excluir'); } finally { setDeleting(false); }
  };

  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden transition-all duration-300"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid rgba(251,146,60,0.15)',
        boxShadow: '0 4px 20px -8px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ height: '2px', background: 'linear-gradient(90deg,#fb923c,#f97316,transparent)' }} />

      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center gap-1.5"
            style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.22)' }}
          >
            <SearchCode className="w-3 h-3" /> Analisando
          </span>
          <span className="text-[10px] text-slate-500">
            {formatDistanceToNow(new Date(raw.capturedAt), { addSuffix: true, locale: ptBR })}
          </span>
        </div>

        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm font-semibold">
            <EyeOff className="w-4 h-4" /> Conteúdo Bruto
          </div>
          <div
            className="text-[10px] font-mono text-left break-all p-3 rounded-xl h-16 overflow-y-auto"
            style={{ background: 'var(--surface-2)', color: '#64748b' }}
          >
            {raw.rawContent}
          </div>
        </div>

        <div
          className="flex items-start gap-2 p-3 rounded-xl text-xs"
          style={{ background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)', color: '#fdba74' }}
        >
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Aguardando validação — não pode ser pago ainda.
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <button
            disabled
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-slate-600"
            style={{ background: 'var(--surface-2)' }}
          >
            <Clock className="w-3 h-3 animate-pulse" /> Aguardando...
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Trash2 className="w-3 h-3" /> Excluir</>}
          </button>
        </div>
      </div>
    </div>
  );
}
