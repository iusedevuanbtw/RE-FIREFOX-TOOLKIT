var panel = 'rec';
var recording = false;
var lastActions = [];
function Q(s) { return document.querySelector(s); }
function QQ(s) { return document.querySelectorAll(s); }
function setPanel(p) {
  panel = p;
  QQ('.t').forEach(function(t) { t.classList.toggle('on', t.dataset.p === p); });
  QQ('.tb').forEach(function(t) { t.classList.toggle('h', t.dataset.p !== p); });
}
QQ('.t').forEach(function(t) {
  t.addEventListener('click', function() { setPanel(t.dataset.p); });
});
function status(text, dotClass) {
  Q('#status').textContent = text;
  Q('#dot').className = 'dot';
  if (dotClass) Q('#dot').classList.add(dotClass);
}
function getState() {
  return browser.runtime.sendMessage({ action: 'getState' });
}
function restorePanel() {
  browser.storage.local.get(['panel', 'recording', 'actions', 'startTime']).then(function(data) {
    if (data.panel) setPanel(data.panel);
    if (data.recording) {
      recording = true;
      Q('#recBtn').textContent = 'stop';
      Q('#recBtn').classList.add('on');
      status('recording', 'rec');
    }
    if (data.actions && data.actions.length > 0) {
      lastActions = data.actions;
      if (data.panel === 'rec' || !data.panel) renderActions(lastActions);
    }
    if (data.recording && data.startTime) updateTimer();
  });
}
function saveState() {
  browser.storage.local.set({ panel: panel, recording: recording, actions: lastActions, startTime: null });
}
function updateTimer() {
  getState().then(function(s) {
    if (s.recording && s.startTime) {
      var elapsed = Date.now() - s.startTime;
      var m = Math.floor(elapsed / 60000).toString().padStart(2, '0');
      var sec = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
      var ms = (elapsed % 1000).toString().padStart(3, '0');
      Q('#info').textContent = m + ':' + sec + '.' + ms;
    }
  });
}
Q('#recBtn').addEventListener('click', function() {
  browser.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
    var tab = tabs[0];
    if (!recording) {
      browser.runtime.sendMessage({ action: 'startRecording', tabId: tab.id }).then(function(res) {
        recording = true;
        lastActions = [];
        Q('#recBtn').textContent = 'stop';
        Q('#recBtn').classList.add('on');
        Q('#ta').placeholder = '// recording...';
        status('recording', 'rec');
        Q('#info').textContent = '00:00.000';
        saveState();
        if (res.injected) Q('#ta').value = '// injected: ' + JSON.stringify(res.injected) + '\n// interact with page\n';
      });
    } else {
      browser.runtime.sendMessage({ action: 'stopRecording' }).then(function(res) {
        recording = false;
        Q('#recBtn').textContent = 'rec';
        Q('#recBtn').classList.remove('on');
        status('idle', '');
        Q('#info').textContent = '';
        if (res.actions && res.actions.length > 0) {
          lastActions = res.actions;
          renderActions(lastActions);
          status('stopped', 'on');
          saveState();
        } else {
          Q('#ta').value = '// no actions';
        }
      });
    }
  });
});
Q('#recClr').addEventListener('click', function() {
  browser.runtime.sendMessage({ action: 'clearActions' });
  lastActions = [];
  Q('#ta').value = '';
  Q('#ta').placeholder = '// ready';
  status('idle', '');
  Q('#info').textContent = '';
  saveState();
});
Q('#recExp').addEventListener('click', function() {
  if (!lastActions.length) {
    getState().then(function(s) {
      if (!s.actions.length) return;
      lastActions = s.actions;
      exportActions();
    });
  } else {
    exportActions();
  }
});
function exportActions() {
  Q('#ta').value = JSON.stringify(lastActions, null, 2);
  Q('#ta').select();
  document.execCommand('copy');
  status('exported', 'on');
  Q('#info').textContent = lastActions.length + ' actions';
  saveState();
}
function renderActions(actions) {
  if (!actions || !actions.length) {
    Q('#ta').value = '// no actions';
    Q('#info').textContent = '0';
    return;
  }
  var lines = [];
  var total = actions[actions.length - 1].time;
  actions.forEach(function(a) {
    var t = (a.time / 1000).toFixed(3);
    var ts = '[' + '       '.slice(0, 7 - t.length) + t + ']';
    var line = ts + ' ';
    if (a.type === 'click') {
      line += 'click <' + a.tag + '> "' + (a.text || a.sel) + '"';
      if (a.href) line += '\n        -> ' + a.href;
      line += '\n        sel: ' + a.sel;
      if (a.classes) line += '\n        cls: ' + a.classes;
    } else if (a.type === 'input') {
      line += 'input <' + a.tag + '> ' + (a.name || a.sel) + ' = "' + a.val + '"';
      line += '\n        sel: ' + a.sel;
    } else if (a.type === 'change') {
      line += 'change <' + a.tag + '> ' + a.name + ' = "' + a.val + '"';
      line += '\n        sel: ' + a.sel;
    } else if (a.type === 'submit') {
      line += 'submit ' + (a.method || 'GET').toUpperCase() + ' ' + (a.action || '');
      line += '\n        sel: ' + a.sel;
      if (a.fields) line += '\n        fields: ' + JSON.stringify(a.fields);
    } else if (a.type === 'scroll') {
      line += 'scroll (' + a.x + ', ' + a.y + ')';
    } else if (a.type === 'keydown') {
      line += 'keydown ' + a.key + ' on <' + a.tag + '>';
      line += '\n        sel: ' + a.sel;
    } else if (a.type === 'fetch' || a.type === 'xhr') {
      line += a.type + ' ' + a.method + ' ' + a.url;
    } else if (a.type === 'fetch_res' || a.type === 'xhr_res') {
      line += a.type.replace('_res', ' <-') + ' ' + (a.status || '?') + ' ' + a.url;
      if (a.data) line += '\n        ' + String(a.data).slice(0, 300).replace(/\n/g, '\n        ');
    } else if (a.type === 'sse') {
      line += 'sse ' + a.url;
      if (a.data) line += '\n        ' + String(a.data).slice(0, 300).replace(/\n/g, '\n        ');
    } else if (a.type === 'ws_open') {
      line += 'ws open ' + a.url;
    } else if (a.type === 'ws_send') {
      line += 'ws >> ' + a.url;
      if (a.data) line += '\n        ' + String(a.data).slice(0, 200);
    } else if (a.type === 'ws_msg') {
      line += 'ws << ' + a.url;
      if (a.data) line += '\n        ' + String(a.data).slice(0, 200);
    } else if (a.type === 'navigation') {
      line += 'navigate (' + (a.nav || '') + ') -> ' + a.url;
    } else if (a.type === 'script') {
      line += 'script ' + a.src;
    } else {
      line += a.type + ' ' + (a.sel || '') + ' ' + (a.url || '');
    }
    var skip = ['navigation','fetch','fetch_res','xhr','xhr_res','sse','script','ws_open','ws_send','ws_msg'];
    if (a.url && skip.indexOf(a.type) === -1) line += '\n        url: ' + a.url;
    lines.push(line);
  });
  Q('#ta').value = lines.join('\n\n');
  Q('#info').textContent = actions.length + ' actions / ' + (total / 1000).toFixed(1) + 's';
}
Q('#apiCap').addEventListener('click', function() {
  getState().then(function(s) {
    if (!s.requests.length) { Q('#ta').value = '// no requests'; return; }
    var lines = [];
    s.requests.forEach(function(r) {
      lines.push('### ' + r.method + ' ' + r.url);
      if (r.statusCode) lines.push('    status: ' + r.statusCode);
      if (r.requestHeaders) {
        lines.push('    headers:');
        r.requestHeaders.forEach(function(h) { lines.push('      ' + h.name + ': ' + h.value); });
      }
      if (r.requestBody) {
        lines.push('    body:');
        formatBody(r.requestBody).split('\n').forEach(function(l) { lines.push('      ' + l); });
      }
      lines.push('');
    });
    Q('#ta').value = lines.join('\n');
    status('captured', 'on');
    Q('#info').textContent = s.requests.length + ' requests';
  });
});
Q('#apiCurl').addEventListener('click', function() {
  getState().then(function(s) {
    if (!s.requests.length) { Q('#ta').value = '// no requests'; return; }
    var script = '#!/usr/bin/env bash\n';
    script += '# RE Toolkit 4.0.0 — ' + new Date().toISOString() + '\n';
    script += '# WARNING: live cookies/tokens inside. Do not share.\n\n';
    script += s.requests.filter(function(r) {
      return r.method !== 'OPTIONS' && /^https?:/i.test(r.url);
    }).map(function(r) { return toCurl(r); }).join('\n\n');
    Q('#ta').value = script;
    Q('#ta').select();
    document.execCommand('copy');
    status('curl script', 'on');
    Q('#info').textContent = s.requests.length + ' requests';
  });
});
Q('#apiClr').addEventListener('click', function() {
  browser.runtime.sendMessage({ action: 'clearRequests' });
  Q('#ta').value = '';
  status('cleared', '');
  Q('#info').textContent = '';
});
Q('#apiCpy').addEventListener('click', function() {
  Q('#ta').select();
  document.execCommand('copy');
  status('copied', 'on');
});
function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
function rawBody(b) {
  if (!b) return '';
  if (typeof b === 'string') return b;
  if (b.formData) {
    return Object.keys(b.formData).map(function(k) {
      var v = b.formData[k];
      return encodeURIComponent(k) + '=' + encodeURIComponent(Array.isArray(v) ? (v[0] || '') : v);
    }).join('&');
  }
  if (b.raw && b.raw.length) {
    try { return new TextDecoder().decode(new Uint8Array(b.raw[0].bytes)); } catch(e) { return ''; }
  }
  return '';
}
function toCurl(r) {
  var p = ['curl -X ' + r.method];
  (r.requestHeaders || []).forEach(function(h) {
    if (/^(host|content-length|connection|accept-encoding|sec-fetch-)/i.test(h.name)) return;
    p.push('-H ' + shq(h.name + ': ' + h.value));
  });
  var body = rawBody(r.requestBody);
  if (body) p.push('--data ' + shq(body));
  p.push(shq(r.url));
  return p.join(' \\\n  ');
}
Q('#pwGen').addEventListener('click', function() {
  browser.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
    var code = 'JSON.stringify((function(){var e=[];document.querySelectorAll("button,input,select,textarea,a[href],form").forEach(function(el){if(!el.offsetParent&&el.tagName!=="FORM")return;function s(el){if(el.id)return"#"+el.id;if(el.name)return el.tagName.toLowerCase()+\'[name="\'+el.name+\'"]\';var a=el.getAttribute("aria-label");if(a)return\'[aria-label="\'+a+\'"]\';if(el.className&&typeof el.className==="string"){var c=el.className.trim().split(/\\s+/)[0];if(c&&!/[\\[\\]()#:]/.test(c))return"."+c}return el.tagName.toLowerCase()}e.push({tag:el.tagName.toLowerCase(),type:el.type||"",id:el.id||"",name:el.name||"",text:(el.textContent||"").trim().slice(0,40),sel:s(el),href:el.href||"",action:el.action||"",method:el.method||"get"})});return e})())';
    browser.tabs.executeScript(tabs[0].id, { code: code }).then(function(results) {
      var elements = JSON.parse(results[0]);
      if (!elements.length) { Q('#ta').value = '// no elements'; return; }
      var seen = {};
      var actions = [];
      elements.forEach(function(el) {
        if (!el.sel || seen[el.sel]) return;
        seen[el.sel] = true;
        if (el.tag === 'input' && ['text','email','password',''].indexOf(el.type) !== -1) {
          actions.push("await page.fill('" + el.sel + "', 'value')");
        } else if (el.tag === 'button' || el.tag === 'a') {
          actions.push("await page.click('" + el.sel + "')");
        } else if (el.tag === 'select') {
          actions.push("await page.select_option('" + el.sel + "', index=0)");
        } else if (el.tag === 'textarea') {
          actions.push("await page.fill('" + el.sel + "', 'text')");
        } else if (el.tag === 'form') {
          actions.push("# form " + el.method.toUpperCase() + " " + (el.action || tabs[0].url));
        }
      });
      var script = 'import asyncio\nfrom playwright.async_api import async_playwright\n\nasync def run():\n    async with async_playwright() as p:\n        browser = await p.chromium.launch(headless=False)\n        page = await browser.new_page()\n        await page.goto(\'' + tabs[0].url + '\')\n        await page.wait_for_load_state(\'networkidle\')\n\n' + actions.map(function(a) { return '        ' + a; }).join('\n') + '\n\n        await page.wait_for_timeout(2000)\n        await page.screenshot(path=\'screen.png\', full_page=True)\n        await browser.close()\n\nasyncio.run(run())';
      Q('#ta').value = script;
      status('generated', 'on');
      Q('#info').textContent = actions.length + ' actions';
    });
  });
});
Q('#pwClr').addEventListener('click', function() {
  Q('#ta').value = '';
  status('cleared', '');
  Q('#info').textContent = '';
});
Q('#pwCpy').addEventListener('click', function() {
  Q('#ta').select();
  document.execCommand('copy');
  status('copied', 'on');
});
Q('#harExp').addEventListener('click', function() {
  getState().then(function(s) {
    if (!s.requests.length) { Q('#ta').value = '// no requests'; return; }
    var har = {
      log: {
        version: '1.2',
        creator: { name: 'RE Toolkit', version: '4.0.0' },
        entries: s.requests.map(function(r) {
          return {
            startedDateTime: new Date(r.timeStamp).toISOString(),
            time: 0,
            request: {
              method: r.method,
              url: r.url,
              httpVersion: 'HTTP/1.1',
              headers: (r.requestHeaders || []).map(function(h) { return { name: h.name, value: h.value }; }),
              queryString: [],
              bodySize: -1,
              headersSize: -1
            },
            response: {
              status: r.statusCode || 0,
              statusText: '',
              httpVersion: 'HTTP/1.1',
              headers: (r.responseHeaders || []).map(function(h) { return { name: h.name, value: h.value }; }),
              content: { size: 0, mimeType: '' },
              bodySize: -1,
              headersSize: -1
            }
          };
        })
      }
    };
    Q('#ta').value = JSON.stringify(har, null, 2);
    Q('#ta').select();
    document.execCommand('copy');
    status('har exported', 'on');
    Q('#info').textContent = s.requests.length + ' entries';
  });
});
Q('#harClr').addEventListener('click', function() {
  browser.runtime.sendMessage({ action: 'clearRequests' });
  Q('#ta').value = '';
  status('cleared', '');
  Q('#info').textContent = '';
});
Q('#harCpy').addEventListener('click', function() {
  Q('#ta').select();
  document.execCommand('copy');
  status('copied', 'on');
});
Q('#decRun').addEventListener('click', function() {
  var v = Q('#ta').value;
  if (!v.trim()) { Q('#ta').placeholder = '// paste encoded data, then decode'; return; }
  var res = magicDecode(v);
  Q('#ta').value = res;
  status('decoded', 'on');
  var layers = (res.match(/\[\d+ [a-z]/g) || []).length;
  Q('#info').textContent = layers + ' layers';
});
Q('#decClr').addEventListener('click', function() {
  Q('#ta').value = '';
  Q('#ta').placeholder = '// paste encoded data, then decode';
  status('idle', '');
  Q('#info').textContent = '';
});
Q('#decCpy').addEventListener('click', function() {
  Q('#ta').select();
  document.execCommand('copy');
  status('copied', 'on');
});
function b64pad(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  while (s.length % 4) s += '=';
  return s;
}
function b64json(s) {
  var bin = atob(b64pad(s));
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}
function tryB64(s) {
  var t = s.trim();
  if (t.length < 16 || !/^[A-Za-z0-9+/_=-]+$/.test(t)) return null;
  try {
    var d = atob(b64pad(t));
    if (d && d.length && /^[\x09\x0a\x0d\x20-\x7e\u00a0-\u04ff]+$/.test(d)) return d;
  } catch(e) {}
  return null;
}
function magicDecode(input) {
  var out = [];
  var cur = String(input).trim();
  out.push('[0 raw] len=' + cur.length + '\n' + cur.slice(0, 600));
  for (var i = 1; i <= 12; i++) {
    var next = null, how = '';
    if (/%[0-9a-fA-F]{2}/.test(cur)) {
      try {
        var d = decodeURIComponent(cur);
        if (d !== cur) { next = d; how = 'url'; }
      } catch(e) {
        try { var d2 = unescape(cur); if (d2 !== cur) { next = d2; how = 'unescape'; } } catch(e2) {}
      }
    }
    if (!next && /^"[\s\S]*"$/.test(cur)) {
      try { var j = JSON.parse(cur); if (typeof j === 'string' && j !== cur) { next = j; how = 'json-string'; } } catch(e) {}
    }
    if (!next && (cur.indexOf('\\u') !== -1 || cur.indexOf('\\n') !== -1 || cur.indexOf('\\"') !== -1 || cur.indexOf('\\/') !== -1)) {
      try {
        var j2 = JSON.parse('"' + cur.replace(/^"|"$/g, '') + '"');
        if (typeof j2 === 'string' && j2 !== cur) { next = j2; how = 'json-escapes'; }
      } catch(e) {}
    }
    if (!next && /&#x?[0-9a-fA-F]+;/.test(cur)) {
      var h = cur
        .replace(/&#x([0-9a-fA-F]+);/gi, function(m, c) { return String.fromCharCode(parseInt(c, 16)); })
        .replace(/&#(\d+);/g, function(m, c) { return String.fromCharCode(parseInt(c, 10)); });
      if (h !== cur) { next = h; how = 'html-entities'; }
    }
    if (!next) {
      var b = tryB64(cur);
      if (b !== null && b !== cur) { next = b; how = 'base64'; }
    }
    if (!next) break;
    out.push('[' + i + ' ' + how + '] len=' + next.length + '\n' + next.slice(0, 600));
    cur = next;
  }
  var jwts = String(input).match(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_.-]*/g);
  if (jwts) {
    jwts.forEach(function(t, idx) {
      var parts = t.split('.');
      try {
        var hd = b64json(parts[0]);
        var pl = b64json(parts[1]);
        var info = '[jwt' + (idx ? ' ' + (idx + 1) : '') + '] alg=' + (hd.alg || '?') + (hd.typ ? ' typ=' + hd.typ : '');
        info += '\nheader: ' + JSON.stringify(hd);
        info += '\npayload: ' + JSON.stringify(pl, null, 2);
        if (pl.exp) {
          var exp = pl.exp * 1000;
          var diff = exp - Date.now();
          if (diff > 0) {
            info += '\nexp: ' + new Date(exp).toISOString() + ' (valid, ' + Math.floor(diff / 86400000) + 'd ' + Math.floor((diff % 86400000) / 3600000) + 'h left)';
          } else {
            info += '\nexp: ' + new Date(exp).toISOString() + ' (EXPIRED ' + Math.floor(-diff / 86400000) + 'd ago)';
          }
        }
        if (pl.iat) info += '\niat: ' + new Date(pl.iat * 1000).toISOString();
        out.push(info);
      } catch(e) {
        out.push('[jwt] found, decode failed: ' + t.slice(0, 60) + '...');
      }
    });
  }
  if (out.length === 1 && !jwts) out.push('[!] no encoding layers detected — plaintext or binary');
  return out.join('\n\n');
}
Q('#mapBuild').addEventListener('click', function() {
  getState().then(function(s) {
    if (!s.requests.length) { Q('#ta').value = '// no requests'; return; }
    Q('#ta').value = buildMap(s.requests);
    status('mapped', 'on');
  });
});
Q('#mapClr').addEventListener('click', function() {
  Q('#ta').value = '';
  status('idle', '');
  Q('#info').textContent = '';
});
Q('#mapCpy').addEventListener('click', function() {
  Q('#ta').select();
  document.execCommand('copy');
  status('copied', 'on');
});
function buildMap(requests) {
  var tree = {};
  var total = 0;
  requests.forEach(function(r) {
    total++;
    var u;
    try { u = new URL(r.url); } catch(e) { return; }
    if (!tree[u.host]) tree[u.host] = {};
    var path = u.pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
      .replace(/\/\d{4,}(?=\/|$)/g, '/:num');
    var key = r.method + ' ' + path;
    if (!tree[u.host][key]) tree[u.host][key] = { n: 0, codes: {} };
    tree[u.host][key].n++;
    if (r.statusCode) tree[u.host][key].codes[r.statusCode] = 1;
  });
  var lines = [];
  var hosts = Object.keys(tree).sort();
  var uniq = 0;
  hosts.forEach(function(host) {
    lines.push(host);
    Object.keys(tree[host]).sort().forEach(function(k) {
      var e = tree[host][k];
      uniq++;
      var codes = Object.keys(e.codes).join(',');
      lines.push('  ' + k + (codes ? '  [' + codes + ']' : '') + '  x' + e.n);
    });
    lines.push('');
  });
  lines.push('--- ' + hosts.length + ' hosts / ' + uniq + ' endpoints / ' + total + ' requests');
  return lines.join('\n');
}
function formatBody(body) {
  if (!body) return '';
  if (typeof body === 'string') {
    try { return JSON.stringify(JSON.parse(body), null, 2); }
    catch(e) { return body.slice(0, 2000); }
  }
  if (body.raw && body.raw.length) {
    try {
      var bytes = new Uint8Array(body.raw[0].bytes);
      var decoded = new TextDecoder().decode(bytes);
      try { return JSON.stringify(JSON.parse(decoded), null, 2); }
      catch(e) { return decoded.slice(0, 2000); }
    } catch(e) { return '[binary]'; }
  }
  if (body.formData) return JSON.stringify(body.formData, null, 2);
  return JSON.stringify(body, null, 2);
}
setInterval(function() {
  if (!recording) return;
  updateTimer();
  getState().then(function(s) {
    if (s.actions && s.actions.length > 0) {
      lastActions = s.actions;
      renderActions(lastActions);
    }
  });
}, 1000);
window.addEventListener('unload', function() { saveState(); });
restorePanel();
