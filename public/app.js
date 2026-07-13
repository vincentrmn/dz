/* Cockpit — logique du dashboard */

const $ = (s, el) => (el || document).querySelector(s);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 3200);
}

/* Semaine précédente (lundi -> dimanche), valeur par défaut du sélecteur */
function semainePrecedente() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const jeudi = new Date(d);
  jeudi.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const an = jeudi.getFullYear();
  const debut = new Date(an, 0, 4);
  const num = 1 + Math.round(((jeudi - debut) / 86400000 - 3 + ((debut.getDay() + 6) % 7)) / 7);
  return `${an}-W${String(num).padStart(2, '0')}`;
}

function bornesSemaine(valeurWeek) {
  const [an, sem] = valeurWeek.split('-W').map(Number);
  const simple = new Date(an, 0, 1 + (sem - 1) * 7);
  const jour = simple.getDay();
  const lundi = new Date(simple);
  lundi.setDate(simple.getDate() - ((jour + 6) % 7) + (jour <= 4 && jour !== 0 ? 0 : 7) - ((jour === 0) ? 7 : 0));
  // Ajustement ISO : se recaler sur le lundi de la semaine ISO
  const iso = (dt) => dt.toISOString().substring(0, 10);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  return { debut: iso(lundi), fin: iso(dimanche) };
}

async function api(methode, chemin, corps) {
  const r = await fetch(chemin, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json()).erreur || ''; } catch {}
    throw new Error(detail || `erreur ${r.status}`);
  }
  return r.json();
}

/* ------------------------------------------------------------------ */
/* Chantiers                                                           */
/* ------------------------------------------------------------------ */

function carteChantier(c) {
  const div = document.createElement('div');
  div.className = 'carte';
  div.innerHTML = `
    <div class="chantier-tete">
      <label class="interrupteur" title="Actif : inclus dans le run hebdomadaire">
        <input type="checkbox" ${c.actif ? 'checked' : ''} data-role="actif">
        <span class="piste"></span>
      </label>
      <span class="chantier-nom"></span>
      <span class="badge ${c.actif ? 'on' : 'off'}">${c.actif ? 'actif' : 'inactif'}</span>
      ${c.source === 'decouverte' ? '<span class="badge type">découvert auto</span>' : ''}
      <div class="chantier-actions">
        <button data-role="generer" class="principal">Générer le rapport</button>
        <button data-role="demo" title="Génère un rapport avec des données d'exemple, sans toucher à Teams ni Traxxeo">Démo</button>
        <button data-role="enregistrer" class="discret">Enregistrer</button>
      </div>
    </div>
    <div class="grille">
      <div class="champ"><label>Codes WBS Traxxeo</label><input data-role="wbs" placeholder="22.06 A;22.06 B"></div>
      <div class="champ"><label>ID conversation Teams — BLL</label><input data-role="bll" placeholder="19:xxxx@thread.v2"></div>
      <div class="champ"><label>ID conversation Teams — RT</label><input data-role="rt" placeholder="19:xxxx@thread.v2"></div>
    </div>`;
  $('.chantier-nom', div).textContent = c.nom;
  $('[data-role=wbs]', div).value = c.wbs || '';
  $('[data-role=bll]', div).value = c.conversation_bll || '';
  $('[data-role=rt]', div).value = c.conversation_rt || '';

  $('[data-role=enregistrer]', div).onclick = async () => {
    try {
      await api('POST', '/api/chantiers', {
        id: c.id,
        nom: c.nom,
        wbs: $('[data-role=wbs]', div).value.trim(),
        conversation_bll: $('[data-role=bll]', div).value.trim(),
        conversation_rt: $('[data-role=rt]', div).value.trim(),
        actif: $('[data-role=actif]', div).checked,
      });
      toast('Chantier enregistré');
      chargerChantiers();
    } catch (e) { toast(`Échec : ${e.message}`); }
  };

  $('[data-role=actif]', div).onchange = () => $('[data-role=enregistrer]', div).click();

  const lancer = async (demo) => {
    const semaine = $('#semaine').value || semainePrecedente();
    const { debut, fin } = bornesSemaine(semaine);
    try {
      await api('POST', '/api/generer', {
        chantier: c.nom,
        date_debut: debut,
        date_fin: fin,
        demo: !!demo,
        declenchement: demo ? 'démo' : 'manuel',
      });
      toast(`Génération lancée (${debut} → ${fin}) — suivi sur la page Debug`);
      setTimeout(chargerRapports, 8000);
    } catch (e) { toast(`Échec : ${e.message}`); }
  };
  $('[data-role=generer]', div).onclick = () => lancer(false);
  $('[data-role=demo]', div).onclick = () => lancer(true);

  return div;
}

async function chargerChantiers() {
  const zone = $('#chantiers');
  try {
    const data = await api('GET', '/api/chantiers');
    const liste = Array.isArray(data) ? data : (data.chantiers || []);
    zone.innerHTML = '';
    if (!liste.length) {
      zone.innerHTML = '<div class="vide">Aucun chantier configuré. Ajoutez-en un, ou lancez la découverte automatique.</div>';
      return;
    }
    liste.forEach((c) => zone.appendChild(carteChantier(c)));
  } catch (e) {
    zone.innerHTML = `<div class="vide">Configuration injoignable (${e.message}). Vérifiez que le workflow « DZ — Cockpit API » est publié dans n8n.</div>`;
  }
}

/* ------------------------------------------------------------------ */
/* Rapports                                                            */
/* ------------------------------------------------------------------ */

function octets(n) {
  if (n > 1048576) return (n / 1048576).toFixed(1) + ' Mo';
  if (n > 1024) return Math.round(n / 1024) + ' Ko';
  return n + ' o';
}

async function chargerRapports() {
  const zone = $('#liste-rapports');
  try {
    const fichiers = await api('GET', '/api/reports');
    if (!fichiers.length) {
      zone.innerHTML = '<div class="vide">Aucun rapport pour l’instant. Lancez une génération (ou une démo) depuis un chantier.</div>';
      return;
    }
    const parCle = {};
    fichiers.forEach((f) => {
      const cle = `${f.chantier}__${f.periode}`;
      (parCle[cle] = parCle[cle] || { chantier: f.chantier, periode: f.periode, modifie: f.modifie, formats: [] }).formats.push(f);
    });
    const lignes = Object.values(parCle);
    lignes.sort((a, b) => (a.modifie < b.modifie ? 1 : -1));
    const tbl = document.createElement('table');
    tbl.innerHTML = '<thead><tr><th>Chantier</th><th>Période</th><th>Généré le</th><th>Téléchargements</th></tr></thead>';
    const tb = document.createElement('tbody');
    lignes.forEach((l) => {
      const tr = document.createElement('tr');
      const liens = l.formats
        .sort((a, b) => a.type.localeCompare(b.type))
        .map((f) => `<a href="${f.url}" ${f.type === 'html' ? 'target="_blank" rel="noopener"' : ''} title="${octets(f.taille)}">${f.type === 'html' ? 'Aperçu' : f.type.toUpperCase()}</a>`)
        .join('');
      tr.innerHTML = `<td></td><td>${l.periode.replace(/_/g, ' → ')}</td>
        <td class="detail">${new Date(l.modifie).toLocaleString('fr-FR')}</td>
        <td><div class="liens-rapport">${liens}</div></td>`;
      tr.children[0].textContent = l.chantier;
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    zone.innerHTML = '';
    zone.appendChild(tbl);
  } catch (e) {
    zone.innerHTML = `<div class="vide">Impossible de lister les rapports (${e.message}).</div>`;
  }
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

$('#btn-ajouter').onclick = async () => {
  const nom = prompt('Nom du chantier (ex : 22.06-Gaichel-Maisons) :');
  if (!nom) return;
  try {
    await api('POST', '/api/chantiers', { nom: nom.trim(), wbs: '', conversation_bll: '', conversation_rt: '', actif: false });
    toast('Chantier ajouté (inactif). Complétez WBS et conversations puis activez-le.');
    chargerChantiers();
  } catch (e) { toast(`Échec : ${e.message}`); }
};

$('#btn-decouverte').onclick = async () => {
  try {
    await api('POST', '/api/decouverte', { declenchement: 'manuel' });
    toast('Découverte lancée. Les nouveaux chantiers apparaîtront en inactif.');
    setTimeout(chargerChantiers, 10000);
  } catch (e) { toast(`Échec : ${e.message}`); }
};

async function bandeauSante() {
  try {
    const s = await api('GET', '/api/health');
    if (s.n8n !== 'ok') {
      $('#bandeau').innerHTML = `<div class="note"><strong>n8n ${s.n8n}.</strong> La génération et la configuration ne fonctionneront pas tant que l’instance n8n n’est pas joignable.</div>`;
    }
  } catch {}
}

$('#semaine').value = semainePrecedente();
bandeauSante();
chargerChantiers();
chargerRapports();
