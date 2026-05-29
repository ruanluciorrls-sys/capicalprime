'use client';

import { create } from 'zustand';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  bankAdapter: string | null;
  hasBankConfig?: boolean;
}

interface UserStore {
  profile: UserProfile | null;
  asaasBalance: number | null;
  setProfile: (profile: UserProfile | null) => void;
  setAsaasBalance: (balance: number | null) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  profile: null,
  asaasBalance: null,
  setProfile: (profile) => set({ profile }),
  setAsaasBalance: (asaasBalance) => set({ asaasBalance }),
}));
