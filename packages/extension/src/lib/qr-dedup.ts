// Dedup por hash com TTL de 2 minutos.
// Mesmo QR bloqueado por 2 min após envio confirmado.
// Após 2 min, o mesmo payload pode ser reenviado (ex: QR renovado no site).
export class QrDedup {
  private hashes: Map<string, number> = new Map(); // hash -> timestamp do envio
  private readonly storageKey = 'aios_qr_hashes';
  private readonly TTL_MS = 2 * 60 * 1000; // 2 minutos

  async load(): Promise<void> {
    const data = await chrome.storage.local.get(this.storageKey);
    const stored = data[this.storageKey];
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      const now = Date.now();
      for (const [hash, ts] of Object.entries(stored as Record<string, number>)) {
        if (now - ts < this.TTL_MS) {
          this.hashes.set(hash, ts);
        }
        // Entradas expiradas são simplesmente ignoradas no carregamento
      }
    }
  }

  has(hash: string): boolean {
    const ts = this.hashes.get(hash);
    if (ts === undefined) return false;
    if (Date.now() - ts > this.TTL_MS) {
      this.hashes.delete(hash);
      return false;
    }
    return true;
  }

  async add(hash: string): Promise<void> {
    const now = Date.now();
    this.hashes.set(hash, now);

    // Remove expirados
    for (const [h, ts] of this.hashes.entries()) {
      if (now - ts > this.TTL_MS) this.hashes.delete(h);
    }

    // Limita a 1000 entradas (remove os mais antigos)
    if (this.hashes.size > 1000) {
      const sorted = Array.from(this.hashes.entries()).sort(([, a], [, b]) => a - b);
      this.hashes = new Map(sorted.slice(sorted.length - 1000));
    }

    await chrome.storage.local.set({
      [this.storageKey]: Object.fromEntries(this.hashes),
    });
  }
}
