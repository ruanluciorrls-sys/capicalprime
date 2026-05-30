'use client';

import { useState, useEffect } from 'react';
import { authHeaders } from '@/lib/apiKey';
import { updatePreferences } from '@/services/api';
import { ScanLine, Loader2, CheckCircle2, AlertCircle, X, Info, BotMessageSquare, ListChecks } from 'lucide-react';

type Step = 'idle' | 'creating' | 'done' | 'error';

const BRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

/**
 * Extrai TODOS os payloads PIX válidos do texto colado.
 *
 * Aceita 3 formatos:
 *   1. Um por linha (separados por \n)
 *   2. Vários colados juntos sem separador (split pelo prefixo "000201")
 *   3. Misto (algumas linhas com 1 PIX, outras com vários concatenados)
 *
 * Retorna array de payloads limpos (sem espaços/invisíveis). Vazio se nenhum encontrado.
 */
function normalizePixPayload(text: string) {
  if (!text) return '';
  let value = String(text);
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }
  return value
    .replace(/\s+/g, '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .trim();
}

function isPixCandidate(text: string) {
  const clean = normalizePixPayload(text);
  return (
    clean.length >= 80 &&
    clean.startsWith('000201') &&
    clean.toLowerCase().includes('br.gov.bcb.pix') &&
    /6304[A-F0-9]{4}$/i.test(clean)
  );
}

function extractPixPayloadsFromText(text: string): string[] {
  const raw = String(text || '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .trim();

  const regex = /000201[\s\S]*?br\.gov\.bcb\.pix[\s\S]*?6304[A-F0-9]{4}/gi;
  const matches = raw.match(regex) || [];

  return Array.from(
    new Set(
      matches
        .map(normalizePixPayload)
        .filter(isPixCandidate),
    ),
  );
}

interface PayloadResult {
  payload: string;
  status: 'pending' | 'sending' | 'success' | 'duplicate' | 'error';
  message?: string;
  amount?: number | null;
  merchant?: string | null;
}

export function ManualQrPay() {
  const [payload, setPayload] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState<{ amount: number | null; merchant: string | null } | null>(null);

  // Resultado por payload no modo batch (vários QRs de uma vez)
  const [batchResults, setBatchResults] = useState<PayloadResult[]>([]);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  // PIX Automático mini-toggle
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [autoPayLoaded, setAutoPayLoaded]   = useState(false);
  const [savingAuto, setSavingAuto]         = useState(false);

  useEffect(() => {
    fetch('/api/users/me/bank-config', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const bc = d?.bankConfig ?? d;
        if (typeof bc?.autoPayEnabled === 'boolean') setAutoPayEnabled(bc.autoPayEnabled);
      })
      .catch(() => {})
      .finally(() => setAutoPayLoaded(true));
  }, []);

  const toggleAutoPay = async () => {
    setSavingAuto(true);
    const next = !autoPayEnabled;
    try {
      const res = await updatePreferences(authHeaders(), { autoPayEnabled: next });
      if (res.ok) setAutoPayEnabled(next);
    } catch {} finally { setSavingAuto(false); }
  };

  // Detecta TODOS os payloads válidos no texto (1 ou N)
  const detectedPayloads = extractPixPayloadsFromText(payload);
  const isBatch = detectedPayloads.length > 1;
  const canProcess = detectedPayloads.length >= 1;

  /**
   * Envia UM payload — função compartilhada entre modo single e batch.
   * Retorna o resultado (não mexe em state diretamente — caller decide).
   */
  const submitSinglePayload = async (p: string): Promise<PayloadResult> => {
    try {
      const res = await fetch('/api/qr', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: p, sourceUrl: 'manual' }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.code === 'QR_ALREADY_PAID')         return { payload: p, status: 'duplicate', message: 'Já foi pago anteriormente' };
        if (data?.code === 'QR_ALREADY_APPROVED')     return { payload: p, status: 'duplicate', message: 'Já está na fila aguardando aprovação' };
        if (data?.code === 'QR_DUPLICATE_OTHER_USER') return { payload: p, status: 'error',     message: 'QR de outra conta' };
        if (data?.code === 'QR_DUPLICATE')            return { payload: p, status: 'duplicate', message: 'Já existe na fila' };
        return { payload: p, status: 'error', message: data?.message || 'Falha ao registrar' };
      }

      const qrId = data.id ?? data.qrCode?.id;
      if (!qrId) return { payload: p, status: 'error', message: 'Resposta inesperada do servidor' };

      return {
        payload: p,
        status: 'success',
        amount:   data.amount ?? null,
        merchant: data.merchantName ?? null,
      };
    } catch {
      return { payload: p, status: 'error', message: 'Erro de conexão' };
    }
  };

  const handleAddToQueue = async () => {
    if (detectedPayloads.length === 0) return;

    setStep('creating');
    setMsg('');
    setInfo(null);
    setBatchResults([]);

    // ── Modo SINGLE — comportamento original (1 QR) ──────────
    if (!isBatch) {
      const result = await submitSinglePayload(detectedPayloads[0]);
      if (result.status === 'success') {
        setInfo({ amount: result.amount ?? null, merchant: result.merchant ?? null });
        setStep('done');
        setMsg('QR adicionado à fila! Aprove acima para processar o pagamento.');
        setPayload('');
        setTimeout(() => { setStep('idle'); setMsg(''); setInfo(null); }, 6000);
      } else {
        setStep('error');
        setMsg(result.message || 'Falha ao registrar o QR Code.');
      }
      return;
    }

    // ── Modo BATCH — envia um por um, sequencial, com progresso ──
    setBatchProgress({ done: 0, total: detectedPayloads.length });
    const initial: PayloadResult[] = detectedPayloads.map(p => ({ payload: p, status: 'pending' }));
    setBatchResults(initial);

    let successCount = 0, dupCount = 0, errCount = 0;

    for (let i = 0; i < detectedPayloads.length; i++) {
      // Marca este como "sending"
      setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'sending' } : r));

      const result = await submitSinglePayload(detectedPayloads[i]);

      if (result.status === 'success')        successCount++;
      else if (result.status === 'duplicate') dupCount++;
      else                                     errCount++;

      setBatchResults(prev => prev.map((r, idx) => idx === i ? result : r));
      setBatchProgress({ done: i + 1, total: detectedPayloads.length });
    }

    setStep('done');
    setMsg(
      `${successCount} adicionado${successCount !== 1 ? 's' : ''} à fila` +
      (dupCount ? ` • ${dupCount} duplicado${dupCount !== 1 ? 's' : ''}` : '') +
      (errCount ? ` • ${errCount} erro${errCount !== 1 ? 's' : ''}` : '')
    );

    // Limpa textarea apenas se TUDO foi sucesso ou duplicado (deixa erros visíveis)
    if (errCount === 0) {
      setPayload('');
      setTimeout(() => { setStep('idle'); setMsg(''); setBatchResults([]); }, 8000);
    }
  };

  const reset = () => {
    setStep('idle'); setMsg(''); setPayload(''); setInfo(null);
    setBatchResults([]); setBatchProgress({ done: 0, total: 0 });
  };

  const loading = step === 'creating';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface-1)', border: '1px solid rgba(245,158,11,0.15)' }}
    >
      {/* Gold accent bar */}
      <div style={{ height: '2px', background: 'linear-gradient(90deg,#f59e0b,#d97706,transparent)' }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(245,158,11,0.10)' }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 2px 8px rgba(245,158,11,0.3)' }}
        >
          <ScanLine className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold">Adicionar QR Code à Fila</p>
          <p className="text-slate-500 text-[11px]">Cole 1 ou vários payloads Pix — um por linha ou colados juntos</p>
        </div>
      </div>

      {/* PIX Automático mini-toggle */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid rgba(245,158,11,0.08)', background: autoPayEnabled ? 'rgba(245,158,11,0.04)' : 'transparent' }}
      >
        <BotMessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${autoPayEnabled ? 'text-amber-400' : 'text-slate-600'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${autoPayEnabled ? 'text-amber-300' : 'text-slate-500'}`}>
            PIX Automático{autoPayEnabled ? ' ⚡ ATIVO' : ''}
          </p>
        </div>
        <button
          onClick={toggleAutoPay}
          disabled={savingAuto || !autoPayLoaded}
          title={autoPayEnabled ? 'Desativar PIX Automático' : 'Ativar PIX Automático'}
          className="relative w-9 h-5 rounded-full transition-all disabled:opacity-40 flex-shrink-0"
          style={{ background: autoPayEnabled ? '#f59e0b' : 'rgba(100,116,139,0.3)' }}
        >
          {savingAuto
            ? <Loader2 className="w-3 h-3 text-white absolute top-1 left-3 animate-spin" />
            : <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: autoPayEnabled ? '17px' : '2px' }}
              />
          }
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        <textarea
          value={payload}
          onChange={e => { setPayload(e.target.value); if (step !== 'idle') reset(); }}
          placeholder="Cole 1 ou vários códigos Pix aqui (um por linha, ou colados juntos)&#10;&#10;Exemplo:&#10;00020126580014BR.GOV.BCB.PIX...&#10;00020126580014BR.GOV.BCB.PIX..."
          rows={isBatch ? 6 : 4}
          disabled={loading}
          className="w-full text-white text-xs font-mono resize-none rounded-xl px-4 py-3 placeholder:text-slate-600 disabled:opacity-50 transition-all"
          style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.06)' }}
          onFocus={e => { e.target.style.borderColor = 'rgba(245,158,11,0.35)'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.10)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.06)'; e.target.style.boxShadow = ''; }}
        />

        {/* Badge: quantidade detectada (modo batch) */}
        {isBatch && step === 'idle' && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}
          >
            <ListChecks className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <p className="text-blue-300 font-semibold">
              {detectedPayloads.length} QR Codes detectados — serão enviados em sequência.
            </p>
          </div>
        )}

        {/* Preview do QR detectado (modo single) */}
        {!isBatch && info && step !== 'error' && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}
          >
            <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-0.5">
              <p className="text-amber-300 font-semibold">
                {info.amount ? BRL(info.amount) : 'Valor em aberto (Pix dinâmico)'}
              </p>
              {info.merchant && <p className="text-slate-400">{info.merchant}</p>}
              {!info.amount && (
                <p className="text-[10px] text-slate-500">
                  Pix dinâmico — o valor aparecerá na fila em instantes após o envio.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Lista de resultados do batch — um abaixo do outro */}
        {batchResults.length > 0 && (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {batchResults.map((r, idx) => {
              const colors = {
                pending:   { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.20)', text: '#94a3b8', icon: '○' },
                sending:   { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', text: '#fbbf24', icon: '↻' },
                success:   { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.28)', text: '#34d399', icon: '✓' },
                duplicate: { bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.22)', text: '#fb923c', icon: '⊘' },
                error:     { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.22)',  text: '#f87171', icon: '✕' },
              }[r.status];
              const preview = r.payload.slice(0, 28) + '…' + r.payload.slice(-8);
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] transition-all"
                  style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0`}
                        style={{ background: 'rgba(0,0,0,0.25)', color: colors.text }}>
                    {idx + 1}
                  </span>
                  {r.status === 'sending'
                    ? <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" style={{ color: colors.text }} />
                    : <span className="w-3 text-center flex-shrink-0" style={{ color: colors.text }}>{colors.icon}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-slate-400 truncate">{preview}</p>
                    {r.message && <p className="text-[10px]" style={{ color: colors.text }}>{r.message}</p>}
                    {r.status === 'success' && (r.amount || r.merchant) && (
                      <p className="text-[10px] text-slate-500 truncate">
                        {r.amount ? BRL(r.amount) : 'Valor em aberto'}
                        {r.merchant ? ` • ${r.merchant}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Feedback */}
        {step === 'done' && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {msg}
          </div>
        )}
        {step === 'error' && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{msg}</span>
            <button onClick={reset} className="hover:text-red-200 mt-0.5"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            {isBatch
              ? `Enviando ${batchProgress.done}/${batchProgress.total}...`
              : 'Registrando QR Code...'}
          </div>
        )}

        <button
          onClick={handleAddToQueue}
          disabled={!canProcess || loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg,#f59e0b,#d97706)',
            boxShadow: canProcess && !loading ? '0 2px 12px rgba(245,158,11,0.35)' : 'none',
          }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
          {loading
            ? (isBatch ? `Enviando ${batchProgress.done}/${batchProgress.total}...` : 'Registrando...')
            : (isBatch ? `Adicionar ${detectedPayloads.length} QRs à Fila` : 'Adicionar à Fila')}
        </button>

        {!canProcess && payload.length > 5 && (
          <p className="text-center text-[11px] text-red-400">
            Payload inválido — deve começar com <code className="font-mono">000201</code> e conter os dados Pix.
          </p>
        )}
      </div>
    </div>
  );
}
