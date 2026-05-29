import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  timeoutId: NodeJS.Timeout;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL = 30_000; // 30s

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      clearTimeout(entry.timeoutId);
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = this.DEFAULT_TTL): void {
    const existing = this.store.get(key);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    const timeoutId = setTimeout(() => {
      this.store.delete(key);
    }, ttlMs);

    this.store.set(key, { value, expiresAt: Date.now() + ttlMs, timeoutId });
  }

  del(key: string): void {
    const existing = this.store.get(key);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }
    this.store.delete(key);
  }

  delete(key: string): void {
    this.del(key);
  }

  clear(): void {
    this.store.forEach((entry) => clearTimeout(entry.timeoutId));
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
