// Minimal API client for Apps Script backend
const CONFIG = {
  BASE_URL: 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhUUD2il5XnQR4ldJUiJcqQ5pEdR3e_OMA8uH3TnGpoHtwlVK_3M4ITAN-xygPv4ohujc3MudUzydgrBQbHRS_IVFviZWZ3ncF7hh4jBVUBEO4tTQvJZP7VjVvv8tM_omEFgSyxMqU52vDoKqWzg9_rzynPI-djufnzciYXi_kyHNswBlxXgtfQfIF6GArOWBTxJFajKCnJ9_01fqAo1O1r56TUzqcohq4FJMc1VURFQmYU0zG7BcTR47nGjDlHMXLZouELh8kfy21WEJxGGiLNedc4BCoVP1fRML71&lib=MVZwdSUCKQ_aVeOo_Urm4lbiIB6nNW46w', // TODO: replace after Apps Script deploy
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
