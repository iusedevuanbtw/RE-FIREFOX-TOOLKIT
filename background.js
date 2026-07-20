var state = {
  requests: [],
  recording: false,
  startTime: 0,
  actions: []
};

browser.webRequest.onBeforeRequest.addListener(
  function(d) {
    if (d.tabId < 0) return;
    state.requests.unshift({
      id: d.requestId,
      url: d.url,
      method: d.method,
      requestBody: d.requestBody,
      timeStamp: d.timeStamp,
      tabId: d.tabId,
      type: d.type,
      statusCode: null,
      requestHeaders: null,
      responseHeaders: null
    });
    if (state.requests.length > 200) state.requests.length = 200;
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

browser.webRequest.onSendHeaders.addListener(
  function(d) {
    var req = state.requests.find(function(r) { return r.id === d.requestId; });
    if (req) req.requestHeaders = d.requestHeaders;
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

browser.webRequest.onCompleted.addListener(
  function(d) {
    var req = state.requests.find(function(r) { return r.id === d.requestId; });
    if (req) {
      req.statusCode = d.statusCode;
      req.responseHeaders = d.responseHeaders;
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

function injectRecorder(tabId) {
  var code = `
    (function() {
      if (window.__re_recorder) {
        window.__re_recorder.active = true;
        return 'already_loaded';
      }
      
      window.__re_recorder = { active: true };
      
      function send(data) {
        if (!window.__re_recorder.active) return;
        browser.runtime.sendMessage({ action: 'pushAction', data: data }).catch(function(){});
      }
      
      function sel(el) {
        if (!el || el === document.body || el === document.documentElement) return 'body';
        if (el.id) return '#' + el.id;
        if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
        var a = el.getAttribute('aria-label');
        if (a) return '[aria-label="' + a + '"]';
        var t = el.getAttribute('data-testid');
        if (t) return '[data-testid="' + t + '"]';
        var r = el.getAttribute('role');
        if (el.className && typeof el.className === 'string') {
          var c = el.className.trim().split(/\\s+/).filter(function(x) {
            return x && !/[\\[\\]:()#]/.test(x) && x.indexOf('css-') !== 0;
          })[0];
          if (c) return '.' + c;
        }
        if (r) return el.tagName.toLowerCase() + '[role="' + r + '"]';
        var path = [];
        var cur = el;
        var depth = 0;
        while (cur && cur !== document.body && depth < 5) {
          var seg = cur.tagName.toLowerCase();
          if (cur.id) { path.unshift('#' + cur.id); break; }
          var p = cur.parentElement;
          if (p) {
            var idx = Array.prototype.indexOf.call(p.children, cur) + 1;
            seg += ':nth-child(' + idx + ')';
          }
          path.unshift(seg);
          cur = p;
          depth++;
        }
        return path.join(' > ');
      }
      
      function getText(el) {
        var t = el.textContent || '';
        t = t.trim().replace(/\\s+/g, ' ').slice(0, 80);
        if (!t && el.value) t = el.value.slice(0, 80);
        if (!t && el.placeholder) t = '[placeholder: ' + el.placeholder.slice(0, 60) + ']';
        if (!t && el.getAttribute('aria-label')) t = '[aria: ' + el.getAttribute('aria-label').slice(0, 60) + ']';
        if (!t && el.title) t = '[title: ' + el.title.slice(0, 60) + ']';
        return t;
      }
      
      function recordClick(e) {
        var t = e.target;
        while (t && t !== document.body) {
          if (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'INPUT' || 
              t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
              t.getAttribute('role') === 'button' || t.getAttribute('role') === 'tab' ||
              t.getAttribute('role') === 'link' || t.getAttribute('role') === 'menuitem' ||
              t.onclick || t.classList.contains('btn') || t.classList.contains('button') ||
              t.tagName === 'DIV' && (t.tabIndex >= 0 || t.getAttribute('data-testid'))) {
            break;
          }
          t = t.parentElement;
        }
        if (!t || t === document.body) t = e.target;
        
        send({
          type: 'click',
          tag: t.tagName.toLowerCase(),
          sel: sel(t),
          text: getText(t),
          x: e.clientX,
          y: e.clientY,
          href: t.href || '',
          classes: (t.className && typeof t.className === 'string') ? t.className.slice(0, 100) : '',
          role: t.getAttribute('role') || ''
        });
      }
      
      document.addEventListener('click', recordClick, true);
      document.addEventListener('dblclick', recordClick, true);
      document.addEventListener('contextmenu', recordClick, true);
      
      document.addEventListener('input', function(e) {
        var t = e.target;
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && t.tagName !== 'SELECT') return;
        send({
          type: 'input',
          tag: t.tagName.toLowerCase(),
          sel: sel(t),
          inputType: t.type || 'text',
          name: t.name || '',
          val: t.type === 'password' ? '***' : String(t.value).slice(0, 200),
          placeholder: t.placeholder || ''
        });
      }, true);
      
      document.addEventListener('change', function(e) {
        var t = e.target;
        send({
          type: 'change',
          tag: t.tagName.toLowerCase(),
          sel: sel(t),
          val: t.value || '',
          checked: t.checked,
          name: t.name || ''
        });
      }, true);
      
      document.addEventListener('submit', function(e) {
        var t = e.target;
        if (t.tagName !== 'FORM') return;
        var fields = [];
        Array.from(t.elements).forEach(function(el) {
          if (el.name) fields.push(el.name + '=' + String(el.value).slice(0, 100));
        });
        send({
          type: 'submit',
          sel: sel(t),
          action: t.action || location.href,
          method: t.method || 'GET',
          fields: fields
        });
      }, true);
      
      var scrollTimer = null;
      var lastScroll = { x: 0, y: 0 };
      window.addEventListener('scroll', function() {
        var x = window.scrollX;
        var y = window.scrollY;
        if (Math.abs(x - lastScroll.x) < 20 && Math.abs(y - lastScroll.y) < 20) return;
        lastScroll = { x: x, y: y };
        if (scrollTimer) clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function() {
          send({ type: 'scroll', x: x, y: y });
        }, 500);
      }, true);
      
      var lastKey = '';
      document.addEventListener('keydown', function(e) {
        var t = e.target;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        var key = e.key;
        if (e.ctrlKey) key = 'Ctrl+' + key;
        if (e.metaKey) key = 'Meta+' + key;
        if (e.shiftKey) key = 'Shift+' + key;
        if (e.altKey) key = 'Alt+' + key;
        var combo = key + '@' + t.tagName;
        if (combo === lastKey) return;
        lastKey = combo;
        send({
          type: 'keydown',
          key: key,
          tag: t.tagName.toLowerCase(),
          sel: sel(t)
        });
      }, true);
      
      var observer = new MutationObserver(function(mutations) {
        var url = location.href;
        mutations.forEach(function(m) {
          if (m.type === 'childList') {
            m.addedNodes.forEach(function(n) {
              if (n.nodeType === 1) {
                if (n.tagName === 'SCRIPT' && n.src) {
                  send({ type: 'script', src: n.src, url: url });
                }
                if (n.tagName === 'IFRAME' && n.src) {
                  send({ type: 'iframe', src: n.src, url: url });
                }
              }
            });
          }
        });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      
      window.addEventListener('popstate', function() {
        send({ type: 'navigation', url: location.href, nav: 'popstate' });
      });
      
      window.addEventListener('hashchange', function() {
        send({ type: 'navigation', url: location.href, nav: 'hashchange' });
      });
      
      var origPush = history.pushState;
      history.pushState = function() {
        origPush.apply(this, arguments);
        send({ type: 'navigation', url: location.href, nav: 'pushState' });
      };
      
      var origReplace = history.replaceState;
      history.replaceState = function() {
        origReplace.apply(this, arguments);
        send({ type: 'navigation', url: location.href, nav: 'replaceState' });
      };
      
      var origFetch = window.fetch;
      window.fetch = function() {
        var args = arguments;
        var url = typeof args[0] === 'string' ? args[0] : args[0].url;
        var method = (args[1] && args[1].method) || 'GET';
        send({ type: 'fetch', method: method, url: url });
        return origFetch.apply(this, args);
      };
      
      var origXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        this.__re_method = method;
        this.__re_url = url;
        return origXHROpen.apply(this, arguments);
      };
      
      var origXHRSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() {
        send({ type: 'xhr', method: this.__re_method, url: this.__re_url });
        return origXHRSend.apply(this, arguments);
      };
      
      console.log('%c[RE] recorder active %c(v2)', 'color:#0f0;font-weight:bold', 'color:#666');
      return 'injected_v2';
    })();
  `;
  
  return browser.tabs.executeScript(tabId, { code: code, runAt: 'document_end' });
}

browser.runtime.onMessage.addListener(function(msg, sender) {
  if (msg.action === 'getState') {
    return Promise.resolve({
      recording: state.recording,
      startTime: state.startTime,
      actions: state.actions,
      requests: state.requests
    });
  }
  
  if (msg.action === 'startRecording') {
    state.recording = true;
    state.startTime = Date.now();
    state.actions = [];
    return injectRecorder(msg.tabId).then(function(results) {
      return { ok: true, injected: results };
    });
  }
  
  if (msg.action === 'stopRecording') {
    state.recording = false;
    return Promise.resolve({ actions: state.actions, ok: true });
  }
  
  if (msg.action === 'pushAction') {
    if (state.recording) {
      state.actions.push({
        type: msg.data.type,
        tag: msg.data.tag,
        sel: msg.data.sel,
        text: msg.data.text,
        x: msg.data.x,
        y: msg.data.y,
        href: msg.data.href,
        val: msg.data.val,
        name: msg.data.name,
        inputType: msg.data.inputType,
        action: msg.data.action,
        method: msg.data.method,
        fields: msg.data.fields,
        checked: msg.data.checked,
        classes: msg.data.classes,
        role: msg.data.role,
        key: msg.data.key,
        src: msg.data.src,
        nav: msg.data.nav,
        placeholder: msg.data.placeholder,
        url: msg.data.url || sender.url,
        time: Date.now() - state.startTime
      });
    }
    return Promise.resolve({ ok: true, count: state.actions.length });
  }
  
  if (msg.action === 'clearActions') {
    state.actions = [];
    return Promise.resolve({ ok: true });
  }
  
  if (msg.action === 'clearRequests') {
    state.requests = [];
    return Promise.resolve({ ok: true });
  }
});
