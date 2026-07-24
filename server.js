/*
 * Hub Rapport Technique — DZ Construct
 * Rôles :
 *  - sert le cockpit web (dashboard + page debug)
 *  - proxy vers les webhooks n8n (le navigateur ne parle jamais à n8n directement)
 *  - conversion HTML -> Word (.docx) utilisée par le workflow n8n
 *  - dépôt et distribution des rapports générés (PDF / Word / aperçu HTML)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Base des webhooks n8n (production). Modifiable sans toucher au code via variable Railway.
const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE || 'https://n8n-production-8929d.up.railway.app/webhook';

// Répertoire de stockage des rapports. Sur Railway, monter un volume sur /app/data pour la persistance.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Santé
// ---------------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  let n8n = 'inconnu';
  try {
    const r = await fetch(N8N_WEBHOOK_BASE.replace(/\/webhook$/, '/healthz'), { signal: AbortSignal.timeout(5000) });
    n8n = r.ok ? 'ok' : `erreur (${r.status})`;
  } catch (e) {
    n8n = 'injoignable';
  }
  res.json({
    cockpit: 'ok',
    n8n,
    stockage: fs.existsSync(REPORTS_DIR) ? 'ok' : 'absent',
    rapports: fs.readdirSync(REPORTS_DIR).length,
    version: '2.2.0',
  });
});

// ---------------------------------------------------------------------------
// Proxy vers les webhooks n8n (chantiers, runs, génération, découverte)
// ---------------------------------------------------------------------------
async function proxyToN8n(res, method, webhookPath, body) {
  try {
    const r = await fetch(`${N8N_WEBHOOK_BASE}/${webhookPath}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const text = await r.text();
    res.status(r.status);
    try {
      res.json(JSON.parse(text));
    } catch {
      res.send(text);
    }
  } catch (e) {
    res.status(502).json({ erreur: 'n8n injoignable', detail: String(e.message || e) });
  }
}

app.get('/api/chantiers', (req, res) => proxyToN8n(res, 'GET', 'dz/api/chantiers'));
app.post('/api/chantiers', (req, res) => proxyToN8n(res, 'POST', 'dz/api/chantiers', req.body));
app.get('/api/runs', (req, res) => proxyToN8n(res, 'GET', 'dz/api/runs'));
app.get('/api/contacts', (req, res) => proxyToN8n(res, 'GET', 'dz/api/contacts'));
app.post('/api/contacts', (req, res) => proxyToN8n(res, 'POST', 'dz/api/contacts', req.body));
app.get('/api/reglages', (req, res) => proxyToN8n(res, 'GET', 'dz/api/reglages'));
app.post('/api/reglages', (req, res) => proxyToN8n(res, 'POST', 'dz/api/reglages', req.body));
app.post('/api/generer', (req, res) => proxyToN8n(res, 'POST', 'dz/generer', req.body));
app.post('/api/decouverte', (req, res) => proxyToN8n(res, 'POST', 'dz/decouverte', req.body));

// ---------------------------------------------------------------------------
// Conversion HTML -> Word (.docx) — appelée par le workflow n8n (Lot 2)
// Corps attendu : { html: "<html…>", filename: "rapport.docx" }
// ---------------------------------------------------------------------------
// Prépare le HTML du rapport pour la conversion Word.
// html-to-docx ne comprend qu'un sous-ensemble du CSS (il ignore les <style> et
// les classes) : le HTML est pensé pour PDFShift (vrai moteur navigateur). On
// réécrit donc, pour le Word uniquement, ce que html-to-docx sait lire : des
// styles EN LIGNE et des dimensions d'images en attributs.
function htmlPourWord(html) {
  let h = html;
  // Icônes de chapitre : inliner en base64 + taille fixe. ⚠️ html-to-docx IGNORE
  // les attributs width/height des images (il prend la taille native, ici 96px) :
  // seul le CSS EN LIGNE `style="width:…"` est respecté.
  h = h.replace(/<img class="ico"[^>]*\/icons\/(equipes|illustrations|materiel)\.png"[^>]*>/g, (m, nom) => {
    try {
      const b64 = fs.readFileSync(path.join(__dirname, 'public', 'icons', `${nom}.png`)).toString('base64');
      return `<img src="data:image/png;base64,${b64}" style="width:14px;height:14px;vertical-align:middle" />`;
    } catch {
      return m;
    }
  });
  // Photos de chantier : largeur bornée en style (le ratio est conservé)
  h = h.replace(/<div class="photos">([\s\S]*?)<\/div>/g, (m, inner) =>
    '<div class="photos">' + inner.replace(/<img /g, '<img style="width:330px" ') + '</div>');
  // Tableaux « équipes » : styles en ligne (Word ignore les classes)
  h = h.replace(/<table class="equipes">/g,
    '<table style="width:100%;border-collapse:collapse;font-size:10px" border="0" cellspacing="0">');
  h = h.replace(/<th style="text-align:right">/g,
    '<th style="background:#f4f4f2;border-bottom:1px solid #bbb;padding:5px;text-align:right">');
  h = h.replace(/<th>/g,
    '<th style="background:#f4f4f2;border-bottom:1px solid #bbb;padding:5px;text-align:left">');
  // Lignes de total (avant de styliser les td génériques)
  h = h.replace(/<tr class="jourtotal"><td colspan="3">/g,
    '<tr><td colspan="3" style="font-weight:bold;background:#f3ece7;border-top:2px solid #ff110b;border-bottom:2px solid #ff110b;padding:5px">');
  h = h.replace(/<tr class="total"><td colspan="3">/g,
    '<tr><td colspan="3" style="font-weight:bold;background:#faf7f7;border-bottom:2px solid #ccc;padding:5px">');
  h = h.replace(/<td class="h">/g,
    '<td style="text-align:right;white-space:nowrap;padding:5px;border-bottom:1px solid #eee;vertical-align:top">');
  h = h.replace(/<td>/g,
    '<td style="padding:5px;border-bottom:1px solid #eee;vertical-align:top">');
  // Sous-lignes (qualification · catégorie · matricule ; commentaire libre)
  h = h.replace(/<div class="sub">/g, '<div style="color:#8a8a81;font-size:8.5px">');
  // Logo de garde : largeur raisonnable (cible directe pour ne pas dépendre de l'ordre)
  h = h.replace(/(<div class="garde">\s*<img )src=/, '$1style="width:220px" src=');
  return h;
}

// html-to-docx ne déclare pas de version Word dans les métadonnées : MS Word
// ouvre alors le fichier en « mode de compatibilité » (et propose de le convertir).
// On injecte le réglage compatibilityMode=15 (Word 2013+) dans settings.xml.
async function forcerWordModerne(buffer) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const chemin = 'word/settings.xml';
    let xml = await zip.file(chemin).async('string');
    if (!xml.includes('compatibilityMode')) {
      const compat = '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>';
      xml = xml.replace('</w:settings>', compat + '</w:settings>');
      zip.file(chemin, xml);
      return zip.generateAsync({ type: 'nodebuffer' });
    }
  } catch {
    /* en cas d'échec, on renvoie le docx d'origine (fonctionnel, juste en mode compatibilité) */
  }
  return Buffer.from(buffer);
}

app.post('/api/convert/docx', async (req, res) => {
  const { html, filename } = req.body || {};
  if (!html) return res.status(400).json({ erreur: 'champ "html" manquant' });
  try {
    const HTMLtoDOCX = (await import('html-to-docx')).default;
    const nomFichier = String(filename || 'rapport.docx').replace(/\.docx$/i, '');
    const piedWord = `<p style="font-size:9.5px;color:#8a8a81;margin:0">${nomFichier}</p>`;
    const brut = await HTMLtoDOCX(
      htmlPourWord(html),
      null,
      { table: { row: { cantSplit: true } }, footer: true, pageNumber: true, font: 'Calibri' },
      piedWord,
    );
    const buffer = await forcerWordModerne(brut);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${(filename || 'rapport.docx').replace(/[^\w.\-]/g, '_')}"`,
    });
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).json({ erreur: 'conversion docx échouée', detail: String(e.message || e) });
  }
});

// ---------------------------------------------------------------------------
// Dépôt des rapports (Lot 4 — répertoire tampon en attendant la décision Francis)
// POST /api/reports/upload?chantier=…&periode=…&type=pdf|docx|html  (corps = fichier brut)
// ---------------------------------------------------------------------------
const RAW_TYPES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', html: 'text/html' };

app.post('/api/reports/upload', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  const { chantier, periode, type } = req.query;
  if (!chantier || !periode || !RAW_TYPES[type]) {
    return res.status(400).json({ erreur: 'paramètres requis : chantier, periode, type (pdf|docx|html)' });
  }
  const safe = (s) => String(s).replace(/[^\w.\-]/g, '_');
  const name = `${safe(chantier)}__${safe(periode)}.${type}`;
  fs.writeFileSync(path.join(REPORTS_DIR, name), req.body);
  res.json({ ok: true, fichier: name, url: `/reports/${encodeURIComponent(name)}` });
});

app.get('/api/reports', (req, res) => {
  const files = fs.readdirSync(REPORTS_DIR).map((f) => {
    const st = fs.statSync(path.join(REPORTS_DIR, f));
    const m = f.match(/^(.+)__(.+)\.(pdf|docx|html)$/);
    return {
      fichier: f,
      chantier: m ? m[1].replace(/_/g, ' ') : f,
      periode: m ? m[2] : '',
      type: m ? m[3] : '',
      taille: st.size,
      modifie: st.mtime.toISOString(),
      url: `/reports/${encodeURIComponent(f)}`,
    };
  });
  files.sort((a, b) => (a.modifie < b.modifie ? 1 : -1));
  res.json(files);
});

app.get('/reports/:file', (req, res) => {
  const f = path.basename(req.params.file);
  const full = path.join(REPORTS_DIR, f);
  if (!fs.existsSync(full)) return res.status(404).send('Rapport introuvable');
  const ext = f.split('.').pop();
  res.set('Content-Type', RAW_TYPES[ext] || 'application/octet-stream');
  if (ext !== 'html') res.set('Content-Disposition', `attachment; filename="${f}"`);
  res.sendFile(full);
});

app.get('/debug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'debug.html')));
app.get('/guide', (req, res) => res.sendFile(path.join(__dirname, 'public', 'guide.html')));
app.get('/rapports', (req, res) => res.sendFile(path.join(__dirname, 'public', 'rapports.html')));
app.get('/configuration', (req, res) => res.sendFile(path.join(__dirname, 'public', 'configuration.html')));

app.listen(PORT, () => {
  console.log(`Hub Rapport Technique DZ — port ${PORT}`);
  console.log(`Webhooks n8n : ${N8N_WEBHOOK_BASE}`);
  console.log(`Rapports : ${REPORTS_DIR}`);
});
