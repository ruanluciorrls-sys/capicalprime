'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQrStore } from '@/store/qrStore';
import { authHeaders } from '@/lib/apiKey';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const RECENT_PAYMENTS_PURGED_ONCE_KEY = 'aios_recent_payments_purged_once';

/** Returns only first name from account label. */
const firstNameOnly = (label: string | null | undefined): string | null => {
  if (!label) return null;
  return label.trim().split(/\s+/)[0] || null;
};

export function RecentPayments() {
  const { payments, qrCodes, initPayments, initQrCodes } = useQrStore();
  const [purgedOnce, setPurgedOnce] = useState(false);
  const [purging, setPurging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_PAYMENTS_PURGED_ONCE_KEY);
      setPurgedOnce(raw === '1');
    } catch {}
  }, []);

  const visiblePayments = useMemo(() => payments, [payments]);

  const purgeFailedAndRejected = async () => {
    if (purgedOnce || purging) return;

    setPurging(true);
    setFeedback(null);
    try {
      const cleanupRes = await fetch('/api/payments/cleanup-failures', {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const cleanupData = await cleanupRes.json().catch(() => ({}));
      if (!cleanupRes.ok) {
        setFeedback(cleanupData?.message || 'Falha ao apagar falhas/rejeitos.');
        return;
      }

      const headers = authHeaders();
      const [payRes, qrRes] = await Promise.all([
        fetch('/api/payments?limit=20', { headers }),
        fetch('/api/qr?limit=50', { headers }),
      ]);

      if (payRes.ok) {
        const payData = await payRes.json();
        initPayments(payData.items ?? []);
      }
      if (qrRes.ok) {
        const qrData = await qrRes.json();
        initQrCodes(qrData.items ?? []);
      }

      setPurgedOnce(true);
      window.localStorage.setItem(RECENT_PAYMENTS_PURGED_ONCE_KEY, '1');
      setFeedback(
        `${cleanupData?.totalDeleted ?? 0} registro(s) de falha/rejeicao removido(s) com sucesso.`,
      );
    } catch {
      setFeedback('Erro de conexao ao apagar falhas/rejeitos.');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div
      className="rounded-2xl shadow-xl overflow-hidden animate-slide-up"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="flex items-center justify-end gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}
      >
        <button
          onClick={purgeFailedAndRejected}
          disabled={purgedOnce || purging}
          className="px-3 py-1.5 text-[11px] font-semibold rounded-lg text-amber-300 hover:text-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.10)' }}
          title="Apaga falhas/rejeitos do painel uma unica vez"
        >
          {purging ? 'Apagando...' : (purgedOnce ? 'Limpeza executada' : 'Apagar falhas/rejeitos (1x)')}
        </button>
      </div>

      {visiblePayments.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-slate-400 text-sm">
            Nenhum pagamento realizado ainda.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
          <table className="w-full text-sm text-left">
            <thead style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)' }}>
              <tr>
                <th className="px-5 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Data</th>
                <th className="px-5 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Valor</th>
                <th className="px-5 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Origem</th>
                <th className="px-5 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Conta</th>
                <th className="px-5 py-3.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((payment, index) => {
                const qr = qrCodes.find((q) => q.id === payment.qrCodeId);
                const origem = qr?.merchantName ?? qr?.sourceUrl?.replace(/^https?:\/\//, '').split('/')[0] ?? payment.adapterUsed ?? '-';
                const date = payment.createdAt && !isNaN(new Date(payment.createdAt).getTime())
                  ? format(new Date(payment.createdAt), 'dd/MM/yy HH:mm', { locale: ptBR })
                  : '-';
                const contaNome = firstNameOnly(payment.accountLabel);

                return (
                  <tr
                    key={payment.id}
                    className={clsx(
                      'transition-colors duration-200 hover:bg-white/[0.02]',
                      index % 2 !== 0 ? 'bg-white/[0.01]' : '',
                    )}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-5 py-3.5 text-slate-400 text-xs font-medium whitespace-nowrap">{date}</td>
                    <td className="px-5 py-3.5 font-bold text-white text-money">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs max-w-[160px] truncate" title={origem}>{origem}</td>
                    <td className="px-5 py-3.5">
                      {contaNome ? (
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: 'rgba(16,185,129,0.08)', color: '#34d399', border: '1px solid rgba(16,185,129,0.18)' }}
                        >
                          {contaNome}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <PaymentStatusBadge status={payment.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {feedback && (
        <div className="px-4 py-3 text-center text-xs text-slate-300"
          style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
          {feedback}
        </div>
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'SUCCESS':
      return (
        <span className="badge-paid justify-end w-fit ml-auto">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Concluido</span>
        </span>
      );
    case 'PENDING':
      return (
        <span className="badge-pending justify-end w-fit ml-auto">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>Aguardando</span>
        </span>
      );
    case 'PROCESSING':
      return (
        <span className="badge-paying justify-end w-fit ml-auto">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Pagando...</span>
        </span>
      );
    case 'FAILED':
      return (
        <span className="badge-error justify-end w-fit ml-auto">
          <XCircle className="w-3.5 h-3.5 text-red-400" />
          <span>Falhou</span>
        </span>
      );
    default:
      return <span className="badge">{status}</span>;
  }
}
