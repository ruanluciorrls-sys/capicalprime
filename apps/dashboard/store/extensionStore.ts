import { create } from 'zustand';
import { getApiKey } from '@/lib/apiKey';

interface Extension {
  id: string;
  deviceId: string;
  browser: string | null;
  version: string | null;
  connectionStatus: 'ONLINE' | 'OFFLINE' | 'ERROR';
  lastSeen: string | null;
  isActive?: boolean;
  lastError?: string | null;
  isOnline?: boolean;
}

interface ExtensionStore {
  extensions: Extension[];
  loading: boolean;
  fetchExtensions: () => Promise<void>;
  revokeExtension: (deviceId: string) => Promise<void>;
  // Aceita partial — eventos DEVICE_ONLINE/DEVICE_OFFLINE chegam só com { deviceId, isOnline }.
  // No upsert: se existir, faz merge; se for novo, cria com defaults.
  upsertDevice: (device: Partial<Extension> & { deviceId: string }) => void;
}

export const useExtensionStore = create<ExtensionStore>((set, get) => ({
  extensions: [],
  loading: false,
  fetchExtensions: async () => {
    set({ loading: true });
    const apiKey = getApiKey();
    const res = await fetch('/api/extension/devices', { headers: { 'X-Api-Key': apiKey } });
    if (res.ok) {
      const data = await res.json();
      set({ extensions: data });
    }
    set({ loading: false });
  },
  revokeExtension: async (deviceId) => {
    const apiKey = getApiKey();
    await fetch(`/api/extension/devices/${deviceId}`, { method: 'DELETE', headers: { 'X-Api-Key': apiKey } });
    await get().fetchExtensions();
  },
  upsertDevice: (device) => {
    set((state) => {
      const index = state.extensions.findIndex((item) => item.deviceId === device.deviceId);
      if (index >= 0) {
        const next = [...state.extensions];
        next[index] = { ...next[index], ...device };
        return { extensions: next };
      }

      // Novo device chegando via WS sem dados completos — preenche defaults
      const newDevice: Extension = {
        id: device.id ?? device.deviceId,
        deviceId: device.deviceId,
        browser: device.browser ?? null,
        version: device.version ?? null,
        connectionStatus: device.connectionStatus ?? (device.isOnline ? 'ONLINE' : 'OFFLINE'),
        lastSeen: device.lastSeen ?? new Date().toISOString(),
        isActive: device.isActive,
        lastError: device.lastError,
        isOnline: device.isOnline,
      };
      return { extensions: [newDevice, ...state.extensions] };
    });
  },
}));
