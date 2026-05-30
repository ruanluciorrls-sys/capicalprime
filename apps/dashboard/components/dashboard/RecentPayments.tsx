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

  // Filtros e Paginação
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [historicalPayments, setHistoricalPayments] = useState<any[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_PAYMENTS_PURGED_ONCE_KEY);
      setPurgedOnce(raw === '1');
    } catch {}
  }, []);

  const visiblePayments = useMemo(() => {
    if (page === 1 && !startDate && !endDate && !historicalPayments) {
      return payments; // Mostra tempo real se não filtrou
    }
    return historicalPayments ?? payments;
  }, [historicalPayments, payments, page, startDate, endDate]);

  const loadData = async (currentPage: number, start: string, end: string) => {
    setLoadingHistory(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams({ limit: '20', page: String(currentPage) });
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);

      const res = await fetch(`/api/payments?${params.toString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setHistoricalPayments(data.items ?? []);
        setTotalPages(data.totalPages ?? 1);
      } else {
        setFeedback('Falha ao buscar histórico filtrado.');
      }
    } catch {
      setFeedback('Erro de conexão ao buscar histórico.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    // Carrega dados iniciais para pegar o total de páginas
    loadData(1, '', '');
  }, []);

  const handleFilter = () => {
    setPage(1);
    loadData(1, startDate, endDate);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage, startDate, endDate);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setPage(1);
    loadData(1, '', '');
  };

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
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <span className="text-slate-500 text-xs font-medium">até</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={handleFilter}
            disabled={loadingHistory}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            {loadingHistory ? 'Buscando...' : 'Filtrar Período'}
          </button>
          {(startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg transition-colors"
            >
              Limpar
            </button>
          )}
        </div>

        <button
          onClick={purgeFailedAndRejected}
          disabled={purgedOnce || purging}
          className="px-3 py-1.5 text-[11px] font-semibold rounded-lg text-amber-300 hover:text-amber-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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

      {/* Paginação Elegante */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}>
          <span className="text-xs text-slate-400 font-semibold">
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loadingHistory}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold rounded-lg transition-all"
            >
              Anterior
            </button>
            
            <div className="hidden sm:flex items-center gap-1">
              {(() => {
                const pages = [];
                const maxVisible = 5;
                let start = Math.max(1, page - 2);
                let end = Math.min(totalPages, start + maxVisible - 1);
                if (end - start < maxVisible - 1) {
                  start = Math.max(1, end - maxVisible + 1);
                }
                for (let i = start; i <= end; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => handlePageChange(i)}
                      className={clsx(
                        'w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all',
                        i === page 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      )}
                    >
                      {i}
                    </button>
                  );
                }
                return pages;
              })()}
            </div>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loadingHistory}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold rounded-lg transition-all"
            >
              Próxima
            </button>
          </div>
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
