'use client';
import { useEffect, useState } from 'react';
import { Trash2, Wifi, WifiOff, Loader2, DownloadCloud } from 'lucide-react';
import { useExtensionStore } from '@/store/extensionStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { authHeaders, getApiKey } from '@/lib/apiKey';
import toast from 'react-hot-toast';

export default function ExtensionsPage() {
  const { extensions, fetchExtensions, revokeExtension } = useExtensionStore();
  const [loading, setLoading] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadExtension = async () => {
    try {
      setIsDownloading(true);
      const apiKey = getApiKey();
      if (!apiKey) {
        toast.error('API Key não configurada');
        return;
      }
      
      const toastId = toast.loading('Gerando extensão...');
      
      const res = await fetch('/api/extension/download', {
        headers: authHeaders({ 'X-Api-Key': apiKey }),
      });
      
      if (!res.ok) {
        throw new Error('Falha ao baixar extensão');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'capital-prime-extension.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Extensão baixada com sucesso!', { id: toastId });

      // Revalidar lista de extensões para mostrar o novo dispositivo registrado
      console.log('[DASHBOARD] Lista de extensões atualizada após download');
      await fetchExtensions();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao baixar extensão');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    fetchExtensions().finally(() => setLoading(false));
  }, []);

  // Pre-populate onlineStatus map when extensions are loaded/fetched
  useEffect(() => {
    if (extensions.length > 0) {
      setOnlineStatus((prev) => {
        const next = { ...prev };
        extensions.forEach((ext) => {
          // Only initialize if not already set by WebSocket to avoid overwriting newer real-time events
          if (next[ext.deviceId] === undefined) {
            next[ext.deviceId] = ext.isOnline ?? (ext.connectionStatus === 'ONLINE');
          }
        });
        return next;
      });
    }
  }, [extensions]);

  const { socket } = useWebSocket();

  useEffect(() => {
    if (!socket) return;

    const onOnline = (event: any) => {
      const data = event?.data ?? event;
      if (data?.deviceId) {
        setOnlineStatus((prev) => ({ ...prev, [data.deviceId]: true }));
      }
    };

    const onOffline = (event: any) => {
      const data = event?.data ?? event;
      if (data?.deviceId) {
        setOnlineStatus((prev) => ({ ...prev, [data.deviceId]: false }));
      }
    };

    socket.on('DEVICE_ONLINE', onOnline);
    socket.on('DEVICE_OFFLINE', onOffline);

    return () => {
      socket.off('DEVICE_ONLINE', onOnline);
      socket.off('DEVICE_OFFLINE', onOffline);
    };
  }, [socket]);

  if (loading) return <div className="p-8 text-center">Carregando extensões...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Extensões Vinculadas</h1>
        <button 
          onClick={handleDownloadExtension}
          disabled={isDownloading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all border border-blue-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DownloadCloud className="w-4 h-4" />
          {isDownloading ? 'Gerando...' : 'Baixar Extensão'}
        </button>
      </div>
      {extensions.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-8 text-center text-slate-400">
          Nenhuma extensão vinculada. Baixe a extensão no menu superior.
        </div>
      ) : (
        <div className="grid gap-4">
          {extensions.map((ext) => (
            <DeviceRow
              key={ext.id}
              ext={ext}
              revokeExtension={revokeExtension}
              statusFromMap={onlineStatus[ext.deviceId]}
              onStatusUpdate={(status) =>
                setOnlineStatus((prev) => ({ ...prev, [ext.deviceId]: status }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceRow({
  ext,
  revokeExtension,
  statusFromMap,
  onStatusUpdate,
}: {
  ext: any;
  revokeExtension: (id: string) => void;
  statusFromMap: boolean | undefined;
  onStatusUpdate: (status: boolean) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const handleTest = async () => {
    setTesting(true);
    try {
      const apiKey = getApiKey();
      const res = await fetch(`/api/extension/devices/${ext.deviceId}/test`, {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setIsOnline(data.online);
        onStatusUpdate(data.online);
      } else {
        setIsOnline(false);
        onStatusUpdate(false);
      }
    } catch {
      setIsOnline(false);
      onStatusUpdate(false);
    } finally {
      setTesting(false);
    }
  };

  // Determine actual connection state based on priority
  // 1. If statusFromMap is defined (from WebSocket event or recent test), use it
  // 2. If isOnline is not null (from recent test), use it
  // 3. Fallback to ext.connectionStatus
  const resolvedOnline =
    statusFromMap !== undefined
      ? statusFromMap
      : isOnline !== null
      ? isOnline
      : ext.connectionStatus === 'ONLINE';

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 flex flex-wrap justify-between items-center gap-4">
      <div>
        <div className="flex items-center gap-2">
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          ) : resolvedOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : statusFromMap === false || isOnline === false ? (
            <WifiOff className="w-4 h-4 text-gray-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className="font-mono text-sm">{ext.deviceId.slice(0, 20)}...</span>
        </div>
        <div className="text-sm text-slate-400 mt-1">
          Versão: {ext.version || 'desconhecida'} | Navegador: {ext.browser || 'Chrome'}
        </div>
        <div className="text-xs text-slate-500">
          Último visto: {new Date(ext.lastSeen).toLocaleString()}
        </div>

        {(statusFromMap !== undefined || isOnline !== null) && (
          <div
            className={`text-xs mt-2 font-medium ${
              resolvedOnline ? 'text-green-400' : 'text-red-400'
            }`}
          >
            Resultado do teste: {resolvedOnline ? 'Online (Conectado)' : 'Offline (Desconectado)'}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className="px-4 py-2 rounded-xl bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition disabled:opacity-50"
        >
          {testing ? 'Testando...' : 'Testar Conexão'}
        </button>
        <button
          onClick={() => revokeExtension(ext.deviceId)}
          className="px-4 py-2 rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600/30 transition"
        >
          <Trash2 className="w-4 h-4 inline mr-1" /> Revogar
        </button>
      </div>
    </div>
  );
}
