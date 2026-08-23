window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== 'lookbox-app') return;
  chrome.runtime.sendMessage(data, (result) => {
    window.postMessage({
      source: 'lookbox-ext',
      replyTo: data.id,
      result: result || null,
      lastError: (chrome.runtime.lastError && chrome.runtime.lastError.message) || '',
    }, '*');
  });
});

window.postMessage({ source: 'lookbox-ext', type: 'ready' }, '*');
