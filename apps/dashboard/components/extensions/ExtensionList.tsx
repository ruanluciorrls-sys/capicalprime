'use client';

import { useEffect } from 'react';
import { Monitor, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useExtensionStore } from '@/store/extensionStore';

function formatRelative(dateStr: string | null) {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min atras`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h atras`;
  return `${Math.floor(hr / 24)} d atras`;
}

function shortDeviceId(id: string) {
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

export function ExtensionList() {
  const { extensions, fetchExtensions, revokeExtension } = useExtensionStore();

  useEffect(() => {
    fetchExtensions().catch(() => toast.error('Falha ao carregar extensoes'));
  }, [fetchExtensions]);

  const activeCount = extensions.filter((d) => d.connectionStatus === 'ONLINE').length;

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Extensoes online</p>
          <p className="text-2xl font-semibold text-emerald-400">{activeCount}</p>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Total de dispositivos</p>
          <p className="text-2xl font-semibold text-white">{extensions.length}</p>
        </div>
      </div>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Extensoes vinculadas</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {extensions.length === 0 && (
            <p className="text-sm text-slate-400 p-4">Nenhuma extensao vinculada.</p>
          )}
          {extensions.map((device) => (
            <div key={device.deviceId} className="p-4 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-white font-medium">{device.browser ?? 'Browser desconhecido'}</p>
                <p className="text-xs text-slate-400">ID: {shortDeviceId(device.deviceId)}</p>
                <p className="text-xs text-slate-500">Ultimo acesso: {formatRelative(device.lastSeen)}</p>
                {'lastError' in device && device.lastError && <p className="text-xs text-amber-400">{String(device.lastError)}</p>}
              </div>

              <div className="flex items-center gap-3">
                <span className={clsx('text-xs font-semibold px-2 py-1 rounded-full border', {
                  'text-emerald-400 border-emerald-400/30 bg-emerald-400/10': device.connectionStatus === 'ONLINE',
                  'text-red-400 border-red-400/30 bg-red-400/10': device.connectionStatus === 'OFFLINE',
                  'text-amber-400 border-amber-400/30 bg-amber-400/10': device.connectionStatus === 'ERROR',
                })}>
                  {device.connectionStatus}
                </span>
                <button
                  onClick={() => revokeExtension(device.deviceId)
                    .then(() => toast.success('Extensao revogada'))
                    .catch(() => toast.error('Erro ao revogar extensao'))}
                  className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Revogar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
