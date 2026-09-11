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
    }, window.location.origin);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'LOOKBOX_ORDER_EVENT') return;
  window.postMessage({
    source: 'lookbox-ext',
    eventFor: message.requestId,
    event: message.event || null,
  }, window.location.origin);
});

window.postMessage({ source: 'lookbox-ext', type: 'ready' }, window.location.origin);
