// content.js â€” AI OS Pix Capture Extension (Content Script)

// ==================== UTILITÃRIOS ====================
function normalizeLabel(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizePixPayload(text) {
  if (!text) return '';
  let value = String(text);
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }
  return value
    .replace(/\s+/g, '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .trim();
}

function maskQr(text) {
  if (!text) return '';
  const clean = normalizePixPayload(text);
  if (clean.length <= 18) return clean;
  return clean.slice(0, 10) + '******' + clean.slice(-8);
}

function isValidPixPayload(payload) {
  if (!payload) return false;
  const clean = normalizePixPayload(payload);
  
  if (clean.length < 80) return false;
  if (!clean.startsWith('000201')) return false;
  if (!clean.toLowerCase().includes('br.gov.bcb.pix')) return false;

  // ValidaÃ§Ã£o universal do campo CRC16: "6304" + 4 caracteres hexadecimais no final do cÃ³digo
  const crcMatch = /6304[0-9a-fA-F]{4}$/.test(clean);
  if (!crcMatch) return false;

  return true;
}

function extractPixPayloadsFromText(text) {
  const raw = String(text || '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .trim();

  const regex = /000201[\s\S]*?br\.gov\.bcb\.pix[\s\S]*?6304[A-F0-9]{4}/gi;
  const matches = raw.match(regex) || [];

  return matches
    .map(normalizePixPayload)
    .filter(isValidPixPayload);
}

function extractPixFromUrl(urlText) {
  const results = [];
  const urlRaw = String(urlText || '');
  if (!urlRaw) return results;

  try {
    const normalizedUrl = /^https?:\/\//i.test(urlRaw)
      ? urlRaw
      : `https://dummy.local/${urlRaw.replace(/^\/?/, '')}`;
    const url = new URL(normalizedUrl);
    const keys = ['qrcode', 'qr', 'pix', 'payload', 'code', 'codigo'];
    for (const key of keys) {
      const value = url.searchParams.get(key);
      if (value) results.push(value);
    }
  } catch {
    // fallback abaixo
  }

  // Fallback para query malformada (quando URL parser falha em webviews/custom chromium)
  const rawQueryMatches = urlRaw.match(/(?:[?&](?:qrcode|qr|pix|payload|code|codigo)=)([^&#]+)/gi) || [];
  for (const m of rawQueryMatches) {
    const rawVal = m.replace(/^[^=]*=/, '');
    if (rawVal) results.push(rawVal);
  }

  const fromWholeUrl = extractPixPayloadsFromText(urlRaw);
  return [...new Set([...results, ...fromWholeUrl])]
    .map(normalizePixPayload)
    .filter(isValidPixPayload);
}

// ==================== CONTROLE DE ESTADO ====================
let isProcessing = false;

function sendMessageToBackground(message) {
  return new Promise((resolve) => {
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn('[CONTENT] chrome.runtime.sendMessage estÃ¡ indisponÃ­vel. A extensÃ£o pode ter sido atualizada ou recarregada. Por favor, recarregue a pÃ¡gina.');
      resolve({ ok: false, error: 'Extension context invalidated ou chrome.runtime undefined' });
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: 'Sem resposta do background' });
      });
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

// ==================== INJEÃ‡ÃƒO E INTERCEPTAÃ‡ÃƒO DE CLIPBOARD ====================
// Injeta a interceptaÃ§Ã£o do navigator.clipboard.writeText para detectar quando a pÃ¡gina copia um Pix via JS
try {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('injected-clipboard.js');
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
} catch (e) {
  console.warn('[CONTENT] Erro ao injetar script de interceptaÃ§Ã£o de clipboard:', e);
}

// Escuta a mensagem enviada pelo script injetado na pÃ¡gina
window.addEventListener('message', async (event) => {
  if (event.data && event.data.source === 'AIOS_PIX_CAPTURE' && event.data.type === 'CLIPBOARD_WRITE_TEXT') {
    const text = event.data.text;
    if (isValidPixPayload(text)) {
      console.log('[CONTENT] Pix interceptado via navigator.clipboard.writeText:', maskQr(text));
      
      try {
        const response = await sendMessageToBackground({
          type: 'PIX_CODE_DETECTED',
          payload: text,
          metadata: {
            sourceUrl: window.location.href,
            pageTitle: document.title,
            capturedAt: new Date().toISOString(),
            captureMethod: 'clipboard_intercept'
          }
        });
        
        if (response.ok) {
          console.log('[CONTENT] Pix interceptado enviado com sucesso para o painel.');
        } else {
          console.log('[CONTENT] Envio de Pix interceptado ignorado ou falhou:', response.error);
        }
      } catch (err) {
        console.error('[CONTENT] Erro ao enviar Pix interceptado para o background:', err);
      }
    }
  } else if (event.data && event.data.source === 'AIOS_PIX_CAPTURE' && event.data.type === 'NETWORK_INTERCEPT') {
    const text = event.data.text;
    if (isValidPixPayload(text)) {
      console.log('[CONTENT] Pix interceptado via XHR/Fetch URL:', maskQr(text));
      
      try {
        const response = await sendMessageToBackground({
          type: 'PIX_CODE_DETECTED',
          payload: text,
          metadata: {
            sourceUrl: window.location.href,
            pageTitle: document.title,
            capturedAt: new Date().toISOString(),
            captureMethod: 'network_intercept'
          }
        });
        
        if (response.ok) {
          console.log('[CONTENT] Pix interceptado enviado com sucesso para o painel.');
        } else {
          console.log('[CONTENT] Envio de Pix interceptado ignorado ou falhou:', response.error);
        }
      } catch (err) {
        console.error('[CONTENT] Erro ao enviar Pix interceptado para o background:', err);
      }
    }
  }
});

// ==================== PRIORIDADE 1 — Localizar Botão ====================
function findCopyQrButton() {
  const elements = Array.from(document.querySelectorAll('button, div[role="button"], a, span, p'));
  return elements.find(el => {
    const text = normalizeLabel(el.innerText || el.textContent);
    return text.includes('copiar codigo qr') || 
           text.includes('copiar qr') || 
           text.includes('copiar codigo') || 
           text.includes('endereco do codigo qr') ||
           text.includes('endereco qr') ||
           text.includes('copia e cola') ||
           text.includes('pix copia e cola') ||
           text.includes('pix copia') ||
           text.includes('copiar pix');
  });
}

function findAddressQrCopyButton() {
  const elements = Array.from(document.querySelectorAll('button, div, span, a, p'));
  const label = elements.find(el => {
    const text = normalizeLabel(el.innerText || el.textContent);
    return text.includes('endereco do codigo qr') || text.includes('endereco qr');
  });
  if (!label) return null;
  const container = label.closest('div') || label.parentElement || label;
  return Array.from(container.querySelectorAll('button, svg, span, div, a')).find(el => {
    if (el === label) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 5 && rect.height > 5 && style.display !== 'none' && style.visibility !== 'hidden';
  }) || null;
}

// ==================== FUNÇÃO DE CLIQUE E LEITURA (PRIORIDADE 1) ====================
async function tryCopyAndCapture(button) {
  let before = '';
  try {
    before = await navigator.clipboard.readText();
  } catch (e) {
    // Falha silenciosa de foco
  }

  console.log('[CONTENT] Botão de copiar encontrado.');
  button.click();
  console.log('[CONTENT] Botão de copiar clicado.');
  await new Promise(r => setTimeout(r, 800));
  
  let after = '';
  try {
    after = await navigator.clipboard.readText();
  } catch (e) {
    console.error('[CONTENT] Erro ao ler clipboard após clique (provável aba sem foco):', e);
    return null;
  }

  if (after && before && normalizePixPayload(after) === normalizePixPayload(before)) {
    console.log('[CONTENT] Conteúdo do clipboard não mudou após o clique.');
    return null;
  }

  return after ? after.trim() : null;
}

// ==================== PRIORIDADE 2 – Extração de Textos Visíveis (Regex) ====================
function findPixTextOnPage() {
  const fromUrl = extractPixFromUrl(window.location.href);
  if (fromUrl.length) return fromUrl[0];

  const elements = Array.from(document.querySelectorAll('body *'));
  for (const el of elements) {
    if (el.children.length === 0 && el.textContent) {
      const text = el.textContent.trim();
      const found = extractPixPayloadsFromText(text);
      if (found.length) return found[0];
    }
  }

  const pageText = document.body.innerText || '';
  const pageMatches = extractPixPayloadsFromText(pageText);
  if (pageMatches.length) return pageMatches[0];

  const formValues = Array.from(document.querySelectorAll('input, textarea'))
    .map(el => (el && typeof el.value === 'string' ? el.value : ''))
    .filter(Boolean)
    .join('\n');
  const formMatches = extractPixPayloadsFromText(formValues);
  if (formMatches.length) return formMatches[0];

  return null;
}

// ==================== PRIORIDADE 3 – Scanner jsQR ====================
async function scanCanvasAndImages() {
  if (typeof jsQR === 'undefined') return null;
  const elements = [...document.querySelectorAll('canvas, img, svg')];
  for (const el of elements) {
    let imageData = null;
    try {
      if (el instanceof HTMLCanvasElement) {
        if (el.width === 0 || el.height === 0) continue;
        const canvas = document.createElement('canvas');
        canvas.width = el.width;
        canvas.height = el.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;
        ctx.drawImage(el, 0, 0);
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } else if (el instanceof HTMLImageElement) {
        if (!el.complete || el.naturalWidth === 0 || el.naturalHeight === 0) continue;
        const canvas = document.createElement('canvas');
        canvas.width = el.naturalWidth;
        canvas.height = el.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;
        ctx.drawImage(el, 0, 0);
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } else if (el instanceof SVGSVGElement) {
        const xml = new XMLSerializer().serializeToString(el);
        const svg64 = btoa(unescape(encodeURIComponent(xml)));
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + svg64;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        if (img.width === 0 || img.height === 0) continue;
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }

      if (imageData) {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          const candidate = normalizePixPayload(code.data.trim());
          if (isValidPixPayload(candidate)) return candidate;
        }
      }
    } catch (err) {
      continue;
    }
  }
  return null;
}

// ==================== SCANNER PERIÓDICO (FUNÇÃO PRINCIPAL) ====================
async function scanAndCaptureRaw() {
  console.log('[CONTENT] Scanner executando...');
  if (isProcessing) return;

  // Busca inicial por elementos elegíveis na página
  const btn1 = findCopyQrButton();
  const btn2 = findAddressQrCopyButton();
  const canvasOrImg = document.querySelector('canvas, img');
  const visiblePixText = findPixTextOnPage();

  const detected = !!(btn1 || btn2 || canvasOrImg || visiblePixText);
  if (!detected) return;

  console.log('[CONTENT] QR Code detectado na página.');

  let rawContent = null;
  let method = '';

  // PRIORIDADE 1: Clicar no botão nativo
  if (btn1) {
    rawContent = await tryCopyAndCapture(btn1);
    if (rawContent) method = 'copy_button';
  }
  
  if (!rawContent && btn2) {
    rawContent = await tryCopyAndCapture(btn2);
    if (rawContent) method = 'address_icon';
  }

  // PRIORIDADE 2: Regex de textos visíveis
  if (!rawContent && visiblePixText) {
    console.log('[CONTENT] Fallback: Extraindo QR Code diretamente de textos visíveis na página.');
    rawContent = visiblePixText;
    method = 'visible_text';
  }

  // PRIORIDADE 3: Canvas / Imagem com jsQR
  if (!rawContent && canvasOrImg) {
    console.log('[CONTENT] Fallback: Escaneando imagem/canvas com jsQR.');
    rawContent = await scanCanvasAndImages();
    if (rawContent) method = 'jsqr_fallback';
  }

  // Se nada novo ou válido pôde ser lido, aborta
  if (!rawContent) {
    console.log('[CONTENT] Nenhum QR Code novo pôde ser extraído neste ciclo. Entrando em cooldown.');
    return;
  }

  // Guarda final: só envia se for um payload Pix válido — nunca envia URLs ou texto genérico
  if (!isValidPixPayload(rawContent)) {
    console.log('[CONTENT] Conteúdo capturado não é um Pix válido, descartando.');
    return;
  }

  console.log('[CONTENT] QR Code Pix válido capturado, enviando para background.');

  try {
    const response = await sendMessageToBackground({
      type: 'PIX_CODE_DETECTED',
      payload: rawContent,
      metadata: {
        sourceUrl: window.location.href,
        pageTitle: document.title,
        capturedAt: new Date().toISOString(),
        captureMethod: method
      }
    });

    if (response.ok) {
      console.log('[CONTENT] QR Code novo detectado, enviando para o painel.');
      isProcessing = true;
      setTimeout(() => { isProcessing = false; }, 60000);
    } else if (response.error === 'duplicate_local' || response.error === 'duplicate_global') {
      console.log('[CONTENT] QR Code jÃ¡ enviado anteriormente, ignorando reenvio.');
      isProcessing = true;
      setTimeout(() => { isProcessing = false; }, 60000);
    } else if (
      response.error === 'auth_block_cooldown' ||
      String(response.error || '').includes('HTTP 401') ||
      String(response.error || '').includes('HTTP 403')
    ) {
      console.warn('[CONTENT] Envio bloqueado por autenticacao/autorizacao. Entrando em cooldown de 2 minutos.');
      isProcessing = true;
      setTimeout(() => { isProcessing = false; }, 120000);
    } else {
      console.error('[BACKGROUND] Erro ao enviar QR Code para o painel: ' + (response.error || 'Erro desconhecido'));
    }
  } catch (err) {
    console.error('[BACKGROUND] Erro ao enviar QR Code para o painel:', err);
  }
}

// Inicia o scanner periÃ³dico a cada 5 segundos
setInterval(scanAndCaptureRaw, 5000);
scanAndCaptureRaw();

