'use client';

import { useEffect, useState } from 'react';
import { Search, Calendar, DollarSign, ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, Ban, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

type HistoryItem = {
  id: string;
  amount: number | null;
  merchantName: string | null;
  status: string;
  capturedAt: string;
  payment?: { executedAt?: string | null; bankEnd2EndId?: string | null } | null;
};

export default function HistoryPage() {
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const apiKey = localStorage.getItem('aios_api_key') ?? 'local';
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) params.set('status', status);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (minAmount) params.set('minAmount', minAmount);
      if (maxAmount) params.set('maxAmount', maxAmount);
      const res = await fetch(`/api/qr?${params.toString()}`, { headers: { 'X-Api-Key': apiKey } });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, [page]);

  return (
    <div className="space-y-8 animate-fade-in py-2">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5">
        <div className="p-3 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-2xl shadow-lg shadow-blue-500/5">
          <Search className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Histórico Completo</h1>
          <p className="text-slate-400 mt-1 text-sm font-medium">Consulte e filtre todas as transações Pix capturadas e processadas</p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white tracking-wide uppercase text-slate-300">Filtros de Busca</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600/80 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all duration-300 font-medium"
            >
              <option value="">Todos status</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="PAID">PAID</option>
              <option value="ERROR">ERROR</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Data Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600/80 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all duration-300 font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Data Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600/80 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all duration-300 font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Valor Mínimo</label>
            <input
              type="number"
              placeholder="R$ 0,00"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600/80 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all duration-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Valor Máximo</label>
            <input
              type="number"
              placeholder="R$ 9999,99"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600/80 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all duration-300 font-mono"
            />
          </div>
        </div>

        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/10 hover:shadow-blue-500/25 transition-all duration-300 mt-2"
          onClick={() => { setPage(1); load().catch(console.error); }}
        >
          Aplicar filtros e atualizar
        </button>
      </div>

      {/* History Table */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800 border-b border-slate-700/50">
              <tr>
                <th className="px-5 py-4 font-bold tracking-wider">ID</th>
                <th className="px-5 py-4 font-bold tracking-wider">Valor</th>
                <th className="px-5 py-4 font-bold tracking-wider">Favorecido</th>
                <th className="px-5 py-4 font-bold tracking-wider">Status</th>
                <th className="px-5 py-4 font-bold tracking-wider">Capturado Em</th>
                <th className="px-5 py-4 font-bold tracking-wider">Pago Em</th>
                <th className="px-5 py-4 font-bold tracking-wider">End2End ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 font-semibold animate-pulse">
                    Carregando histórico...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500 font-semibold">
                    Nenhum registro encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr
                    key={item.id}
                    className={clsx(
                      'hover:bg-slate-700/50 transition-colors duration-200',
                      index % 2 === 0 ? 'bg-transparent' : 'bg-slate-900/10'
                    )}
                  >
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-200 select-all">
                      {item.id.length > 8 ? `${item.id.slice(0, 8)}...` : item.id}
                    </td>
                    <td className="px-5 py-4 font-bold text-white text-money">
                      {item.amount == null ? (
                        <span className="text-slate-500 text-xs">Aberto</span>
                      ) : (
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-300 font-medium max-w-[150px] truncate" title={item.merchantName ?? ''}>
                      {item.merchantName ?? '-'}
                    </td>
                    <td className="px-5 py-4">
                      <QrStatusBadge status={item.status} />
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs font-semibold">
                      {new Date(item.capturedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs font-semibold">
                      {item.payment?.executedAt
                        ? new Date(item.payment.executedAt).toLocaleString('pt-BR')
                        : '-'}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-400 select-all max-w-[180px] truncate" title={item.payment?.bankEnd2EndId ?? ''}>
                      {item.payment?.bankEnd2EndId ?? '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
        <span className="text-xs text-slate-400 font-semibold">Página {page}</span>
        <div className="flex gap-3">
          <button
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700/50 shadow-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700/50 shadow-sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={items.length < 20}
          >
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function QrStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="badge-pending">
          <Clock className="w-3 h-3 text-amber-400" /> Pending
        </span>
      );
    case 'APPROVED':
      return (
        <span className="badge-approved">
          <CheckCircle2 className="w-3 h-3 text-blue-400" /> Approved
        </span>
      );
    case 'PAID':
      return (
        <span className="badge-paid">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Paid
        </span>
      );
    case 'REJECTED':
      return (
        <span className="badge-rejected">
          <XCircle className="w-3 h-3 text-red-400" /> Rejected
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="badge-outline bg-slate-800/20 text-slate-400 border border-slate-700/30 px-3 py-1 rounded-full text-xs font-semibold">
          <Ban className="w-3 h-3 text-slate-400 inline mr-1" /> Cancelled
        </span>
      );
    case 'ERROR':
      return (
        <span className="badge-error">
          <AlertCircle className="w-3 h-3 text-red-400" /> Error
        </span>
      );
    default:
      return <span className="badge">{status}</span>;
  }
}
