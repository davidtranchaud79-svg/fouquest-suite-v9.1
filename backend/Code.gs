
/**
 * Fouques’t Suite v9.0 – Google Apps Script backend (REST)
 * SPREADSHEET_ID configuré pour ton classeur pilote.
 */
const TIMEZONE        = 'Europe/Paris';
const SPREADSHEET_ID  = '1WfniJGI89KRWdwE134g_WHXtTX-psXCW8ub20SlBoDA';
const REQUIRE_API_KEY = false;
const API_KEY         = 'CHANGE_ME';

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const S = () => SpreadsheetApp.openById(SPREADSHEET_ID);

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function doGet(e)  { return route_('GET', e); }
function doPost(e) { return route_('POST', e); }

function route_(method, e) {
  try {
    if (REQUIRE_API_KEY) {
      const keyHeader = e?.headers?.['X-API-Key'] || e?.headers?.['x-api-key'];
      const keyQuery  = e?.parameter?.api_key;
      const keyBody   = e?.postData?.contents ? JSON.parse(e.postData.contents).api_key : undefined;
      const provided  = keyHeader || keyQuery || keyBody;
      if (provided !== API_KEY) return json_({ ok:false, error:'Unauthorized' });
    }
    const path = (e?.pathInfo || e?.parameter?.path || '/config').trim();
    if (method === 'GET') {
      if (path.endsWith('/config') || path === 'config' || path === '/config') return config_();
      return json_({ ok:false, error:'Route not found' });
    }
    if (method === 'POST') {
      const body = e?.postData?.contents ? JSON.parse(e.postData.contents) : {};
      if (path.endsWith('/pertes') || path === 'pertes' || path === '/pertes') return recordPerte_(body);
      if (path.endsWith('/mouvements') || path === 'mouvements' || path === '/mouvements') return recordMouvement_(body);
      if (path.endsWith('/inventaires') || path === 'inventaires' || path === '/inventaires') return recordInventaireMensuel_(body);
      if (path.endsWith('/productions') || path === 'productions' || path === '/productions') return recordProduction_(body);
      if (path.endsWith('/reports/generate') || path === 'reports/generate' || path === '/reports/generate') return generateReport_(body);
      return json_({ ok:false, error:'Route not found' });
    }
    return json_({ ok:false, error:'Method not allowed' });
  } catch (err) {
    logError_(err);
    return json_({ ok:false, error: String(err) });
  }
}

function config_() {
  const ss = S();
  const templates = getRows_(ss, 'Templates_Journalier').map(r => ({ 
    code:r.code||r[0], produit:r.produit||r[1], type:r.type||r[2], unite:r.unite||r[3], zone:r.zone||r[4],
    label:`${r.produit||r[1]} — ${String(r.type||r[2]||'').toUpperCase()} (${r.unite||r[3]})`
  }));
  const recettes = getRows_(ss, 'Recettes_Index').map(r => ({ 
    code:r.code||r[0], nom:r.nom||r[1], portions:Number(r.portions||r[2]||1),
    ingredients: parseJsonSafe_(r.ingredients_json||r[3], [])
  }));
  const stockPreview = getRows_(ss, 'Stock_Suivi').slice(0,20);
  const kpis = { pertes7j: last7DaysPertesKg_(ss), valeurStock: sumCol_(ss,'Stock_Suivi','Valeur stock'), recettes: recettes.length, alertes: 0 };
  return json_({ ok:true, templates, recettes, stockPreview, kpis, topPertes: topPertes_(ss) });
}

function recordPerte_(data) {
  if (!data?.produit || !data?.quantite || !data?.unite || !data?.motif) throw new Error('Champs manquants');
  S().getSheetByName('Mouvements').appendRow([new Date(),'PERTE',data.produit,Number(data.quantite),data.unite,data.motif,getUser_(),'']);
  return json_({ ok:true });
}

function recordMouvement_(data) {
  if (!data?.templateCode || !data?.quantite) throw new Error('Champs manquants');
  const ss = S();
  const tmpl = findRow_(ss,'Templates_Journalier','code', String(data.templateCode));
  if (!tmpl) throw new Error('Template introuvable');
  const type = String(tmpl.type||tmpl[2]||'').toUpperCase();
  const produit = tmpl.produit||tmpl[1];
  const unite = tmpl.unite||tmpl[3];
  const zone  = tmpl.zone||tmpl[4]||'';
  ss.getSheetByName('Mouvements').appendRow([new Date(),type,produit,Number(data.quantite),unite,'Journalier',getUser_(),zone]);
  return json_({ ok:true });
}

function recordInventaireMensuel_(data) {
  S().getSheetByName('Inventaires').appendRow([new Date(), data?.zone||'', data?.etape||'Brouillon', getUser_()]);
  return json_({ ok:true });
}

function recordProduction_(data) {
  const ss = S();
  const rIdx = findRow_(ss,'Recettes_Index','code', String(data?.code||''));
  if (!rIdx) throw new Error('Recette introuvable');
  const ingList = parseJsonSafe_(rIdx.ingredients_json||rIdx[3], []);
  const factor = Number(data?.factor||1);
  ss.getSheetByName('Productions').appendRow([new Date(), data.code, factor, getUser_()]);
  const mv = ss.getSheetByName('Mouvements');
  ingList.forEach(ing => mv.appendRow([new Date(),'SORTIE',ing.nom,Number(ing.qte)*factor,(ing.unite||''),'Production',getUser_(),'Cuisine']));
  return json_({ ok:true });
}

function generateReport_(data) { return json_({ ok:true, message:'Report job queued (stub)' }); }

function getRows_(ss, name) {
  const sh = ss.getSheetByName(name); if (!sh) return [];
  const values = sh.getDataRange().getValues(); if (!values.length) return [];
  const headers = values.shift();
  return values.map(row => Object.fromEntries(headers.map((h,i)=>[h, row[i]])));
}

function findRow_(ss, name, key, value) { return getRows_(ss, name).find(r => String(r[key]) === String(value)); }

function last7DaysPertesKg_(ss) {
  const sh = ss.getSheetByName('Mouvements'); if (!sh) return 0;
  const values = sh.getDataRange().getValues(); if (!values.length) return 0;
  const headers = values.shift();
  const iType = headers.indexOf('Type');
  const iQty  = headers.indexOf('Quantité');
  const iUnit = headers.indexOf('Unité');
  const iDate = headers.indexOf('Date');
  const since = new Date(Date.now() - 7*24*3600*1000);
  let total = 0;
  values.forEach(r => {
    const d = r[iDate];
    if (d && d >= since && String(r[iType]).toUpperCase()==='PERTE') {
      const q = Number(r[iQty]) || 0;
      const u = String(r[iUnit]||'kg');
      total += (u==='kg') ? q : 0;
    }
  });
  return total;
}

function topPertes_(ss) {
  const rows = getRows_(ss,'Mouvements').filter(r => String(r.Type||'').toUpperCase()==='PERTE');
  const map = {};
  rows.forEach(r => {
    const p = r.Produit || '';
    const q = Number(r['Quantité'] || 0);
    const u = String(r['Unité'] || 'kg');
    if (u !== 'kg') return;
    map[p] = (map[p] || 0) + q;
  });
  return Object.entries(map).map(([produit,kg]) => ({ produit, kg })).sort((a,b)=>b.kg-a.kg).slice(0,10);
}

function sumCol_(ss, sheet, colName) { return getRows_(ss, sheet).reduce((acc,r)=> acc + Number(r[colName]||0), 0); }

function getUser_() { try { return Session.getActiveUser().getEmail() || 'webapp'; } catch(_) { return 'webapp'; } }

function logError_(err) { try { (S().getSheetByName('Logs_Erreurs')||S().insertSheet('Logs_Erreurs')).appendRow([new Date(), String(err)]); } catch (_) {} }

function parseJsonSafe_(s, fallback) { try { return JSON.parse(s); } catch(_) { return fallback; } }
