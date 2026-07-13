/* Page Rapports — regroupement par chantier puis par période */

const $ = (s, el) => (el || document).querySelector(s);

function octets(n) {
  if (n > 1048576) return (n / 1048576).toFixed(1) + ' Mo';
  if (n > 1024) return Math.round(n / 1024) + ' Ko';
  return n + ' o';
}

function periodeLisible(p) {
  const m = String(p).match(/^(\d{4})-(\d{2})-(\d{2})_(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return p;
  return `du ${m[3]}/${m[2]}/${m[1]} au ${m[6]}/${m[5]}/${m[4]}`;
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
    const p = (c[f.periode] = c[f.periode] || { modifie: f.modifie, formats: [] });
    p.formats.push(f);
    if (f.modifie > p.modifie) p.modifie = f.modifie;
  });

  zone.innerHTML = '';
  Object.keys(parChantier).sort().forEach((chantier) => {
    const h = document.createElement('h2');
    h.textContent = chantier;
    zone.appendChild(h);

    const tbl = document.createElement('table');
    tbl.innerHTML = '<thead><tr><th>Semaine</th><th>Généré le</th><th>Documents</th></tr></thead>';
    const tb = document.createElement('tbody');
    const periodes = Object.keys(parChantier[chantier]).sort().reverse();
    periodes.forEach((periode) => {
      const p = parChantier[chantier][periode];
      const tr = document.createElement('tr');
      const liens = p.formats
        .sort((a, b) => a.type.localeCompare(b.type))
        .map((f) => `<a href="${f.url}" ${f.type === 'html' ? 'target="_blank" rel="noopener"' : ''} title="${octets(f.taille)}">${f.type === 'html' ? 'Aperçu' : f.type.toUpperCase()}</a>`)
        .join('');
      tr.innerHTML = `<td>${periodeLisible(periode)}</td>
        <td class="detail">${new Date(p.modifie).toLocaleString('fr-FR')}</td>
        <td><div class="liens-rapport">${liens}</div></td>`;
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    zone.appendChild(tbl);
  });

  const nbSemaines = Object.values(parChantier).reduce((n, c) => n + Object.keys(c).length, 0);
  $('#compteur').textContent = `${nbSemaines} rapport(s)`;
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
