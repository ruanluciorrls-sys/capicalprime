(function () {
  // ==================== INTERCEPTADOR DE CLIPBOARD ====================
  const originalWriteText = navigator.clipboard?.writeText?.bind(navigator.clipboard);

  if (originalWriteText) {
    navigator.clipboard.writeText = async function (text) {
      try {
        window.postMessage({
          source: 'AIOS_PIX_CAPTURE',
          type: 'CLIPBOARD_WRITE_TEXT',
          text
        }, '*');
      } catch (e) {}

      return originalWriteText(text);
    };
  }

  // ==================== INTERCEPTADOR DE REDE (FETCH / XHR) ====================
  // Procura por códigos PIX em URLs de requisições disparadas pelo site
  
  function checkUrlForPix(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return;
    try {
      const match = urlStr.match(/000201[\s\S]*?br\.gov\.bcb\.pix[\s\S]*?6304[A-F0-9]{4}/i);
      if (match) {
        window.postMessage({
          source: 'AIOS_PIX_CAPTURE',
          type: 'NETWORK_INTERCEPT',
          text: match[0]
        }, '*');
      }
    } catch (e) {}
  }

  // 1. Interceptar Fetch
  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = async function (...args) {
      const url = args[0];
      if (typeof url === 'string') {
        checkUrlForPix(url);
      } else if (url instanceof Request) {
        checkUrlForPix(url.url);
      }
      return originalFetch.apply(this, args);
    };
  }

  // 2. Interceptar XHR
  const originalOpen = XMLHttpRequest.prototype.open;
  if (originalOpen) {
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      if (typeof url === 'string') {
        checkUrlForPix(url);
      }
      return originalOpen.call(this, method, url, ...rest);
    };
  }
})();
