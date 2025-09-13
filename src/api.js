// Minimal API client for Apps Script backend
const CONFIG = {
  BASE_URL: 'https://script.google.com/macros/s/AKfycbxj-n78vGkNf0xbnFDsssndYHXpebR4t6-m2M0W04i7Va_VRIl6nzPN9wbJXHdxGQ5FJw/exec', // TODO: replace after Apps Script deploy
  API_KEY: '', // optional if enabled server-side
};

async function request(path, opts = {}) {
  const url = CONFIG.BASE_URL + path;
  const headers = { 'Content-Type': 'application/json' };
  if (CONFIG.API_KEY) headers['X-API-Key'] = CONFIG.API_KEY;

  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  async config() { return request('/config'); },
  async get(path) { return request(path); },
  async post(path, body) { return request(path, { method:'POST', body: JSON.stringify(body) }); }
};
