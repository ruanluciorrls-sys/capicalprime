const RECENT_TTL_MS = 1000;
const recentPayloads = new Map();

function normalizePayload(value) {
  return String(value || '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .replace(/[\r\n\t]/g, '')
    .trim();
}

function isPix(payload) {
  return payload.startsWith('000201') && payload.toLowerCase().includes('br.gov.bcb.pix');
}

function isRecentlySent(payload) {
  const now = Date.now();
  const lastSentAt = recentPayloads.get(payload);

  for (const [key, timestamp] of recentPayloads.entries()) {
    if (now - timestamp > RECENT_TTL_MS) {
      recentPayloads.delete(key);
    }
  }

  if (lastSentAt && now - lastSentAt < RECENT_TTL_MS) {
    return true;
  }

  recentPayloads.set(payload, now);
  return false;
}

function emitPayload(rawPayload) {
  const payload = normalizePayload(rawPayload);
  if (!isPix(payload) || isRecentlySent(payload)) {
    return;
  }

  chrome.runtime.sendMessage({ type: 'QR_DETECTED', payload, sourceUrl: window.location.href }, () => {
    if (chrome.runtime.lastError) {
      recentPayloads.delete(payload);
    }
  });
}

async function readClipboardAfterCopy() {
  try {
    const copiedText = await navigator.clipboard.readText();
    emitPayload(copiedText);
  } catch (_error) {
    const selection = window.getSelection?.()?.toString() || '';
    emitPayload(selection);
  }
}

document.addEventListener('copy', () => {
  setTimeout(readClipboardAfterCopy, 50);
}, true);

document.addEventListener('paste', (event) => {
  const pastedText = event.clipboardData?.getData('text/plain') || '';
  emitPayload(pastedText);
}, true);
