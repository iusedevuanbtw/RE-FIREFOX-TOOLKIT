(function() {
  if (window.__RE_RECORDER__) return;
  window.__RE_RECORDER__ = true;
  
  let active = false;
  
  function send(data) {
    if (!active) return;
    browser.runtime.sendMessage({ action: "action", data: data }).catch(function(){});
  }
  
  function getSelector(el) {
    if (!el || el === document || el === document.body) return 'body';
    if (el.id) return '#' + el.id;
    if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
    var aria = el.getAttribute('aria-label');
    if (aria) return '[aria-label="' + aria + '"]';
    var testId = el.getAttribute('data-testid');
    if (testId) return '[data-testid="' + testId + '"]';
    if (el.className && typeof el.className === 'string') {
      var cls = el.className.trim().split(/\s+/)[0];
      if (cls && !/[\[\]:()]/.test(cls)) return '.' + cls;
    }
    var path = [];
    var cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      var seg = cur.tagName.toLowerCase();
      if (cur.id) {
        path.unshift('#' + cur.id);
        break;
      }
      var parent = cur.parentElement;
      if (parent) {
        var idx = Array.prototype.indexOf.call(parent.children, cur) + 1;
        seg += ':nth-child(' + idx + ')';
      }
      path.unshift(seg);
      cur = parent;
    }
    return path.join(' > ');
  }
  
  document.addEventListener('click', function(e) {
    send({
      type: 'click',
      tag: e.target.tagName.toLowerCase(),
      sel: getSelector(e.target),
      text: (e.target.textContent || '').trim().slice(0, 60),
      x: e.clientX,
      y: e.clientY,
      href: e.target.href || '',
      url: location.href
    });
  }, true);
  
  document.addEventListener('input', function(e) {
    var t = e.target;
    if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && t.tagName !== 'SELECT') return;
    send({
      type: 'input',
      tag: t.tagName.toLowerCase(),
      sel: getSelector(t),
      inputType: t.type || 'text',
      name: t.name || '',
      val: t.type === 'password' ? '***' : String(t.value).slice(0, 200),
      url: location.href
    });
  }, true);
  
  document.addEventListener('change', function(e) {
    var t = e.target;
    if (t.tagName !== 'SELECT') return;
    send({
      type: 'change',
      tag: 'select',
      sel: getSelector(t),
      name: t.name || '',
      val: t.value,
      text: t.options[t.selectedIndex] ? t.options[t.selectedIndex].text : '',
      url: location.href
    });
  }, true);
  
  document.addEventListener('submit', function(e) {
    var t = e.target;
    if (t.tagName !== 'FORM') return;
    var fd = new FormData(t);
    var data = {};
    for (var pair of fd.entries()) {
      data[pair[0]] = String(pair[1]).slice(0, 100);
    }
    send({
      type: 'submit',
      tag: 'form',
      sel: getSelector(t),
      action: t.action || location.href,
      method: t.method || 'GET',
      fields: data,
      url: location.href
    });
  }, true);
  
  var scrollTimer = null;
  window.addEventListener('scroll', function() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      send({
        type: 'scroll',
        x: window.scrollX,
        y: window.scrollY,
        url: location.href
      });
    }, 250);
  }, true);
  
  browser.runtime.onMessage.addListener(function(msg) {
    if (msg.action === 'start') {
      active = true;
      console.log('%c[RE] recording started', 'color:#0f0;font-weight:bold');
    }
    if (msg.action === 'stop') {
      active = false;
      console.log('%c[RE] recording stopped', 'color:#f00;font-weight:bold');
    }
  });
  
  console.log('%c[RE] ready', 'color:#666');
})();
