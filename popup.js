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
    if (data.panel) {
      setPanel(data.panel);
    }
    if (data.recording) {
      recording = true;
      Q('#recBtn').textContent = 'stop';
      Q('#recBtn').classList.add('on');
      status('recording', 'rec');
    }
    if (data.actions && data.actions.length > 0) {
      lastActions = data.actions;
      if (data.panel === 'rec' || !data.panel) {
        renderActions(lastActions);
      }
    }
    if (data.recording && data.startTime) {
      updateTimer();
    }
  });
}

function saveState() {
  browser.storage.local.set({
    panel: panel,
    recording: recording,
    actions: lastActions,
    startTime: null
  });
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
      browser.runtime.sendMessage({ 
        action: 'startRecording', 
        tabId: tab.id 
      }).then(function(res) {
        recording = true;
        lastActions = [];
        Q('#recBtn').textContent = 'stop';
        Q('#recBtn').classList.add('on');
        Q('#ta').placeholder = '// recording...';
        status('recording', 'rec');
        Q('#info').textContent = '00:00.000';
        saveState();
        
        if (res.injected) {
          Q('#ta').value = '// injected: ' + JSON.stringify(res.injected) + '\n// interact with page\n';
        }
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
  var json = JSON.stringify(lastActions, null, 2);
  Q('#ta').value = json;
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
      if (a.classes) line += '\n        classes: ' + a.classes;
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
    } else if (a.type === 'navigation') {
      line += 'navigate (' + (a.nav || '') + ') -> ' + a.url;
    } else if (a.type === 'script') {
      line += 'script loaded: ' + a.src;
    } else {
      line += a.type + ' ' + (a.sel || '') + ' ' + (a.url || '');
    }
    
    if (a.url && a.type !== 'navigation' && a.type !== 'fetch' && a.type !== 'xhr' && a.type !== 'script') {
      line += '\n        url: ' + a.url;
    }
    
    lines.push(line);
  });
  
  Q('#ta').value = lines.join('\n\n');
  Q('#info').textContent = actions.length + ' actions / ' + (total / 1000).toFixed(1) + 's';
}

Q('#apiCap').addEventListener('click', function() {
  getState().then(function(s) {
    if (!s.requests.length) {
      Q('#ta').value = '// no requests';
      return;
    }
    var lines = [];
    s.requests.forEach(function(r) {
      lines.push('### ' + r.method + ' ' + r.url);
      if (r.statusCode) lines.push('    status: ' + r.statusCode);
      if (r.requestHeaders) {
        lines.push('    req headers:');
        r.requestHeaders.forEach(function(h) {
          lines.push('      ' + h.name + ': ' + h.value);
        });
      }
      if (r.requestBody) {
        lines.push('    body:');
        var b = formatBody(r.requestBody);
        b.split('\n').forEach(function(l) { lines.push('      ' + l); });
      }
      lines.push('');
    });
    Q('#ta').value = lines.join('\n');
    status('captured', 'on');
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

Q('#pwGen').addEventListener('click', function() {
  browser.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
    var code = 'JSON.stringify((function(){var e=[];document.querySelectorAll("button,input,select,textarea,a[href],form").forEach(function(el){if(!el.offsetParent&&el.tagName!=="FORM")return;function s(el){if(el.id)return"#"+el.id;if(el.name)return el.tagName.toLowerCase()+"[name=\\""+el.name+"\\"]";var a=el.getAttribute("aria-label");if(a)return"[aria-label=\\""+a+"\\"]";if(el.className&&typeof el.className==="string"){var c=el.className.trim().split(/\\s+/)[0];if(c&&!/[:[\\\\]()]/.test(c))return"."+c}return el.tagName.toLowerCase()}e.push({tag:el.tagName.toLowerCase(),type:el.type||"",id:el.id||"",name:el.name||"",text:(el.textContent||"").trim().slice(0,40),sel:s(el),href:el.href||"",action:el.action||"",method:el.method||"get"})});return e})())';
    
    browser.tabs.executeScript(tabs[0].id, { code: code }).then(function(results) {
      var elements = JSON.parse(results[0]);
      if (!elements.length) {
        Q('#ta').value = '// no elements';
        return;
      }
      
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

window.addEventListener('unload', function() {
  saveState();
});

restorePanel();
