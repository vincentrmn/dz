/* Page debug — santé + journal des runs (table dz_runs via n8n) */

const $ = (s, el) => (el || document).querySelector(s);

async function api(chemin) {
  const r = await fetch(chemin);
  if (!r.ok) throw new Error(`erreur ${r.status}`);
  return r.json();
}

function tuile(libelle, valeur, ok) {
  return `<div class="carte"><div class="libelle">${libelle}</div>
    <div class="valeur ${ok === true ? 'ok' : ok === false ? 'err' : ''}">${valeur}</div></div>`;
}

async function chargerSante() {
  const zone = $('#sante');
  try {
    const s = await api('/api/health');
    zone.innerHTML =
      tuile('Cockpit', 'en ligne', true) +
      tuile('n8n', s.n8n, s.n8n === 'ok') +
      tuile('Stockage rapports', s.stockage === 'ok' ? `${s.rapports} fichier(s)` : 'absent', s.stockage === 'ok') +
      tuile('Version', s.version);
  } catch (e) {
    zone.innerHTML = tuile('Cockpit', 'injoignable', false);
  }
}

function badgeStatut(s) {
  const cls = /succ/i.test(s) ? 'succes' : /erreur|échec|echec/i.test(s) ? 'erreur' : 'encours';
  return `<span class="badge ${cls}">${s || '—'}</span>`;
}

async function chargerJournal() {
  const zone = $('#journal');
  try {
    const data = await api('/api/runs');
    const runs = Array.isArray(data) ? data : (data.runs || []);
    if (!runs.length) {
      zone.innerHTML = '<div class="vide">Aucune exécution enregistrée pour l’instant.</div>';
      return;
    }
    const tbl = document.createElement('table');
    tbl.innerHTML = '<thead><tr><th>Démarré</th><th>Chantier</th><th>Période</th><th>Statut</th><th>Étape</th><th>Détails</th></tr></thead>';
    const tb = document.createElement('tbody');
    runs.forEach((r) => {
      const tr = document.createElement('tr');
      const debut = r.demarre_le ? new Date(r.demarre_le).toLocaleString('fr-FR') : '—';
      tr.innerHTML = `
        <td class="detail">${debut}<div class="detail">${r.declenchement || ''}</div></td>
        <td></td>
        <td class="detail">${r.periode_debut || ''} → ${r.periode_fin || ''}</td>
        <td>${badgeStatut(r.statut)}</td>
        <td class="detail">${r.etape || ''}</td>
        <td class="detail"></td>`;
      tr.children[1].textContent = r.chantier || '';
      const det = tr.children[5];
      det.textContent = [r.message, r.stats].filter(Boolean).join(' — ');
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    zone.innerHTML = '';
    zone.appendChild(tbl);
  } catch (e) {
    zone.innerHTML = `<div class="vide">Journal injoignable (${e.message}). Vérifiez que le workflow « DZ — Cockpit API » est publié dans n8n.</div>`;
  }
}

$('#btn-rafraichir').onclick = () => { chargerSante(); chargerJournal(); };
chargerSante();
chargerJournal();
setInterval(() => { chargerSante(); chargerJournal(); }, 15000);
