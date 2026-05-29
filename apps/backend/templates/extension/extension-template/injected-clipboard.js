(function () {
  const originalWriteText = navigator.clipboard?.writeText?.bind(navigator.clipboard);

  if (!originalWriteText) return;

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
})();
