'use client';

import { useEffect, useRef, useState } from 'react';
import { useQrStore, QrCode } from '@/store/qrStore';
import { Crown, X, CheckCircle, XCircle, Loader2, BotMessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { authHeaders } from '@/lib/apiKey';
import { updatePreferences } from '@/services/api';

export function QrLiveDrawer() {
  const { qrCodes, approveQr, rejectQr } = useQrStore();
  const [open, setOpen] = useState(false);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [approvingAll, setApprovingAll] = useState(false);
  const prevCountRef = useRef(0);

  // ── Pix Automático State ──────────────────────────────────────
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPayDelay, setAutoPayDelay] = useState(5);
  const [savingAutoPay, setSavingAutoPay] = useState(false);
  const [autoPayLoaded, setAutoPayLoaded] = useState(false);

  const pending = qrCodes.filter((q) => q.status === 'PENDING');

  // Auto-open when new pending QRs arrive
  useEffect(() => {
    if (pending.length > prevCountRef.current) {
      setOpen(true);
    }
    prevCountRef.current = pending.length;
  }, [pending.length]);

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

  const setLoading = (id: string, val: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      val ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const handleApprove = async (id: string, amount?: number) => {
    setLoading(id, true);
    try {
      await approveQr(id, amount);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(id, false);
    }
  };

  const handleReject = async (id: string) => {
    setLoading(id, true);
    try {
      await rejectQr(id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(id, false);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      for (const q of pending) {
        await approveQr(q.id);
        // Delay de 4s entre os QRs para evitar conflitos no Asaas e permitir baixa
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApprovingAll(false);
    }
  };

  return (
    <>
      {/* Trigger badge — visible only when drawer is closed */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 ${
          open ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 scale-100'
        }`}
        style={{
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          boxShadow: '0 4px 20px rgba(245,158,11,0.45)',
        }}
        title="QRs pendentes"
      >
        <Crown className="w-4 h-4 text-white" />
        <span className="text-white text-sm font-bold">QRs</span>
        {pending.length > 0 && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-amber-700 text-xs font-black">
            {pending.length}
          </span>
        )}
      </button>

      {/* Drawer overlay */}
      <div
        className={`fixed inset-0 z-55 flex justify-end transition-all duration-300 ${
          open ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-[3px] transition-opacity duration-300"
          onClick={() => setOpen(false)}
        />

        {/* Panel */}
        <div
          className={`relative flex flex-col w-full max-w-sm h-full shadow-2xl transition-transform duration-300 ease-out transform ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{
            background: 'rgba(10, 15, 26, 0.96)',
            borderLeft: '1px solid rgba(245,158,11,0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                  boxShadow: '0 2px 10px rgba(245,158,11,0.35)',
                }}
              >
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-sm leading-none">QRs Recebidos</h2>
                <p className="text-amber-500/60 text-[10px] mt-0.5 uppercase tracking-widest">
                  {pending.length} pendente{pending.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* QR List */}
          <div className="flex-1 overflow-y-auto py-4 px-4 space-y-4">
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <Crown className="w-10 h-10 text-amber-500/20 mb-3 animate-pulse" />
                <p className="text-slate-400 text-sm font-semibold">Nenhum QR pendente</p>
                <p className="text-slate-600 text-xs mt-1">Os QRs capturados aparecerão aqui</p>
              </div>
            ) : (
              pending.map((qr) => (
                <QrCard
                  key={qr.id}
                  qr={qr}
                  loading={loadingIds.has(qr.id)}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))
            )}
          </div>

          {/* Footer contendo PIX Automático e Aprovar Todos */}
          <div
            className="px-4 py-4 space-y-3.5 bg-slate-950/80"
            style={{ borderTop: '1px solid rgba(245,158,11,0.15)' }}
          >
            {/* PIX Automático Panel */}
            <div
              className="p-3.5 rounded-xl transition-all space-y-3"
              style={{
                background: autoPayEnabled ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)',
                border: autoPayEnabled ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7.5 h-7.5 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: autoPayEnabled ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                      border: autoPayEnabled ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {autoPayLoaded ? (
                      <BotMessageSquare
                        className={`w-4 h-4 transition-colors ${autoPayEnabled ? 'text-amber-400' : 'text-slate-500'}`}
                      />
                    ) : (
                      <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold transition-colors ${autoPayEnabled ? 'text-amber-400' : 'text-slate-300'}`}>
                      PIX Automático
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {!autoPayLoaded
                        ? 'Carregando configurações...'
                        : autoPayEnabled
                        ? `Aprovando QRs após ${autoPayDelay}s`
                        : 'Modo manual ativo'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={toggleAutoPay}
                  disabled={savingAutoPay || !autoPayLoaded}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={
                    autoPayEnabled
                      ? { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }
                      : { background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white' }
                  }
                >
                  {savingAutoPay && <Loader2 className="w-3 h-3 animate-spin" />}
                  {autoPayEnabled ? 'Desativar' : 'Ativar'}
                </button>
              </div>

              {/* Delay selector */}
              {autoPayEnabled && autoPayLoaded && (
                <div className="flex items-center justify-between pt-1 animate-fade-in">
                  <span className="text-[10px] text-slate-400">Delay de aprovação:</span>
                  <div className="flex gap-1">
                    {[5, 6, 7, 8, 9, 10].map((d) => (
                      <button
                        key={d}
                        onClick={() => saveDelay(d)}
                        className="w-6.5 h-6 rounded-md text-[10px] font-bold transition-all"
                        style={{
                          background: autoPayDelay === d ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.03)',
                          color: autoPayDelay === d ? '#fbbf24' : '#64748b',
                          border: autoPayDelay === d ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Approve All */}
            {pending.length > 1 && (
              <button
                onClick={handleApproveAll}
                disabled={approvingAll}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs text-white transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                  boxShadow: '0 2px 12px rgba(245,158,11,0.35)',
                }}
              >
                {approvingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Aprovar Todos ({pending.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function QrCard({
  qr,
  loading,
  onApprove,
  onReject,
}: {
  qr: QrCode;
  loading: boolean;
  onApprove: (id: string, amount?: number) => void;
  onReject: (id: string) => void;
}) {
  const [manualAmount, setManualAmount] = useState('');
  const amountStr = qr.amount != null ? `R$ ${Number(qr.amount).toFixed(2).replace('.', ',')}` : 'Valor em aberto';
  const merchant = qr.merchantName ?? 'Comerciante desconhecido';
  const institution = (qr as any).institutionName ?? null;

  const secondsSinceCapture = (Date.now() - new Date(qr.capturedAt).getTime()) / 1000;
  const enrichmentTimedOut = secondsSinceCapture > 15;

  // Re-renderiza a cada 5s para atualizar timeout
  const [, force] = useState(0);
  useEffect(() => {
    if (qr.amount || qr.institutionName) return;
    const t = setInterval(() => force(n => n + 1), 5000);
    return () => clearInterval(t);
  }, [qr.amount, qr.institutionName]);

  const handleApprove = () => {
    const parsedAmount = manualAmount ? parseFloat(manualAmount.replace(',', '.')) : undefined;
    if (!qr.amount && enrichmentTimedOut && (!parsedAmount || parsedAmount <= 0)) {
      alert('Por favor, insira um valor válido antes de aprovar.');
      return;
    }
    onApprove(qr.id, parsedAmount);
  };

  return (
    <div
      className="rounded-xl p-4 space-y-3 transition-all hover:scale-[1.01]"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(245,158,11,0.12)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-bold text-base tracking-tight">{amountStr}</p>
          <p className="text-slate-400 text-xs truncate mt-0.5">{merchant}</p>
          {institution && <p className="text-slate-500 text-[10px] truncate">{institution}</p>}
        </div>
        <span
          className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          PENDENTE
        </span>
      </div>

      {qr.sourceUrl && (
        <p className="text-slate-600 text-[10px] truncate font-mono">{qr.sourceUrl.replace(/^https?:\/\//, '')}</p>
      )}

      {/* Manual Input se sem valor */}
      {!qr.amount && enrichmentTimedOut && (
        <div className="flex flex-col gap-2 p-2.5 rounded-xl text-[11px]" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.22)' }}>
          <div className="flex items-start gap-2" style={{ color: '#fb923c' }}>
            <span className="font-semibold">Valor não identificado pelo Asaas.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-bold ml-1">R$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={manualAmount}
              onChange={e => setManualAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent border-b border-amber-500/30 text-white focus:outline-none focus:border-amber-500 pb-1 px-1 font-mono"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
          Aprovar
        </button>
        <button
          onClick={() => onReject(qr.id)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-slate-300 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <XCircle className="w-3 h-3" />
          Rejeitar
        </button>
      </div>
    </div>
  );
}

