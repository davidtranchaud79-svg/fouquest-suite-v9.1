// Fouques’t Suite v9.0 – Frontend (Alpine.js)
import { api } from './api.js';

export const appState = {
  tabs: [
    { id:'home', label:'🏠 Dashboard' },
    { id:'pertes', label:'🗑️ Pertes' },
    { id:'journalier', label:'📦 Journalier' },
    { id:'mensuel', label:'🗂️ Mensuel' },
    { id:'recettes', label:'📖 Recettes' },
    { id:'rapports', label:'📊 Rapports' },
  ],
  activeTab: 'home',
  isOnline: navigator.onLine,
  kpis: { pertes7j: 0, valeurStock: 0, recettes: 0, alertes: 0 },
  motifs: ['DLC dépassée','Surcuisson','Casse','Surproduction','Autre'],
  perte: { produit:'', quantite:null, unite:'kg', motif:'' },
  templatesJournalier: [],
  mvt: { templateCode:'', quantite: null },
  stockPreview: [],
  zones: ['CF poissons','CF viandes','Economat','Surgelés'],
  mensuel: { zone:'', etape:'Brouillon' },
  recettes: [],
  recette: { search:'', factor: 1 },
  rapport: { debut:'', fin:'' },

  async init() {
    // Load initial data
    try {
      const cfg = await api.config();
      this.kpis = { ...this.kpis, ...cfg.kpis };
      this.templatesJournalier = cfg.templates || [];
      this.recettes = cfg.recettes || [];
      this.stockPreview = cfg.stockPreview || [];
      this.drawCharts(cfg);
    } catch (e) {
      console.warn('Init offline or API error:', e);
    }

    window.addEventListener('online', ()=> this.isOnline = true);
    window.addEventListener('offline', ()=> this.isOnline = false);
  },

  async submitPerte() {
    if (!this.perte.produit || !this.perte.quantite || !this.perte.unite || !this.perte.motif) {
      alert('Merci de compléter tous les champs.'); return;
    }
    try {
      await api.post('/pertes', this.perte);
      this.perte = { produit:'', quantite:null, unite:'kg', motif:'' };
      alert('Perte enregistrée');
    } catch (e) {
      // Offline queue
      const q = JSON.parse(localStorage.getItem('offlineQueue')||'[]');
      q.push({ path:'/pertes', body: this.perte, ts: Date.now() });
      localStorage.setItem('offlineQueue', JSON.stringify(q));
      alert('Hors ligne: perte mise en file et sera synchronisée plus tard.');
    }
  },

  async submitMouvement() {
    if (!this.mvt.templateCode || !this.mvt.quantite) { alert('Sélection et quantité requises'); return; }
    try {
      await api.post('/mouvements', this.mvt);
      this.mvt = { templateCode:'', quantite:null };
      alert('Mouvement enregistré');
    } catch (e) {
      const q = JSON.parse(localStorage.getItem('offlineQueue')||'[]');
      q.push({ path:'/mouvements', body: this.mvt, ts: Date.now() });
      localStorage.setItem('offlineQueue', JSON.stringify(q));
      alert('Hors ligne: mouvement en file.');
    }
  },

  async soumettreMensuel() {
    if (!this.mensuel.zone || !this.mensuel.etape) { alert('Zone & étape nécessaires'); return; }
    await api.post('/inventaires', this.mensuel);
    alert('Inventaire mensuel enregistré');
  },

  get recettesFiltrees() {
    const q = (this.recette.search||'').toLowerCase();
    return this.recettes.filter(r => r.nom.toLowerCase().includes(q));
  },

  async produire(r) {
    await api.post('/productions', { code: r.code, factor: this.recette.factor || 1 });
    alert('Production enregistrée et sorties de stock générées.');
  },

  async genererRapport() {
    await api.post('/reports/generate', this.rapport);
    alert('Rapport demandé. Vous recevrez le PDF par email.');
  },

  formatCurrency(v) {
    try { return new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR' }).format(v||0); }
    catch { return `€${(v||0).toFixed(2)}`; }
  },

  drawCharts(cfg) {
    const ctx = document.getElementById('chartTopPertes');
    if (!ctx) return;
    const labels = (cfg.topPertes||[]).map(x=>x.produit);
    const data = (cfg.topPertes||[]).map(x=>x.kg);
    new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Top pertes (kg)', data }] },
      options: { responsive:true, plugins:{ legend:{ display:false } } }
    });
  }
};

document.addEventListener('alpine:init', () => {
  window.appState = Alpine.reactive(appState);
  window.appState.init();
});
