// QA artifact - business switcher must enter the tenant dashboard, not stay on
// the platform dashboard. Usage: node qa/20_business_switch_ui.js
// Requires the admin-web dev server on port 3002.
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
  const evidence = { checks: {}, selectedBusinessId: tenant.businessId };

  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=9224', '--user-data-dir=/tmp/opencode/chrome-switch-qa',
    `${BASE_UI}/super-admin/dashboard`
  ], { stdio: 'ignore' });

  let ws;
  try {
    for (let i = 0; i < 30; i++) {
      try {
        const targets = await (await fetch('http://127.0.0.1:9224/json/list')).json();
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

    // Begin with a clean super admin session in the platform view.
    await cdp.evaluate(`localStorage.setItem('token', ${JSON.stringify(superToken)});
      localStorage.removeItem('activeBusinessId');
      sessionStorage.removeItem('mmsPlatformReturnToken');
      location.href = ${JSON.stringify(`${BASE_UI}/super-admin/dashboard`)}; true`);
    await sleep(5000);

    const before = await cdp.evaluate(`({
      path: location.pathname,
      role: document.body.innerText.includes('SUPER ADMIN'),
      activeBusinessId: localStorage.getItem('activeBusinessId')
    })`);
    evidence.checks.SW1 = before;
    recordResult('SW1', before.path === '/super-admin/dashboard' && before.role && !before.activeBusinessId
      ? 'PASS' : 'FAIL', before);

    // SW2 - picking a business enters the tenant dashboard as hidden SUPPORT.
    const changed = await cdp.evaluate(`(() => {
      const select = document.querySelector('select[aria-label="Select Business"]');
      if (!select) return false;
      select.value = String(${tenant.businessId});
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    if (!changed) throw new Error('business switcher not rendered');
    await sleep(5000);
    const inTenant = await cdp.evaluate(`({
      path: location.pathname,
      role: document.body.innerText.includes('SUPPORT'),
      activeBusinessId: localStorage.getItem('activeBusinessId'),
      tenantDashboard: document.body.innerText.includes('Pharmacy financial performance')
    })`);
    evidence.checks.SW2 = inTenant;
    recordResult('SW2', inTenant.path === '/dashboard' && inTenant.role &&
      Number(inTenant.activeBusinessId) === Number(tenant.businessId) && inTenant.tenantDashboard
      ? 'PASS' : 'FAIL', inTenant);

    // SW3 - "Platform View" restores the original super admin session.
    await cdp.evaluate(`(() => {
      const select = document.querySelector('select[aria-label="Select Business"]');
      select.value = '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await sleep(5000);
    const restored = await cdp.evaluate(`({
      path: location.pathname,
      role: document.body.innerText.includes('SUPER ADMIN'),
      activeBusinessId: localStorage.getItem('activeBusinessId')
    })`);
    evidence.checks.SW3 = restored;
    recordResult('SW3', restored.path === '/super-admin/dashboard' && restored.role && !restored.activeBusinessId
      ? 'PASS' : 'FAIL', restored);

    evidence.checkedAt = new Date().toISOString();
    writeEvidence('business_switch.json', evidence);
    console.log('[qa] business switch evidence: qa/evidence/business_switch.json');
  } finally {
    if (ws) ws.close();
    chrome.kill('SIGTERM');
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
