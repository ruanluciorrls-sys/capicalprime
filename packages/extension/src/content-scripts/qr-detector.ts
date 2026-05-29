import jsQR from 'jsqr';

function normalizePixText(text: string) {
  return String(text || '')
    .replace(/\s+/g, '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .trim();
}

function isPixCandidate(text: string) {
  const clean = normalizePixText(text);

  return (
    clean.length >= 80 &&
    clean.startsWith('000201') &&
    clean.toLowerCase().includes('br.gov.bcb.pix') &&
    /6304[A-F0-9]{4}$/i.test(clean)
  );
}

function extractPixPayloadsFromText(text: string) {
  const clean = String(text || '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .trim();

  const regex = /000201[\s\S]*?br\.gov\.bcb\.pix[\s\S]*?6304[A-F0-9]{4}/gi;
  const matches = clean.match(regex) || [];

  return matches
    .map(normalizePixText)
    .filter(isPixCandidate);
}

class QrDetector {
  private observer: MutationObserver | null = null;
  private scanQueue: Set<Element> = new Set();
  private scanning = false;
  private processed = new WeakSet<Element>();
  private copyProcessed = new WeakSet<Element>();
  private recentHashes = new Map<string, number>();
  private readonly HASH_COOLDOWN_MS = 2 * 60 * 1000;
  private textScanTick = 0;

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  private start() {
    this.bindPasteListeners();
    this.scanDocument();

    this.observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof Element)) continue;
          if (node.tagName === 'CANVAS' || node.tagName === 'IMG') {
            this.queueScan(node);
            shouldProcess = true;
            continue;
          }
          const visualElements = node.querySelectorAll?.('canvas, img');
          if (visualElements && visualElements.length > 0) {
            visualElements.forEach((el) => this.queueScan(el));
            shouldProcess = true;
          }
        }
      }
      if (shouldProcess) this.processScanQueue();
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => this.scanDocument(), 2000);
  }

  private bindPasteListeners() {
    const pasteHandler = (event: ClipboardEvent) => {
      console.log('[CONTENT] Procurando padrão Pix');
      const text = event.clipboardData?.getData('text') ?? '';
      const payloads = extractPixPayloadsFromText(text);

      if (payloads.length === 0) {
        console.log('[CONTENT] Pix ignorado: não bate padrão');
        return;
      }

      console.log('[CONTENT] Pix candidato encontrado');
      payloads.forEach((payload) => {
        void this.dispatchCapture(payload, 'paste');
      });
    };

    document.addEventListener('paste', pasteHandler, true);
    document.querySelectorAll('input, textarea').forEach((el) => {
      el.addEventListener('paste', pasteHandler as EventListener, true);
    });
  }

  private scanDocument() {
    this.textScanTick += 1;
    if (this.textScanTick % 2 === 0) {
      this.scanTextSources();
    }

    document.querySelectorAll('canvas, img').forEach((el) => this.queueScan(el));
    void this.findAndClickCopyButtons();
    void this.processScanQueue();
  }

  private scanTextSources() {
    console.log('[CONTENT] Procurando padrão Pix');

    const textSources: string[] = [];
    textSources.push(document.body?.innerText || '');

    document.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      if (input.value) textSources.push(input.value);
    });
    document.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((textarea) => {
      if (textarea.value) textSources.push(textarea.value);
    });
    document.querySelectorAll<HTMLElement>('button, a, [role="button"]').forEach((el) => {
      const text = el.innerText || el.textContent || '';
      if (text) textSources.push(text);
    });

    const visibleNodes = document.querySelectorAll<HTMLElement>('p, span, div, li, strong, label, pre, code');
    let seen = 0;
    for (const el of Array.from(visibleNodes)) {
      if (seen >= 400) break;
      if (!this.isVisible(el)) continue;
      const txt = el.innerText || el.textContent || '';
      if (txt.length >= 80) {
        textSources.push(txt);
        seen += 1;
      }
    }

    const candidates = new Set<string>();
    for (const source of textSources) {
      extractPixPayloadsFromText(source).forEach((payload) => candidates.add(payload));
    }

    if (candidates.size === 0) {
      console.log('[CONTENT] Pix ignorado: não bate padrão');
      return;
    }

    console.log('[CONTENT] Pix candidato encontrado');
    for (const payload of candidates) {
      void this.dispatchCapture(payload, 'text_scan');
    }
  }

  private async findAndClickCopyButtons() {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, a, div[role="button"], span[role="button"]'));
    for (const button of buttons) {
      const text = (button.innerText || button.textContent || '').toLowerCase();
      if (
        !text.includes('copiar') &&
        !text.includes('copia e cola') &&
        !text.includes('pix')
      ) {
        continue;
      }

      if (this.copyProcessed.has(button)) continue;
      this.copyProcessed.add(button);
      await this.tryCopyAndValidate(button);
    }
  }

  private async tryCopyAndValidate(button: HTMLElement) {
    let before = '';
    try {
      before = await navigator.clipboard.readText();
    } catch {}

    button.click();
    await new Promise((resolve) => setTimeout(resolve, 700));

    let after = '';
    try {
      after = await navigator.clipboard.readText();
    } catch {}

    const beforeNormalized = normalizePixText(before);
    const afterNormalized = normalizePixText(after);
    if (!afterNormalized || beforeNormalized === afterNormalized) return;

    console.log('[CONTENT] Procurando padrão Pix');
    const payloads = extractPixPayloadsFromText(afterNormalized);
    if (payloads.length === 0) {
      console.log('[CONTENT] Pix ignorado: não bate padrão');
      return;
    }

    console.log('[CONTENT] Pix candidato encontrado');
    for (const payload of payloads) {
      await this.dispatchCapture(payload, 'copy_button');
    }
  }

  private queueScan(el: Element) {
    if (!this.processed.has(el)) this.scanQueue.add(el);
  }

  private async processScanQueue() {
    if (this.scanning || this.scanQueue.size === 0) return;
    this.scanning = true;

    for (const el of this.scanQueue) {
      await this.scanElement(el);
      this.scanQueue.delete(el);
    }

    this.scanning = false;
  }

  private async scanElement(el: Element) {
    try {
      let imageData: ImageData | null = null;

      if (el instanceof HTMLCanvasElement) {
        const ctx = el.getContext('2d');
        if (ctx && el.width > 0 && el.height > 0) {
          imageData = ctx.getImageData(0, 0, el.width, el.height);
        }
      } else if (el instanceof HTMLImageElement) {
        if (el.complete && el.naturalWidth > 0 && el.naturalHeight > 0) {
          imageData = this.imgToImageData(el);
        } else {
          el.addEventListener('load', () => this.queueScan(el), { once: true });
          return;
        }
      }

      if (!imageData) return;

      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (!code?.data) return;

      console.log('[CONTENT] Procurando padrão Pix');
      const payloads = extractPixPayloadsFromText(code.data);
      if (payloads.length === 0) {
        console.log('[CONTENT] Pix ignorado: não bate padrão');
        return;
      }

      this.processed.add(el);
      console.log('[CONTENT] Pix candidato encontrado');
      for (const payload of payloads) {
        await this.dispatchCapture(payload, 'jsqr');
      }
    } catch {
      // Ignore CORS/tainted canvas errors
    }
  }

  private async dispatchCapture(payload: string, method: string) {
    const cleanPayload = normalizePixText(payload);
    if (!isPixCandidate(cleanPayload)) {
      console.log('[CONTENT] Pix ignorado: não bate padrão');
      return;
    }

    const payloadHash = await this.sha256(cleanPayload);
    this.cleanupCooldown();
    if (this.isInCooldown(payloadHash)) {
      console.log('[CONTENT] Pix ignorado: não bate padrão');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'PIX_CODE_DETECTED',
        payload: cleanPayload,
        sourceUrl: window.location.href,
        metadata: {
          pageTitle: document.title,
          capturedAt: new Date().toISOString(),
          captureMethod: method,
          payloadHash,
        },
      });
      console.log('[CONTENT] Pix enviado ao background');

      if (response?.ok || response?.error === 'duplicate_local' || response?.error === 'duplicate_global') {
        this.recentHashes.set(payloadHash, Date.now());
      }
    } catch (err: any) {
      if (!err?.message?.includes('Extension context invalidated')) {
        console.error('[CONTENT] Erro ao enviar mensagem para background:', err);
      }
    }
  }

  private isVisible(el: HTMLElement): boolean {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  private isInCooldown(hash: string): boolean {
    const ts = this.recentHashes.get(hash);
    return typeof ts === 'number' && (Date.now() - ts) < this.HASH_COOLDOWN_MS;
  }

  private cleanupCooldown() {
    const now = Date.now();
    for (const [hash, ts] of this.recentHashes.entries()) {
      if (now - ts > this.HASH_COOLDOWN_MS) {
        this.recentHashes.delete(hash);
      }
    }
  }

  private async sha256(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private imgToImageData(img: HTMLImageElement): ImageData | null {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return null;
    }
  }
}

const detector = new QrDetector();
detector.init();
