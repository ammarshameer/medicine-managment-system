// QA artifact - shared HTTP/evidence helpers for the MMS test brief.
// All artifacts stay under qa/; no application code is imported or modified.
const fs = require('fs');
const path = require('path');

const BASE = process.env.QA_BASE || 'http://localhost:5000/api';
const EVIDENCE = path.join(__dirname, 'evidence');
fs.mkdirSync(EVIDENCE, { recursive: true });

async function request(method, route, options = {}) {
  const { token, body, headers = {} } = options;
  const url = BASE + route;
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const started = Date.now();
  let response;
  let text;
  try {
    response = await fetch(url, init);
    text = await response.text();
  } catch (error) {
    return { status: 0, data: { message: error.message }, raw: error.message, url, method, ms: Date.now() - started };
  }
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, raw: text, url, method, ms: Date.now() - started };
}

async function login(email, password) {
  const res = await request('POST', '/auth/login', { body: { email, password } });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${res.raw}`);
  return res.data.data.token;
}

function writeEvidence(name, payload) {
  const file = path.join(EVIDENCE, name);
  fs.writeFileSync(file, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
  return file;
}

function readEvidence(name) {
  return JSON.parse(fs.readFileSync(path.join(EVIDENCE, name), 'utf8'));
}

function recordResult(id, status, evidence) {
  const line = JSON.stringify({ id, status, evidence, at: new Date().toISOString() }) + '\n';
  fs.appendFileSync(path.join(EVIDENCE, 'results.jsonl'), line);
  console.log(`${id.padEnd(6)} ${status.padEnd(8)} ${typeof evidence === 'string' ? evidence.slice(0, 120) : JSON.stringify(evidence).slice(0, 120)}`);
}

function brief(res) {
  return { status: res.status, body: res.data };
}

module.exports = { BASE, request, login, writeEvidence, readEvidence, recordResult, brief };
