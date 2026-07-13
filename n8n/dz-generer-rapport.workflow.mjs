import { workflow, node, trigger, sticky, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const execution = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Exécution',
    position: [-560, 300],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'nom', type: 'string' },
          { name: 'wbs', type: 'string' },
          { name: 'conversation_bll', type: 'string' },
          { name: 'conversation_rt', type: 'string' },
          { name: 'date_debut', type: 'string' },
          { name: 'date_fin', type: 'string' },
          { name: 'demo', type: 'boolean' },
          { name: 'declenchement', type: 'string' },
        ],
      },
    },
  },
  output: [{ nom: '22.06-Gaichel-Maisons', wbs: '22.06 A;22.06 B', conversation_bll: '', conversation_rt: '', date_debut: '2026-07-06', date_fin: '2026-07-12', demo: true, declenchement: 'manuel' }],
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [-340, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'cfg-cockpit', name: 'cockpit_url', value: 'https://COCKPIT-URL-A-DEFINIR.up.railway.app', type: 'string' },
          { id: 'cfg-graph', name: 'graph_actif', value: false, type: 'boolean' },
          { id: 'cfg-traxxeo', name: 'traxxeo_actif', value: false, type: 'boolean' },
          { id: 'cfg-pdfshift', name: 'pdfshift_actif', value: false, type: 'boolean' },
        ],
      },
    },
  },
  output: [{ nom: '22.06-Gaichel-Maisons', wbs: '22.06 A;22.06 B', date_debut: '2026-07-06', date_fin: '2026-07-12', demo: true, declenchement: 'manuel', cockpit_url: 'https://cockpit.up.railway.app', graph_actif: false, traxxeo_actif: false, pdfshift_actif: false }],
});

const journalDebut = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Journaliser début',
    position: [-120, 300],
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: '9HVj9380Vw6DulOr', cachedResultName: 'dz_runs' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          chantier: expr('{{ $json.nom }}'),
          periode_debut: expr('{{ $json.date_debut }}'),
          periode_fin: expr('{{ $json.date_fin }}'),
          statut: 'en cours',
          etape: 'démarrage',
          message: '',
          pdf_url: '',
          docx_url: '',
          declenchement: expr('{{ $json.declenchement }}'),
          demarre_le: expr('{{ $now.toISO() }}'),
          stats: '',
        },
        schema: [
          { id: 'chantier', displayName: 'chantier', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'periode_debut', displayName: 'periode_debut', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'periode_fin', displayName: 'periode_fin', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'statut', displayName: 'statut', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'etape', displayName: 'etape', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'message', displayName: 'message', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'pdf_url', displayName: 'pdf_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'docx_url', displayName: 'docx_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'declenchement', displayName: 'declenchement', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'demarre_le', displayName: 'demarre_le', required: false, defaultMatch: false, display: true, type: 'date', canBeUsedToMatch: true },
          { id: 'termine_le', displayName: 'termine_le', required: false, defaultMatch: false, display: true, type: 'date', canBeUsedToMatch: true },
          { id: 'stats', displayName: 'stats', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
      },
    },
  },
  output: [{ id: 1 }],
});

const traxxeoActif = ifElse({
  version: 2.2,
  config: {
    name: 'Traxxeo actif ?',
    position: [100, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        combinator: 'and',
        conditions: [
          { leftValue: expr('{{ $("Config").item.json.traxxeo_actif }}'), operator: { type: 'boolean', operation: 'true' } },
          { leftValue: expr('{{ $("Exécution").item.json.demo }}'), operator: { type: 'boolean', operation: 'false' } },
        ],
      },
    },
  },
});

const lireTraxxeo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Lire activité Traxxeo',
    position: [320, 180],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: 'https://ords.traxxeo.com/api/v2/person_hrd',
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: 'all_data', value: 'Y' }] },
      options: {
        timeout: 90000,
        pagination: {
          pagination: {
            paginationMode: 'responseContainsNextURL',
            nextURL: expr('{{ $response.body.links?.find(l => l.rel === "next")?.href }}'),
            paginationCompleteWhen: 'other',
            completeExpression: expr('{{ !$response.body.links?.find(l => l.rel === "next") }}'),
            limitPagesFetched: true,
            maxRequests: 30,
            requestInterval: 200,
          },
        },
      },
    },
    credentials: { oAuth2Api: newCredential('Traxxeo API') },
  },
  output: [{ items: [{ person_name: 'Jean Dupont', work_code_name: 'Heure travail', work_duration: 8, user_comment: 'Coffrage voile A2', declared_vehicle_name: 'Grue mobile', work_date: '06/07/2026', wbs: '22.06 A' }] }],
});

const mapperTraxxeo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Mapper activité Traxxeo',
    position: [540, 180],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Regles metier (CLAUDE.md) : Heure travail uniquement, WBS du chantier, dates DD/MM/YYYY -> YYYY-MM-DD,
// work_duration = heures de la ligne (jamais "Heures declarees visibles"). Total journee calcule par personne.
const exec = $('Exécution').first().json;
const wbsList = String(exec.wbs || '').split(';').map(function (s) { return s.trim(); }).filter(Boolean);
const debut = exec.date_debut;
const fin = exec.date_fin;

const rows = [];
for (const item of $input.all()) {
  const j = item.json || {};
  const arr = Array.isArray(j) ? j : (j.items || j.rows || j.value || j.data || []);
  if (Array.isArray(arr)) for (const r of arr) rows.push(r);
}

function normDate(d) {
  if (!d) return null;
  const s = String(d);
  const m = s.match(/^(\\d{2})\\/(\\d{2})\\/(\\d{4})/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return s.substring(0, 10);
}

const parJour = {};
let nb = 0;
for (const r of rows) {
  if (String(r.work_code_name || '').trim() !== 'Heure travail') continue;
  // Champ WBS : nom exact a confirmer avec l'export POC (candidats couverts ci-dessous)
  const wbs = String(r.wbs ?? r.wbs_code ?? r.wbs_name ?? r.project_code ?? r.project ?? '').trim();
  if (wbsList.length && wbs && !wbsList.includes(wbs)) continue;
  const date = normDate(r.work_date ?? r.date ?? r.day_date ?? r.date_from);
  if (!date || date < debut || date > fin) continue;
  const jour = (parJour[date] = parJour[date] || { lignes: [], totaux: {} });
  const personne = String(r.person_name || '').trim() || 'Inconnu';
  const heures = Number(r.work_duration) || 0;
  jour.lignes.push({
    personne: personne,
    tache: String(r.user_comment || '').trim(),
    equipement: String(r.declared_vehicle_name || '').trim(),
    heures: heures,
  });
  jour.totaux[personne] = Math.round(((jour.totaux[personne] || 0) + heures) * 100) / 100;
  nb++;
}
for (const d of Object.keys(parJour)) {
  parJour[d].lignes.sort(function (a, b) { return a.personne.localeCompare(b.personne); });
}
return [{ json: { source: 'traxxeo', parJour: parJour, nb: nb } }];`,
    },
  },
  output: [{ source: 'traxxeo', parJour: {}, nb: 0 }],
});

const rtActif = ifElse({
  version: 2.2,
  config: {
    name: 'Teams RT actif ?',
    position: [760, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        combinator: 'and',
        conditions: [
          { leftValue: expr('{{ $("Config").item.json.graph_actif }}'), operator: { type: 'boolean', operation: 'true' } },
          { leftValue: expr('{{ $("Exécution").item.json.demo }}'), operator: { type: 'boolean', operation: 'false' } },
          { leftValue: expr('{{ $("Exécution").item.json.conversation_rt }}'), operator: { type: 'string', operation: 'notEmpty' } },
        ],
      },
    },
  },
});

const lireRT = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Lire messages RT',
    position: [980, 180],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('https://graph.microsoft.com/v1.0/chats/{{ $("Exécution").item.json.conversation_rt }}/messages'),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: '$top', value: '50' }] },
      options: {
        timeout: 60000,
        pagination: {
          pagination: {
            paginationMode: 'responseContainsNextURL',
            nextURL: expr('{{ $response.body["@odata.nextLink"] }}'),
            paginationCompleteWhen: 'other',
            completeExpression: expr('{{ !$response.body["@odata.nextLink"] || ($response.body.value || []).some(m => String(m.createdDateTime || "9999").substring(0, 10) < $("Exécution").item.json.date_debut) }}'),
            limitPagesFetched: true,
            maxRequests: 15,
            requestInterval: 200,
          },
        },
      },
    },
    credentials: { oAuth2Api: newCredential('Microsoft Graph DZ') },
  },
  output: [{ value: [{ id: '175', createdDateTime: '2026-07-07T09:14:00Z', messageType: 'message', from: { user: { displayName: 'Fares' } }, body: { contentType: 'html', content: '<p>Ferraillage voile A2 <img src="https://graph.microsoft.com/v1.0/chats/19:x/messages/175/hostedContents/abc/$value"></p>' } }] }],
});

const extraireRT = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extraire images RT',
    position: [1200, 180],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Liste les images hostedContents des messages de la semaine (1 item par image).
const exec = $('Exécution').first().json;
const debut = exec.date_debut;
const fin = exec.date_fin;
const images = [];
for (const item of $input.all()) {
  const v = (item.json && item.json.value) || [];
  for (const m of v) {
    if (!m || !m.createdDateTime) continue;
    if (m.messageType && m.messageType !== 'message') continue;
    const date = String(m.createdDateTime).substring(0, 10);
    if (date < debut || date > fin) continue;
    const html = (m.body && m.body.content) || '';
    const re = /src="(https:\\/\\/graph\\.microsoft\\.com\\/[^"]*hostedContents[^"]*\\$value)"/g;
    let match;
    while ((match = re.exec(html)) !== null) {
      images.push({ json: { url: match[1].replace(/&amp;/g, '&'), date: date, ts: m.createdDateTime } });
    }
  }
}
images.sort(function (a, b) { return String(a.json.ts).localeCompare(String(b.json.ts)); });
if (!images.length) return [{ json: { aucune: true } }];
return images;`,
    },
  },
  output: [{ url: 'https://graph.microsoft.com/v1.0/chats/19:x/messages/175/hostedContents/abc/$value', date: '2026-07-07', ts: '2026-07-07T09:14:00Z' }],
});

const telechargerRT = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Télécharger images RT',
    position: [1420, 180],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      options: {
        timeout: 45000,
        batching: { batch: { batchSize: 4, batchInterval: 300 } },
        response: { response: { responseFormat: 'file' } },
      },
    },
    credentials: { oAuth2Api: newCredential('Microsoft Graph DZ') },
  },
  output: [{ url: 'https://graph.microsoft.com/...', date: '2026-07-07' }],
});

const assemblerRT = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Assembler RT',
    position: [1640, 180],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Regroupe textes (depuis Lire messages RT) et photos (binaire -> base64 via getBinaryDataBuffer) par jour.
const exec = $('Exécution').first().json;
const debut = exec.date_debut;
const fin = exec.date_fin;

const textesParJour = {};
let nbMessages = 0;
try {
  const msgs = [];
  for (const page of $('Lire messages RT').all()) {
    const v = (page.json && page.json.value) || [];
    for (const m of v) msgs.push(m);
  }
  msgs.sort(function (a, b) { return String(a.createdDateTime).localeCompare(String(b.createdDateTime)); });
  for (const m of msgs) {
    if (!m || !m.createdDateTime) continue;
    if (m.messageType && m.messageType !== 'message') continue;
    const date = String(m.createdDateTime).substring(0, 10);
    if (date < debut || date > fin) continue;
    const brut = ((m.body && m.body.content) || '')
      .replace(/<img[^>]*>/g, ' ')
      .replace(/<br[^>]*>/g, '\\n')
      .replace(/<\\/p>/g, '\\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    const auteur = (m.from && m.from.user && m.from.user.displayName) || '';
    if (!brut) continue;
    (textesParJour[date] = textesParJour[date] || []).push({
      heure: String(m.createdDateTime).substring(11, 16),
      auteur: auteur,
      texte: brut,
    });
    nbMessages++;
  }
} catch (e) { /* source indisponible */ }

const imagesParJour = {};
let nbImages = 0;
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const j = it.json || {};
  if (!it.binary || !it.binary.data || j.error || !j.date) continue;
  const buf = await helpers.getBinaryDataBuffer(i, 'data');
  const mime = it.binary.data.mimeType || 'image/jpeg';
  (imagesParJour[j.date] = imagesParJour[j.date] || []).push('data:' + mime + ';base64,' + buf.toString('base64'));
  nbImages++;
}
return [{ json: { source: 'rt', textes: textesParJour, images: imagesParJour, nbMessages: nbMessages, nbImages: nbImages } }];`,
    },
  },
  output: [{ source: 'rt', textes: {}, images: {}, nbMessages: 0, nbImages: 0 }],
});

const bllActif = ifElse({
  version: 2.2,
  config: {
    name: 'Teams BLL actif ?',
    position: [1860, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        combinator: 'and',
        conditions: [
          { leftValue: expr('{{ $("Config").item.json.graph_actif }}'), operator: { type: 'boolean', operation: 'true' } },
          { leftValue: expr('{{ $("Exécution").item.json.demo }}'), operator: { type: 'boolean', operation: 'false' } },
          { leftValue: expr('{{ $("Exécution").item.json.conversation_bll }}'), operator: { type: 'string', operation: 'notEmpty' } },
        ],
      },
    },
  },
});

const lireBLL = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Lire messages BLL',
    position: [2080, 180],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('https://graph.microsoft.com/v1.0/chats/{{ $("Exécution").item.json.conversation_bll }}/messages'),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: '$top', value: '50' }] },
      options: {
        timeout: 60000,
        pagination: {
          pagination: {
            paginationMode: 'responseContainsNextURL',
            nextURL: expr('{{ $response.body["@odata.nextLink"] }}'),
            paginationCompleteWhen: 'other',
            completeExpression: expr('{{ !$response.body["@odata.nextLink"] || ($response.body.value || []).some(m => String(m.createdDateTime || "9999").substring(0, 10) < $("Exécution").item.json.date_debut) }}'),
            limitPagesFetched: true,
            maxRequests: 15,
            requestInterval: 200,
          },
        },
      },
    },
    credentials: { oAuth2Api: newCredential('Microsoft Graph DZ') },
  },
  output: [{ value: [] }],
});

const extraireBLL = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extraire images BLL',
    position: [2300, 180],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Liste les images hostedContents des messages BLL de la semaine (1 item par image).
const exec = $('Exécution').first().json;
const debut = exec.date_debut;
const fin = exec.date_fin;
const images = [];
for (const item of $input.all()) {
  const v = (item.json && item.json.value) || [];
  for (const m of v) {
    if (!m || !m.createdDateTime) continue;
    if (m.messageType && m.messageType !== 'message') continue;
    const date = String(m.createdDateTime).substring(0, 10);
    if (date < debut || date > fin) continue;
    const html = (m.body && m.body.content) || '';
    const re = /src="(https:\\/\\/graph\\.microsoft\\.com\\/[^"]*hostedContents[^"]*\\$value)"/g;
    let match;
    while ((match = re.exec(html)) !== null) {
      images.push({ json: { url: match[1].replace(/&amp;/g, '&'), date: date, ts: m.createdDateTime } });
    }
  }
}
images.sort(function (a, b) { return String(a.json.ts).localeCompare(String(b.json.ts)); });
if (!images.length) return [{ json: { aucune: true } }];
return images;`,
    },
  },
  output: [{ aucune: true }],
});

const telechargerBLL = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Télécharger images BLL',
    position: [2520, 180],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      options: {
        timeout: 45000,
        batching: { batch: { batchSize: 4, batchInterval: 300 } },
        response: { response: { responseFormat: 'file' } },
      },
    },
    credentials: { oAuth2Api: newCredential('Microsoft Graph DZ') },
  },
  output: [{ aucune: true }],
});

const assemblerBLL = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Assembler BLL',
    position: [2740, 180],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Regroupe textes et photos BLL par jour (bons de livraison).
const exec = $('Exécution').first().json;
const debut = exec.date_debut;
const fin = exec.date_fin;

const textesParJour = {};
let nbMessages = 0;
try {
  const msgs = [];
  for (const page of $('Lire messages BLL').all()) {
    const v = (page.json && page.json.value) || [];
    for (const m of v) msgs.push(m);
  }
  msgs.sort(function (a, b) { return String(a.createdDateTime).localeCompare(String(b.createdDateTime)); });
  for (const m of msgs) {
    if (!m || !m.createdDateTime) continue;
    if (m.messageType && m.messageType !== 'message') continue;
    const date = String(m.createdDateTime).substring(0, 10);
    if (date < debut || date > fin) continue;
    const brut = ((m.body && m.body.content) || '')
      .replace(/<img[^>]*>/g, ' ')
      .replace(/<br[^>]*>/g, '\\n')
      .replace(/<\\/p>/g, '\\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    const auteur = (m.from && m.from.user && m.from.user.displayName) || '';
    if (!brut) continue;
    (textesParJour[date] = textesParJour[date] || []).push({
      heure: String(m.createdDateTime).substring(11, 16),
      auteur: auteur,
      texte: brut,
    });
    nbMessages++;
  }
} catch (e) { /* source indisponible */ }

const imagesParJour = {};
let nbImages = 0;
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  const j = it.json || {};
  if (!it.binary || !it.binary.data || j.error || !j.date) continue;
  const buf = await helpers.getBinaryDataBuffer(i, 'data');
  const mime = it.binary.data.mimeType || 'image/jpeg';
  (imagesParJour[j.date] = imagesParJour[j.date] || []).push('data:' + mime + ';base64,' + buf.toString('base64'));
  nbImages++;
}
return [{ json: { source: 'bll', textes: textesParJour, images: imagesParJour, nbMessages: nbMessages, nbImages: nbImages } }];`,
    },
  },
  output: [{ source: 'bll', textes: {}, images: {}, nbMessages: 0, nbImages: 0 }],
});

const fusionner = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Fusionner sources',
    position: [2960, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Fusionne les 3 sources par jour. Cles de date normalisees en YYYY-MM-DD (substring(0,10)).
// En mode demo, injecte un jeu de donnees d'exemple pour valider la mise en page de bout en bout.
const exec = $('Exécution').first().json;
const demo = exec.demo === true || exec.demo === 'true';

function grab(nom) {
  try { const a = $(nom).all(); return a.length ? a[0].json : null; } catch (e) { return null; }
}
let trax = grab('Mapper activité Traxxeo');
let rt = grab('Assembler RT');
let bll = grab('Assembler BLL');

if (demo) {
  const j1 = exec.date_debut;
  const d2 = new Date(j1 + 'T12:00:00Z'); d2.setUTCDate(d2.getUTCDate() + 1);
  const j2 = d2.toISOString().substring(0, 10);
  const photo = 'data:image/svg+xml;base64,' + Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420">' +
    '<rect width="100%" height="100%" fill="#ececea"/>' +
    '<rect x="20" y="20" width="600" height="380" fill="none" stroke="#c9c9c4" stroke-width="2" stroke-dasharray="8 6"/>' +
    '<text x="320" y="200" text-anchor="middle" font-family="Arial" font-size="22" fill="#8a8a81">Photo du chantier</text>' +
    '<text x="320" y="232" text-anchor="middle" font-family="Arial" font-size="15" fill="#b0b0a8">(exemple — mode démo)</text>' +
    '</svg>').toString('base64');
  trax = { source: 'traxxeo', nb: 6, parJour: {} };
  trax.parJour[j1] = {
    lignes: [
      { personne: 'DUPONT Jean', tache: 'Coffrage voile A2, niveau R+1', equipement: 'Grue mobile 40T', heures: 8 },
      { personne: 'DUPONT Jean', tache: 'Nettoyage zone de coulage', equipement: '', heures: 1 },
      { personne: 'MARTINS Paulo', tache: 'Ferraillage dalle B', equipement: '', heures: 8.5 },
      { personne: 'WEBER Marc', tache: '', equipement: 'Pelle 8T', heures: 7.5 },
    ],
    totaux: { 'DUPONT Jean': 9, 'MARTINS Paulo': 8.5, 'WEBER Marc': 7.5 },
  };
  trax.parJour[j2] = {
    lignes: [
      { personne: 'DUPONT Jean', tache: 'Décoffrage voile A2', equipement: '', heures: 8 },
      { personne: 'MARTINS Paulo', tache: 'Pose prédalles zone B', equipement: 'Grue mobile 40T', heures: 8 },
    ],
    totaux: { 'DUPONT Jean': 8, 'MARTINS Paulo': 8 },
  };
  rt = { source: 'rt', nbMessages: 3, nbImages: 2, textes: {}, images: {} };
  rt.textes[j1] = [
    { heure: '09:14', auteur: 'Fares', texte: 'Ferraillage du voile A2 terminé, contrôle avant coulage OK.' },
    { heure: '14:02', auteur: 'Fares', texte: 'Coulage du voile A2 réalisé cet après-midi (12 m³).' },
  ];
  rt.textes[j2] = [{ heure: '10:41', auteur: 'Fares', texte: 'Décoffrage du voile A2 : parement conforme, pas de reprise à prévoir.' }];
  rt.images[j1] = [photo];
  rt.images[j2] = [photo];
  bll = { source: 'bll', nbMessages: 1, nbImages: 1, textes: {}, images: {} };
  bll.textes[j1] = [{ heure: '07:55', auteur: 'Fares', texte: 'Livraison béton C30/37 — bon n° 4521, 12 m³, Cimalux.' }];
  bll.images[j1] = [photo];
}

const jours = [];
const debut = new Date(exec.date_debut + 'T12:00:00Z');
const fin = new Date(exec.date_fin + 'T12:00:00Z');
for (let d = new Date(debut); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
  const date = d.toISOString().substring(0, 10);
  jours.push({
    date: date,
    traxxeo: (trax && trax.parJour && trax.parJour[date]) || null,
    rt: {
      textes: (rt && rt.textes && rt.textes[date]) || [],
      images: (rt && rt.images && rt.images[date]) || [],
    },
    bll: {
      textes: (bll && bll.textes && bll.textes[date]) || [],
      images: (bll && bll.images && bll.images[date]) || [],
    },
  });
}

const stats = [
  trax ? 'Traxxeo : ' + (trax.nb || 0) + ' ligne(s)' : 'Traxxeo : source inactive',
  rt ? 'RT : ' + (rt.nbMessages || 0) + ' message(s), ' + (rt.nbImages || 0) + ' photo(s)' : 'RT : source inactive',
  bll ? 'BLL : ' + (bll.nbMessages || 0) + ' message(s), ' + (bll.nbImages || 0) + ' photo(s)' : 'BLL : source inactive',
].join(' · ') + (demo ? ' · MODE DÉMO' : '');

return [{ json: { jours: jours, stats: stats, demo: demo } }];`,
    },
  },
  output: [{ jours: [], stats: 'Traxxeo : 6 ligne(s) · RT : 3 message(s), 2 photo(s) · BLL : 1 message(s), 1 photo(s)', demo: true }],
});

const preparer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Préparer rapport',
    position: [3180, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Genere le HTML complet du rapport (logo premiere page uniquement — running() non supporte par PDFShift).
const exec = $('Exécution').first().json;
const fusion = $('Fusionner sources').first().json;

const LOGO = 'data:image/png;base64,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';

const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dateFR(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  const j = JOURS_FR[d.getUTCDay()];
  return j.charAt(0).toUpperCase() + j.slice(1) + ' ' + d.getUTCDate() + ' ' + MOIS_FR[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function nl2br(s) { return esc(s).replace(/\\n/g, '<br>'); }

const css = [
  '@page { size: A4; margin: 18mm 15mm; }',
  'body { font-family: Helvetica, Arial, sans-serif; color: #1c1c1a; font-size: 10.5pt; line-height: 1.5; margin: 0; }',
  '.garde { text-align: left; padding-top: 30mm; }',
  '.garde img { width: 62mm; margin-bottom: 18mm; }',
  '.garde h1 { font-size: 24pt; margin: 0 0 4mm; }',
  '.garde .sous { color: #8a8a81; font-size: 13pt; margin-bottom: 12mm; }',
  '.garde table { font-size: 11pt; border-collapse: collapse; }',
  '.garde td { padding: 2mm 8mm 2mm 0; }',
  '.garde td:first-child { color: #8a8a81; }',
  '.jour { page-break-before: always; }',
  'h2.jour-titre { font-size: 15pt; border-bottom: 3px solid #ff110b; padding-bottom: 2mm; margin: 0 0 6mm; }',
  'h3 { font-size: 11pt; color: #ff110b; text-transform: uppercase; letter-spacing: 0.08em; margin: 8mm 0 3mm; }',
  'table.equipes { width: 100%; border-collapse: collapse; font-size: 9.5pt; }',
  'table.equipes th { text-align: left; background: #f4f4f2; color: #55554f; padding: 2mm; border-bottom: 1px solid #ddd; }',
  'table.equipes td { padding: 1.8mm 2mm; border-bottom: 1px solid #eee; vertical-align: top; }',
  'table.equipes td.h { text-align: right; white-space: nowrap; }',
  'tr.total td { font-weight: bold; background: #faf7f7; border-bottom: 2px solid #ddd; }',
  '.msg { margin: 0 0 3mm; }',
  '.msg .meta { color: #8a8a81; font-size: 8.5pt; }',
  '.photos { display: block; margin-top: 3mm; }',
  '.photos img { max-width: 84mm; max-height: 70mm; margin: 0 3mm 3mm 0; border: 1px solid #e2e2de; vertical-align: top; }',
  '.vide { color: #8a8a81; font-style: italic; }',
  '.pied { color: #b3b3ac; font-size: 8pt; margin-top: 6mm; }',
].join('\\n');

const parts = [];
parts.push('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>' + css + '</style></head><body>');

parts.push('<div class="garde">');
parts.push('<img src="' + LOGO + '" alt="DZ Construct">');
parts.push('<h1>Rapport technique hebdomadaire</h1>');
parts.push('<div class="sous">' + esc(exec.nom) + '</div>');
parts.push('<table>');
parts.push('<tr><td>Période</td><td>du ' + dateFR(exec.date_debut).toLowerCase() + ' au ' + dateFR(exec.date_fin).toLowerCase() + '</td></tr>');
parts.push('<tr><td>Généré le</td><td>' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + '</td></tr>');
if (fusion.demo) parts.push('<tr><td>Mode</td><td><strong>DÉMONSTRATION — données d\\'exemple</strong></td></tr>');
parts.push('</table></div>');

for (const jour of fusion.jours) {
  const t = jour.traxxeo;
  const aRT = jour.rt.textes.length || jour.rt.images.length;
  const aBLL = jour.bll.textes.length || jour.bll.images.length;
  if (!t && !aRT && !aBLL && (new Date(jour.date + 'T12:00:00Z').getUTCDay() === 0 || new Date(jour.date + 'T12:00:00Z').getUTCDay() === 6)) continue;

  parts.push('<div class="jour"><h2 class="jour-titre">' + dateFR(jour.date) + '</h2>');

  parts.push('<h3>1. Activité des équipes</h3>');
  if (t && t.lignes.length) {
    parts.push('<table class="equipes"><tr><th>Personne</th><th>Tâche</th><th>Équipement</th><th style="text-align:right">Heures</th></tr>');
    let courant = null;
    for (let i = 0; i < t.lignes.length; i++) {
      const l = t.lignes[i];
      parts.push('<tr><td>' + esc(l.personne) + '</td><td>' + esc(l.tache) + '</td><td>' + esc(l.equipement) + '</td><td class="h">' + l.heures.toLocaleString('fr-FR') + ' h</td></tr>');
      const suivant = t.lignes[i + 1];
      if (!suivant || suivant.personne !== l.personne) {
        parts.push('<tr class="total"><td colspan="3">Total journée — ' + esc(l.personne) + '</td><td class="h">' + (t.totaux[l.personne] || 0).toLocaleString('fr-FR') + ' h</td></tr>');
      }
    }
    parts.push('</table>');
  } else {
    parts.push('<p class="vide">Aucune activité déclarée dans Traxxeo pour cette journée.</p>');
  }

  parts.push('<h3>2. Illustrations et explications techniques</h3>');
  if (aRT) {
    for (const m of jour.rt.textes) {
      parts.push('<p class="msg"><span class="meta">' + esc(m.heure) + (m.auteur ? ' — ' + esc(m.auteur) : '') + '</span><br>' + nl2br(m.texte) + '</p>');
    }
    if (jour.rt.images.length) {
      parts.push('<div class="photos">' + jour.rt.images.map(function (src) { return '<img src="' + src + '">'; }).join('') + '</div>');
    }
  } else {
    parts.push('<p class="vide">Aucun élément publié dans la conversation RT ce jour.</p>');
  }

  parts.push('<h3>3. Matériel et bons de livraison</h3>');
  if (aBLL) {
    for (const m of jour.bll.textes) {
      parts.push('<p class="msg"><span class="meta">' + esc(m.heure) + (m.auteur ? ' — ' + esc(m.auteur) : '') + '</span><br>' + nl2br(m.texte) + '</p>');
    }
    if (jour.bll.images.length) {
      parts.push('<div class="photos">' + jour.bll.images.map(function (src) { return '<img src="' + src + '">'; }).join('') + '</div>');
    }
  } else {
    parts.push('<p class="vide">Aucun bon de livraison publié ce jour.</p>');
  }

  parts.push('<div class="pied">' + esc(exec.nom) + ' — semaine du ' + esc(exec.date_debut) + ' au ' + esc(exec.date_fin) + '</div>');
  parts.push('</div>');
}

parts.push('</body></html>');

const base = (exec.nom + '__' + exec.date_debut + '_' + exec.date_fin).replace(/[^\\w.\\-]/g, '_');
const periode = exec.date_debut + '_' + exec.date_fin;
return [{ json: { html: parts.join('\\n'), base: base, periode: periode } }];`,
    },
  },
  output: [{ html: '<!DOCTYPE html>...', base: '22.06-Gaichel-Maisons__2026-07-06_2026-07-12', periode: '2026-07-06_2026-07-12' }],
});

const deposerHTML = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Déposer aperçu HTML',
    position: [3400, 300],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $("Config").item.json.cockpit_url }}/api/reports/upload?chantier={{ encodeURIComponent($("Exécution").item.json.nom) }}&periode={{ $("Préparer rapport").item.json.periode }}&type=html'),
      sendBody: true,
      contentType: 'raw',
      specifyBody: 'string',
      rawContentType: 'text/html; charset=utf-8',
      body: expr('{{ $("Préparer rapport").item.json.html }}'),
      options: { timeout: 60000 },
    },
  },
  output: [{ ok: true, url: '/reports/x.html' }],
});

const pdfActif = ifElse({
  version: 2.2,
  config: {
    name: 'PDF actif ?',
    position: [3620, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        combinator: 'and',
        conditions: [
          { leftValue: expr('{{ $("Config").item.json.pdfshift_actif }}'), operator: { type: 'boolean', operation: 'true' } },
        ],
      },
    },
  },
});

const convertirPDF = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Convertir en PDF',
    position: [3840, 180],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.pdfshift.io/v3/convert/pdf',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBasicAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'keypair',
      bodyParameters: {
        parameters: [
          { name: 'source', value: expr('{{ $("Préparer rapport").item.json.html }}') },
        ],
      },
      options: {
        timeout: 180000,
        response: { response: { responseFormat: 'file' } },
      },
    },
    credentials: { httpBasicAuth: newCredential('PDFShift') },
  },
  output: [{}],
});

const deposerPDF = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Déposer PDF',
    position: [4060, 180],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $("Config").item.json.cockpit_url }}/api/reports/upload?chantier={{ encodeURIComponent($("Exécution").item.json.nom) }}&periode={{ $("Préparer rapport").item.json.periode }}&type=pdf'),
      sendBody: true,
      contentType: 'binaryData',
      inputDataFieldName: 'data',
      options: { timeout: 120000 },
    },
  },
  output: [{ ok: true, url: '/reports/x.pdf' }],
});

const convertirWord = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Convertir en Word',
    position: [4280, 300],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $("Config").item.json.cockpit_url }}/api/convert/docx'),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'keypair',
      bodyParameters: {
        parameters: [
          { name: 'html', value: expr('{{ $("Préparer rapport").item.json.html }}') },
          { name: 'filename', value: expr('{{ $("Préparer rapport").item.json.base }}.docx') },
        ],
      },
      options: {
        timeout: 120000,
        response: { response: { responseFormat: 'file' } },
      },
    },
  },
  output: [{}],
});

const deposerWord = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Déposer Word',
    position: [4500, 300],
    executeOnce: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $("Config").item.json.cockpit_url }}/api/reports/upload?chantier={{ encodeURIComponent($("Exécution").item.json.nom) }}&periode={{ $("Préparer rapport").item.json.periode }}&type=docx'),
      sendBody: true,
      contentType: 'binaryData',
      inputDataFieldName: 'data',
      options: { timeout: 120000 },
    },
  },
  output: [{ ok: true, url: '/reports/x.docx' }],
});

const journalFin = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Journaliser fin',
    position: [4720, 300],
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: '9HVj9380Vw6DulOr', cachedResultName: 'dz_runs' },
      matchType: 'allConditions',
      filters: {
        conditions: [
          { keyName: 'id', condition: 'eq', keyValue: expr('{{ $("Journaliser début").first().json.id }}') },
        ],
      },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          statut: 'succès',
          etape: 'terminé',
          message: '',
          pdf_url: expr('{{ $("Config").item.json.pdfshift_actif ? $("Config").item.json.cockpit_url + "/reports/" + $("Préparer rapport").item.json.base + ".pdf" : "" }}'),
          docx_url: expr('{{ $("Config").item.json.cockpit_url + "/reports/" + $("Préparer rapport").item.json.base + ".docx" }}'),
          termine_le: expr('{{ $now.toISO() }}'),
          stats: expr('{{ $("Fusionner sources").first().json.stats }}'),
        },
        schema: [
          { id: 'statut', displayName: 'statut', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'etape', displayName: 'etape', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'message', displayName: 'message', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'pdf_url', displayName: 'pdf_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'docx_url', displayName: 'docx_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'termine_le', displayName: 'termine_le', required: false, defaultMatch: false, display: true, type: 'date', canBeUsedToMatch: true },
          { id: 'stats', displayName: 'stats', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
      },
    },
  },
  output: [{ id: 1 }],
});

const noteCreds = sticky(
  '## Sources externes\n\n**À faire une seule fois :**\n1. Credential **Traxxeo API** (OAuth2 générique, Client Credentials, token URL `https://ords.traxxeo.com/oauth/token`, authentification = header/Basic) → sélectionner sur les nœuds Traxxeo, puis passer `traxxeo_actif` à true dans Config. ⚠️ Attendre la signature de l\'offre Traxxeo.\n2. Credential **Microsoft Graph DZ** (OAuth2 générique, Client Credentials, token URL `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token`, scope `https://graph.microsoft.com/.default`) → nœuds Teams, puis `graph_actif` à true.\n3. Credential **PDFShift** (Basic Auth : user `api`, mot de passe = clé API) → nœud Convertir en PDF, puis `pdfshift_actif` à true.\n\nLes champs Traxxeo (nom du champ WBS/date) sont gérés de façon défensive dans « Mapper activité Traxxeo » — à recaler sur le POC si besoin.',
  [lireTraxxeo, mapperTraxxeo],
);

const noteFlux = sticky(
  '## DZ — Générer rapport chantier\n\nSous-workflow appelé par « DZ — Rapport hebdo » (1 exécution = 1 chantier × 1 semaine).\n\nPipeline : Traxxeo → Teams RT → Teams BLL → Fusionner sources → Préparer rapport (HTML) → dépôt aperçu → PDF (PDFShift) → Word (cockpit) → journal `dz_runs`.\n\nLe mode **démo** injecte des données d\'exemple dans « Fusionner sources » sans appeler les sources.',
  [execution, config],
);

export default workflow('dz-generer-rapport', 'DZ — Générer rapport chantier')
  .add(noteFlux)
  .add(noteCreds)
  .add(execution)
  .to(config)
  .to(journalDebut)
  .to(traxxeoActif
    .onTrue(lireTraxxeo.to(mapperTraxxeo.to(rtActif)))
    .onFalse(rtActif))
  .add(rtActif
    .onTrue(lireRT.to(extraireRT.to(telechargerRT.to(assemblerRT.to(bllActif)))))
    .onFalse(bllActif))
  .add(bllActif
    .onTrue(lireBLL.to(extraireBLL.to(telechargerBLL.to(assemblerBLL.to(fusionner)))))
    .onFalse(fusionner))
  .add(fusionner)
  .to(preparer)
  .to(deposerHTML)
  .to(pdfActif
    .onTrue(convertirPDF.to(deposerPDF.to(convertirWord)))
    .onFalse(convertirWord))
  .add(convertirWord)
  .to(deposerWord)
  .to(journalFin);
