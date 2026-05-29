'use client';
import { useEffect, useState } from 'react';
import { getApiKey } from '@/lib/apiKey';
import { Shield, Activity, Search } from 'lucide-react';

interface AuditLog {
  id: number;
  entity: string;
  entityId: string;
  action: string;
  actorId: string | null;
  oldData: any;
  newData: any;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const apiKeyLocal = getApiKey();
      if (!apiKeyLocal) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/logs?limit=50', {
          headers: { 'X-Api-Key': apiKeyLocal },
        });
        if (res.ok) {
          const data = await res.json();
          setLogs(data.items || []);
        }
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Carregando logs de auditoria...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-slate-700/50 rounded-lg">
          <Shield className="w-6 h-6 text-slate-300" />
        </div>
        <h1 className="text-2xl font-bold text-white">Auditoria do Sistema</h1>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-800 text-xs uppercase text-slate-300">
              <tr>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Ação</th>
                <th className="px-6 py-4">Entidade</th>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-xs bg-slate-700/50 text-slate-300 px-2.5 py-1 rounded-full font-medium">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-300">{log.entity}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{log.entityId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-300">{log.actorId || 'Sistema'}</div>
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate text-xs font-mono" title={JSON.stringify(log.newData || log.oldData)}>
                    {log.newData ? JSON.stringify(log.newData) : log.oldData ? JSON.stringify(log.oldData) : '-'}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhum log de auditoria encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
