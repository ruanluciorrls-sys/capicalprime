import { create } from 'zustand';
import { getApiKey } from '@/lib/apiKey';
import { getBankConfig } from '@/services/api';

export interface AsaasEnvironmentConfig {
  hasApiKey: boolean;
  maskedApiKey: string | null;
  environment: 'production' | 'sandbox' | null;
  accountHolderName: string | null;
  agency: string | null;
  accountNumber: string | null;
  balance: number | null;
  lastSyncAt: string | null;
  connected: boolean;
}

interface AsaasState {
  productionConfig: AsaasEnvironmentConfig | null;
  production2Config: AsaasEnvironmentConfig | null;
  production3Config: AsaasEnvironmentConfig | null;
  sandboxConfig: AsaasEnvironmentConfig | null;
  isLoading: boolean;
  rotationInterval: number;

  // Computed values for dashboard summary (priority: production > production2 > sandbox)
  accountHolderName: string | null;
  balance: number | null;
  agency: string | null;
  accountNumber: string | null;
  activeEnvironment: 'production' | 'sandbox' | null;
  isConnected: boolean;
  connectedCount: number;

  fetchAsaasData: () => Promise<void>;
  setAsaasStore: (data: Partial<AsaasState>) => void;
}

export const useAsaasStore = create<AsaasState>((set) => ({
  productionConfig: null,
  production2Config: null,
  production3Config: null,
  sandboxConfig: null,
  isLoading: false,
  rotationInterval: 10,

  accountHolderName: null,
  balance: null,
  agency: null,
  accountNumber: null,
  activeEnvironment: null,
  isConnected: false,
  connectedCount: 0,

  fetchAsaasData: async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      set({
        productionConfig: null, production2Config: null, production3Config: null, sandboxConfig: null,
        accountHolderName: null, balance: null, agency: null, accountNumber: null,
        activeEnvironment: null, isConnected: false, connectedCount: 0, isLoading: false,
      });
      return;
    }

    set({ isLoading: true });
    try {
      const res = await getBankConfig(apiKey);
      if (!res.ok) { set({ isLoading: false, isConnected: false }); return; }

      const cfg = await res.json();
      const asaasData = cfg?.bankConfig?.asaas || {};

      const prod  = asaasData.production  || null;
      const prod2 = asaasData.production2 || null;
      const prod3 = asaasData.production3 || null;
      const sand  = asaasData.sandbox     || null;
      const ri    = typeof asaasData.rotationInterval === 'number' ? asaasData.rotationInterval : 10;

      // Priority: production → production2 → production3 (sandbox nunca como primário)
      const activeEnv =
        prod?.connected  ? 'production' :
        prod2?.connected ? 'production' :
        prod3?.connected ? 'production' : null;

      // Conta primária: sempre de produção (sandbox não entra no saldo principal)
      const primaryProd = [prod, prod2, prod3].find(p => p?.connected) ?? null;
      const holderName = primaryProd?.accountHolderName || null;
      const balance = primaryProd && typeof primaryProd?.balance === 'number' ? primaryProd.balance : null;
      const agency  = primaryProd?.agency  || null;
      const account = primaryProd?.accountNumber || null;

      // connectedCount: apenas contas de produção (sandbox não conta para rodízio)
      const connectedCount = [prod, prod2, prod3].filter(c => c?.connected).length;

      set({
        productionConfig: prod, production2Config: prod2, production3Config: prod3, sandboxConfig: sand,
        activeEnvironment: activeEnv,
        accountHolderName: holderName,
        balance,
        agency,
        accountNumber: account,
        isConnected: activeEnv !== null,
        connectedCount,
        rotationInterval: ri,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, isConnected: false });
    }
  },

  setAsaasStore: (data) => set((state) => ({ ...state, ...data })),
}));
