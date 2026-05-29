'use client';

import { useEffect, useState } from 'react';
import { getApiKey } from '@/lib/apiKey';
import { getTransactions } from '@/services/api';
import { ChevronLeft, ChevronRight, Receipt, RefreshCw } from 'lucide-react';

interface PaymentHistoryItem {
  id: string;
  customer: string | null;
  value: number;
  status: string;
  dateCreated: string | null;
  paymentDate: string | null;
  billingType: string | null;
}

const BRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const statusColor = (status: string) => {
  const map: Record<string, string> = {
    PENDING: 'text-amber-400 bg-amber-500/10',
    RECEIVED: 'text-emerald-400 bg-emerald-500/10',
    OVERDUE: 'text-red-400 bg-red-500/10',
    REFUNDED: 'text-cyan-400 bg-cyan-500/10',
    CANCELLED: 'text-slate-300 bg-slate-500/10',
    FAILED: 'text-rose-400 bg-rose-500/10',
  };
  return map[status] || 'text-slate-400 bg-slate-500/10';
};

export default function TransactionsPage() {
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = async (currentPage: number) => {
    setLoading(true);
    setError('');
    const apiKey = getApiKey();
    if (!apiKey) {
      setLoading(false);
      return;
    }

    try {
      const res = await getTransactions(apiKey, currentPage, 20);
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Falha ao buscar histórico de pagamentos');
      }

      setItems(data?.items || []);
      setTotal(data?.meta?.total || 0);
      setTotalPages(data?.meta?.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar histórico');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(page);
  }, [page]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Receipt className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Histórico de Pagamentos</h1>
            {total > 0 && <p className="text-xs text-slate-400">{total} cobranças no total</p>}
          </div>
        </div>
        <button onClick={() => fetchData(page)} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-sm text-slate-300 disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 text-amber-400 text-sm">{error}</div>}

      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando histórico...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhuma cobrança encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800 text-xs uppercase text-slate-400 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Criado em</th>
                  <th className="px-6 py-4">Pago em</th>
                  <th className="px-6 py-4">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-700/20">
                    <td className="px-6 py-4 text-slate-300 font-mono">{item.id}</td>
                    <td className="px-6 py-4 text-slate-200">{item.customer || 'Não informado'}</td>
                    <td className="px-6 py-4 text-right text-emerald-400 font-mono">{BRL(item.value)}</td>
                    <td className="px-6 py-4"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(item.status)}`}>{item.status}</span></td>
                    <td className="px-6 py-4 text-slate-400">{item.dateCreated ? new Date(item.dateCreated).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-6 py-4 text-slate-400">{item.paymentDate ? new Date(item.paymentDate).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-6 py-4 text-slate-300">{item.billingType || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50">
            <span className="text-sm text-slate-400">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
