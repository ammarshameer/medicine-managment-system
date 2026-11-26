// QA artifact - headless UI check for the platform login and one-click support entry.
// Usage: node qa/19_platform_ui_check.js (requires admin-web dev server on port 3002)
const { spawn } = require('child_process');
const { login, readEvidence, recordResult, writeEvidence } = require('./lib');

const BASE_UI = 'http://localhost:3002';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
}

async function main() {
  const fixtures = readEvidence('fixtures.json');
  const tenant = Object.values(fixtures.tenants)[0];
  const superToken = await login('superadmin@mms.com', 'password');
  const evidence = { checks: {} };

  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=9223', '--user-data-dir=/tmp/opencode/chrome-platform-qa',
    `${BASE_UI}/super-admin/login`
  ], { stdio: 'ignore' });

  let ws;
  try {
    for (let i = 0; i < 30; i++) {
      try {
        const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
        const page = targets.find((target) => target.type === 'page');
        if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
      } catch {}
      await sleep(1000);
    }
    if (!ws) throw new Error('no Chrome page target');
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    const cdp = new CDP(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    // Start from a clean browser profile state for a deterministic login-page check.
    await cdp.evaluate(`localStorage.clear(); location.href = ${JSON.stringify(`${BASE_UI}/super-admin/login`)}; true`);
    await sleep(3000);

    // PLUI1 - the platform URL renders its own login form and remember option.
    const loginPage = await cdp.evaluate(`({
      path: location.pathname,
      hasEmail: !!document.querySelector('#platform-email'),
      hasPassword: !!document.querySelector('#platform-password'),
      rememberVisible: document.body.innerText.includes('Remember me on this device'),
      separateCopy: document.body.innerText.includes('Platform Console')
    })`);
    evidence.checks.PLUI1 = loginPage;
    recordResult('PLUI1',
      loginPage.path === '/super-admin/login' && loginPage.hasEmail &&
      loginPage.hasPassword && loginPage.rememberVisible && loginPage.separateCopy
        ? 'PASS' : 'FAIL', loginPage);
    if (!evidence.checks.PLUI1.path) throw new Error('platform login page did not render');

    // PLUI2 - super admin business list exposes the one-click support action.
    await cdp.evaluate(`localStorage.setItem('token', ${JSON.stringify(superToken)});
      localStorage.removeItem('activeBusinessId'); true`);
    await cdp.evaluate(`location.href = ${JSON.stringify(`${BASE_UI}/super-admin/businesses`)}; true`);
    await sleep(5000);
    const listPage = await cdp.evaluate(`({
      path: location.pathname,
      supportButtons: document.querySelectorAll('button[title="Open as Support"]').length,
      body: document.body.innerText.slice(0, 400)
    })`);
    evidence.checks.PLUI2 = { ...listPage, body: listPage.body.slice(0, 200) };
    recordResult('PLUI2', listPage.path === '/super-admin/businesses' && listPage.supportButtons > 0
      ? 'PASS' : 'FAIL', evidence.checks.PLUI2);
    if (listPage.supportButtons === 0) throw new Error('open-as-support button not rendered');

    // PLUI3 - clicking it lands in that tenant's dashboard as SUPPORT.
    const clickedId = await cdp.evaluate(`Number(document.querySelector('button[title="Open as Support"]').dataset.businessId)`);
    await cdp.evaluate(`document.querySelector('button[title="Open as Support"]').click(); true`);
    await sleep(5000);
    const afterClick = await cdp.evaluate(`({
      path: location.pathname,
      activeBusinessId: localStorage.getItem('activeBusinessId'),
      roleVisible: document.body.innerText.includes('SUPPORT')
    })`);
    evidence.checks.PLUI3 = { ...afterClick, clickedId };
    recordResult('PLUI3', afterClick.path === '/dashboard' &&
      Number(afterClick.activeBusinessId) === clickedId && afterClick.roleVisible
      ? 'PASS' : 'FAIL', evidence.checks.PLUI3);

    evidence.checkedAt = new Date().toISOString();
    writeEvidence('platform_ui.json', evidence);
    console.log('[qa] platform UI evidence: qa/evidence/platform_ui.json');
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
