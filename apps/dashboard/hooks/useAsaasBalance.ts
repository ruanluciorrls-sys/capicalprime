'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiKey } from '@/lib/apiKey';
import { getBalance } from '@/services/api';

export function useAsaasBalance(intervalMs = 30000) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setBalance(null);
      return;
    }

    setLoading(true);
    try {
      const res = await getBalance(apiKey);
      if (!res.ok) {
        setBalance(null);
        return;
      }
      const data = await res.json();
      setBalance(typeof data?.available === 'number' ? data.available : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, refresh]);

  return { balance, loading, refresh };
}
