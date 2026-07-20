(() => {
  if (window.__re_recorder) return;
  window.__re_recorder = true;
  
  let recording = false;
  
  function send(data) {
    if (!recording) return;
    browser.runtime.sendMessage({ action: "pushAction", data }).catch(() => {});
  }
  
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.action === "recordingStarted") recording = true;
    if (msg.action === "recordingStopped") recording = false;
  });
  
  function selector(el) {
    if (!el || el === document || el === document.body) return 'body';
    if (el.id) return `#${el.id}`;
    if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
    if (el.getAttribute('aria-label')) return `[aria-label="${el.getAttribute('aria-label')}"]`;
    if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
    if (el.className && typeof el.className === 'string') {
      const c = el.className.trim().split(/\s+/)[0];
      if (c && !/[:[\]()]/.test(c)) return `.${c}`;
    }
    let path = [];
    let cur = el;
    while (cur && cur !== document.body) {
      let seg = cur.tagName.toLowerCase();
      if (cur.id) { path.unshift(`#${cur.id}`); break; }
      const p = cur.parentElement;
      if (p) {
        const idx = Array.from(p.children).indexOf(cur) + 1;
        seg += `:nth-child(${idx})`;
      }
      path.unshift(seg);
      cur = p;
    }
    return path.join(' > ');
  }
  
  document.addEventListener('click', (e) => {
    send({
      type: 'click',
      tag: e.target.tagName.toLowerCase(),
      sel: selector(e.target),
      text: (e.target.textContent || '').trim().slice(0, 60),
      x: e.clientX,
      y: e.clientY,
      href: e.target.href || '',
      url: location.href
    });
  }, true);
  
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!['INPUT','TEXTAREA','SELECT'].includes(t.tagName)) return;
    send({
      type: 'input',
      tag: t.tagName.toLowerCase(),
      sel: selector(t),
      inputType: t.type || 'text',
      name: t.name || '',
      val: t.type === 'password' ? '***' : String(t.value).slice(0, 200),
      url: location.href
    });
  }, true);
  
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.tagName !== 'SELECT') return;
    send({
      type: 'change',
      tag: 'select',
      sel: selector(t),
      name: t.name || '',
      val: t.value,
      text: t.options[t.selectedIndex]?.text || '',
      url: location.href
    });
  }, true);
  
  document.addEventListener('submit', (e) => {
    const t = e.target;
    if (t.tagName !== 'FORM') return;
    const fd = new FormData(t);
    const data = {};
    for (let [k,v] of fd) data[k] = String(v).slice(0, 100);
    send({
      type: 'submit',
      tag: 'form',
      sel: selector(t),
      action: t.action || location.href,
      method: t.method || 'GET',
      fields: data,
      url: location.href
    });
  }, true);
  
  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      send({
        type: 'scroll',
        x: window.scrollX,
        y: window.scrollY,
        url: location.href
      });
    }, 250);
  }, true);
  
  window.addEventListener('hashchange', () => {
    send({
      type: 'navigation',
      url: location.href,
      hash: location.hash
    });
  }, true);
  
  new MutationObserver((mutations) => {
    for (let m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length) {
        for (let n of m.addedNodes) {
          if (n.nodeType === 1 && /^(script|iframe|img|video|audio|link|meta)$/i.test(n.tagName)) {
            send({
              type: 'dom',
              tag: n.tagName.toLowerCase(),
              src: n.src || n.href || '',
              url: location.href
            });
          }
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });
  
  console.log('%c[RE Toolkit] %cRecorder ready', 'color:#0f0', 'color:#888');
})();
