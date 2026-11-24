// QA artifact - T26 Arabic/RTL check using headless Chrome + CDP.
// Usage: node qa/10_rtl_check.js (requires admin-web dev server on port 3002)
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { writeEvidence, recordResult } = require('./lib');

const URL = 'http://localhost:3002/';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(URL); if (r.ok) return true; } catch {}
    await sleep(1000);
  }
  return false;
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); } };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
}

async function main() {
  const ready = await waitForServer();
  if (!ready) throw new Error('admin-web dev server not ready on 3002');
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=9222', '--user-data-dir=/tmp/opencode/chrome-qa', URL
  ], { stdio: 'ignore' });
  await sleep(4000);
  let ws;
  try {
    const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
    const page = targets.find(t => t.type === 'page' && t.url.includes('3002')) || targets.find(t => t.type === 'page');
    if (!page) throw new Error('no Chrome page target');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const cdp = new CDP(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await sleep(2000);

    const en = await cdp.evaluate(`({dir: document.documentElement.dir, lang: document.documentElement.lang, title: document.title})`);
    await cdp.evaluate(`localStorage.setItem('mms_lang','ar'); location.reload(); true`);
    await sleep(3000);
    const ar = await cdp.evaluate(`({
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      stored: localStorage.getItem('mms_lang'),
      bodyText: document.body.innerText.slice(0, 300),
      physicalClasses: (document.body.innerHTML.match(/\\b(ml|mr|pl|pr|text-left|text-right)-/g) || []).length,
      logicalClasses: (document.body.innerHTML.match(/\\b(ms|me|ps|pe|text-start|text-end)-/g) || []).length
    })`);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'evidence', 'rtl_admin.png'), Buffer.from(shot.data, 'base64'));
    const result = { url: URL, english: en, arabic: ar, screenshot: 'qa/evidence/rtl_admin.png' };
    writeEvidence('rtl.json', result);
    recordResult('T26', ar.dir === 'rtl' && ar.lang === 'ar' ? 'PASS' : 'FAIL', result);
    console.log('RTL_CHECK_DONE');
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
