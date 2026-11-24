/* Page Rapports — regroupement par chantier puis par période */

const $ = (s, el) => (el || document).querySelector(s);

function octets(n) {
  if (n > 1048576) return (n / 1048576).toFixed(1) + ' Mo';
  if (n > 1024) return Math.round(n / 1024) + ' Ko';
  return n + ' o';
}

// Rapport d'un jour (période `<jour>_<jour>`) : « mardi 17/11/2026 ».
function jourLisible(p) {
  const m = String(p).match(/^(\d{4})-(\d{2})-(\d{2})_\1-\2-\3$/);
  if (!m) return null;
  const nom = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
  return `${nom} ${m[3]}/${m[2]}/${m[1]}`;
}

function periodeLisible(p) {
  const jour = jourLisible(p);
  if (jour) return jour;
  const m = String(p).match(/^(\d{4})-(\d{2})-(\d{2})_(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return p;
  return `du ${m[3]}/${m[2]}/${m[1]} au ${m[6]}/${m[5]}/${m[4]}`;
}

function liensRapport(formats) {
  return formats
    .sort((a, b) => a.type.localeCompare(b.type))
    .map((f) => `<a href="${f.url}" ${f.type === 'html' ? 'target="_blank" rel="noopener"' : ''} title="${octets(f.taille)}">${f.type === 'html' ? 'Aperçu' : f.type.toUpperCase()}</a>`)
    .join('');
}

// Sous une semaine : un repli « N rapports du jour », une ligne par jour.
function ligneJours(jours) {
  const tr = document.createElement('tr');
  tr.className = 'jours-semaine';
  const n = jours.length;
  tr.innerHTML = `<td colspan="3"><details class="repli repli-jours">
      <summary>${n} rapport${n > 1 ? 's' : ''} du jour</summary>
      <ul class="liste-jours">${jours.map((j) => `<li><span class="nom-jour" title="Généré le ${new Date(j.modifie).toLocaleString('fr-FR')}">${jourLisible(j.periode)}</span>
        <div class="liens-rapport">${liensRapport(j.formats)}</div></li>`).join('')}</ul>
    </details></td>`;
  return tr;
}

let tous = [];

function afficher() {
  const filtre = $('#filtre-chantier').value;
  const zone = $('#contenu');
  const fichiers = filtre ? tous.filter((f) => f.chantier === filtre) : tous;

  if (!fichiers.length) {
    zone.innerHTML = '<div class="vide">Aucun rapport. Lancez une génération depuis la page Chantiers.</div>';
    $('#compteur').textContent = '';
    return;
  }

  const parChantier = {};
  fichiers.forEach((f) => {
    const c = (parChantier[f.chantier] = parChantier[f.chantier] || {});
    const p = (c[f.periode] = c[f.periode] || { periode: f.periode, semaine: f.semaine, modifie: f.modifie, formats: [] });
    p.formats.push(f);
    if (f.modifie > p.modifie) p.modifie = f.modifie;
  });

  // Un rapport du jour rattaché à sa semaine (champ `semaine` de /api/reports) se
  // range sous elle ; un jour sans semaine garde sa propre ligne.
  let nbLignes = 0;

  zone.innerHTML = '';
  Object.keys(parChantier).sort().forEach((chantier) => {
    const h = document.createElement('h2');
    h.textContent = chantier;
    zone.appendChild(h);

    const tbl = document.createElement('table');
    tbl.innerHTML = '<thead><tr><th>Semaine</th><th>Généré le</th><th>Documents</th></tr></thead>';
    const tb = document.createElement('tbody');
    const toutes = Object.values(parChantier[chantier]);
    const periodes = toutes.filter((p) => !p.semaine).sort((a, b) => (a.periode < b.periode ? 1 : -1));
    periodes.forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${periodeLisible(p.periode)}</td>
        <td class="detail">${new Date(p.modifie).toLocaleString('fr-FR')}</td>
        <td><div class="liens-rapport">${liensRapport(p.formats)}</div></td>`;
      tb.appendChild(tr);
      const jours = toutes.filter((j) => j.semaine === p.periode).sort((a, b) => (a.periode < b.periode ? -1 : 1));
      if (jours.length) {
        tr.className = 'avec-jours';
        tb.appendChild(ligneJours(jours));
      }
    });
    nbLignes += periodes.length;
    tbl.appendChild(tb);
    zone.appendChild(tbl);
  });

  $('#compteur').textContent = `${nbLignes} rapport(s)`;
}

async function charger() {
  try {
    const r = await fetch('/api/reports');
    tous = await r.json();
    const chantiers = [...new Set(tous.map((f) => f.chantier))].sort();
    const sel = $('#filtre-chantier');
    chantiers.forEach((c) => {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      sel.appendChild(o);
    });
    afficher();
  } catch (e) {
    $('#contenu').innerHTML = `<div class="vide">Impossible de charger les rapports (${e.message}).</div>`;
  }
}

$('#filtre-chantier').onchange = afficher;
charger();
