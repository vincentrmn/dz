/* Cockpit — logique du dashboard */

const $ = (s, el) => (el || document).querySelector(s);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 3200);
}

/* --- Sélecteur de période : mode Semaine (lundi -> dimanche) ou Période libre --- */

const iso = (dt) => dt.toISOString().substring(0, 10);

/* Lundi de la semaine contenant la date donnée */
function lundiDe(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

let modeSemaine = true;
let lundiCourant = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return lundiDe(d);
})();

function numeroSemaineISO(lundi) {
  const jeudi = new Date(lundi);
  jeudi.setUTCDate(lundi.getUTCDate() + 3);
  const j4 = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 4));
  const lundiS1 = new Date(j4);
  lundiS1.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() + 6) % 7));
  return 1 + Math.round((lundi - lundiS1) / (7 * 86400000));
}

function rendreSemaine() {
  const dimanche = new Date(lundiCourant);
  dimanche.setUTCDate(lundiCourant.getUTCDate() + 6);
  const memeMois = lundiCourant.getUTCMonth() === dimanche.getUTCMonth();
  const debutTxt = memeMois
    ? String(lundiCourant.getUTCDate())
    : lundiCourant.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const finTxt = dimanche.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  $('#sem-label').innerHTML = `<b>Semaine ${numeroSemaineISO(lundiCourant)}</b> · ${debutTxt} → ${finTxt}`;
  if (!$('#calendrier').hidden) rendreCalendrier();
}

/* --- Calendrier : choisir un jour = choisir sa semaine (lundi → dimanche) --- */

let moisAffiche = new Date(Date.UTC(lundiCourant.getUTCFullYear(), lundiCourant.getUTCMonth(), 1));

function rendreCalendrier() {
  $('#cal-mois').textContent = moisAffiche.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const grille = $('#cal-grille');
  grille.innerHTML = '';
  ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach((j) => {
    const e = document.createElement('div');
    e.className = 'cal-jour-nom';
    e.textContent = j;
    grille.appendChild(e);
  });
  const debut = new Date(moisAffiche);
  debut.setUTCDate(1 - ((debut.getUTCDay() + 6) % 7));
  for (let i = 0; i < 42; i++) {
    const d = new Date(debut);
    d.setUTCDate(debut.getUTCDate() + i);
    const lundiJ = new Date(d);
    lundiJ.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-jour'
      + (d.getUTCMonth() !== moisAffiche.getUTCMonth() ? ' hors-mois' : '')
      + (iso(lundiJ) === iso(lundiCourant) ? ' sem-on' : '');
    cell.dataset.lundi = iso(lundiJ);
    cell.textContent = d.getUTCDate();
    cell.onmouseenter = () => {
      grille.querySelectorAll('.cal-jour').forEach((x) => x.classList.toggle('sem-hover', x.dataset.lundi === cell.dataset.lundi));
    };
    cell.onclick = () => {
      lundiCourant = lundiJ;
      rendreSemaine();
      $('#calendrier').hidden = true;
    };
    grille.appendChild(cell);
  }
  grille.onmouseleave = () => grille.querySelectorAll('.sem-hover').forEach((x) => x.classList.remove('sem-hover'));
}

$('#sem-btn').onclick = () => {
  const cal = $('#calendrier');
  if (cal.hidden) {
    moisAffiche = new Date(Date.UTC(lundiCourant.getUTCFullYear(), lundiCourant.getUTCMonth(), 1));
    rendreCalendrier();
  }
  cal.hidden = !cal.hidden;
};
$('#cal-prec').onclick = () => { moisAffiche.setUTCMonth(moisAffiche.getUTCMonth() - 1); rendreCalendrier(); };
$('#cal-suiv').onclick = () => { moisAffiche.setUTCMonth(moisAffiche.getUTCMonth() + 1); rendreCalendrier(); };
document.addEventListener('click', (ev) => {
  if (!$('#zone-semaine').contains(ev.target)) $('#calendrier').hidden = true;
});

function periodeChoisie() {
  if (modeSemaine) {
    const dimanche = new Date(lundiCourant);
    dimanche.setUTCDate(lundiCourant.getUTCDate() + 6);
    return { debut: iso(lundiCourant), fin: iso(dimanche) };
  }
  const debut = $('#d-debut').value;
  const fin = $('#d-fin').value || debut;
  if (!debut) return null;
  return debut <= fin ? { debut, fin } : { debut: fin, fin: debut };
}

$('#mode-semaine').onclick = () => {
  modeSemaine = true;
  $('#mode-semaine').classList.add('actif');
  $('#mode-libre').classList.remove('actif');
  $('#zone-semaine').style.display = '';
  $('#zone-libre').style.display = 'none';
};
$('#mode-libre').onclick = () => {
  modeSemaine = false;
  $('#mode-libre').classList.add('actif');
  $('#mode-semaine').classList.remove('actif');
  $('#zone-semaine').style.display = 'none';
  $('#zone-libre').style.display = '';
};
$('#sem-prec').onclick = () => { lundiCourant.setUTCDate(lundiCourant.getUTCDate() - 7); rendreSemaine(); };
$('#sem-suiv').onclick = () => { lundiCourant.setUTCDate(lundiCourant.getUTCDate() + 7); rendreSemaine(); };

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

let contacts = [];

function carteChantier(c) {
  const div = document.createElement('div');
  div.className = 'carte';
  const selection = new Set(String(c.emails || '').split(';').map((e) => e.trim()).filter(Boolean));
  div.innerHTML = `
    <div class="chantier-tete">
      <label class="interrupteur" title="Actif : inclus dans le run hebdomadaire">
        <input type="checkbox" ${c.actif ? 'checked' : ''} data-role="actif">
        <span class="piste"></span>
      </label>
      <span class="chantier-nom"></span>
      <span class="badge ${c.actif ? 'on' : 'off'}" data-role="badge-actif">${c.actif ? 'actif' : 'inactif'}</span>
      ${c.source === 'cockpit' ? '<span class="badge type">ajouté manuellement</span>' : ''}
      <div class="chantier-actions">
        <button data-role="generer" class="principal">Générer le rapport</button>
      </div>
    </div>

    <div class="bloc-mail">
      <label class="interrupteur mini" title="Envoyer le rapport par email aux destinataires cochés">
        <input type="checkbox" ${c.mail_actif ? 'checked' : ''} data-role="mail">
        <span class="piste"></span>
      </label>
      <span class="lib-mail">Envoyer par email</span>
      <div class="destinataires" data-role="destinataires" style="${c.mail_actif ? '' : 'display:none'}"></div>
    </div>

    <details class="repli">
      <summary>Configuration des sources</summary>
      <div class="grille">
        <div class="champ"><label>Codes WBS Traxxeo</label><input data-role="wbs" placeholder="À compléter — codes du chantier dans Traxxeo"></div>
        <div class="champ"><label>ID conversation Teams — BL&L</label><input data-role="bll" placeholder="Aucune conversation détectée — lancez un scan"></div>
        <div class="champ"><label>ID conversation Teams — RT</label><input data-role="rt" placeholder="Aucune conversation détectée — lancez un scan"></div>
      </div>
      <div class="pied-carte">
        <span class="detail" style="color: var(--gris); font-size: 12.5px;">Le scan automatique préremplit les IDs de conversations Teams.</span>
        <button data-role="enregistrer">Enregistrer les modifications</button>
      </div>
      <div class="zone-danger">
        <div class="zd-ligne">
          <div>
            <div class="zd-titre">Zone de danger</div>
            <div class="zd-texte">Supprime ce chantier de la configuration : il ne sera plus généré. Les rapports déjà générés restent disponibles dans la page Rapports.</div>
          </div>
          <button data-role="supprimer" class="danger">Supprimer ce chantier</button>
        </div>
        <div class="zd-confirm" data-role="zd-confirm" style="display:none">
          <span>Pour confirmer, tapez le nom exact du chantier :</span>
          <input data-role="zd-nom">
          <button data-role="zd-valider" class="danger" disabled>Supprimer définitivement</button>
          <button data-role="zd-annuler" class="discret">Annuler</button>
        </div>
      </div>
    </details>`;
  $('.chantier-nom', div).textContent = c.nom;
  $('[data-role=wbs]', div).value = c.wbs || '';
  $('[data-role=bll]', div).value = c.conversation_bll || '';
  $('[data-role=rt]', div).value = c.conversation_rt || '';

  const sauvegarder = async (rechargement) => {
    try {
      await api('POST', '/api/chantiers', {
        id: c.id,
        nom: c.nom,
        wbs: $('[data-role=wbs]', div).value.trim(),
        conversation_bll: $('[data-role=bll]', div).value.trim(),
        conversation_rt: $('[data-role=rt]', div).value.trim(),
        emails: [...selection].join(';'),
        mail_actif: $('[data-role=mail]', div).checked,
        actif: $('[data-role=actif]', div).checked,
      });
      toast('Chantier enregistré');
      if (rechargement) chargerChantiers();
    } catch (e) { toast(`Échec : ${e.message}`); }
  };

  function rendreDestinataires() {
    const zone = $('[data-role=destinataires]', div);
    zone.innerHTML = '';
    const connus = new Set(contacts.map((k) => k.email));
    const affiches = [
      ...contacts.map((k) => ({ nom: k.nom, email: k.email })),
      ...[...selection].filter((e) => !connus.has(e)).map((e) => ({ nom: e, email: e })),
    ];
    affiches.forEach((p) => {
      const actif = selection.has(p.email);
      const chip = document.createElement('label');
      chip.className = 'chip' + (actif ? ' chip-on' : '');
      chip.title = p.email;
      chip.innerHTML = `<input type="checkbox" ${actif ? 'checked' : ''}><span></span>`;
      $('span', chip).textContent = p.nom;
      $('input', chip).onchange = (ev) => {
        if (ev.target.checked) selection.add(p.email); else selection.delete(p.email);
        chip.classList.toggle('chip-on', ev.target.checked);
        sauvegarder(false);
      };
      zone.appendChild(chip);
    });
    const lien = document.createElement('a');
    lien.href = '/configuration';
    lien.className = 'chip chip-lien';
    lien.textContent = contacts.length ? '+ Gérer les destinataires' : '+ Ajouter des destinataires';
    zone.appendChild(lien);
  }
  rendreDestinataires();

  $('[data-role=enregistrer]', div).onclick = () => sauvegarder(true);
  $('[data-role=actif]', div).onchange = (ev) => {
    const badge = $('[data-role=badge-actif]', div);
    badge.classList.toggle('on', ev.target.checked);
    badge.classList.toggle('off', !ev.target.checked);
    badge.textContent = ev.target.checked ? 'actif' : 'inactif';
    sauvegarder(false);
  };
  $('[data-role=mail]', div).onchange = (ev) => {
    $('[data-role=destinataires]', div).style.display = ev.target.checked ? '' : 'none';
    if (ev.target.checked && !contacts.length && !selection.size) {
      toast('Ajoutez d’abord des destinataires dans la page Configuration.');
    }
    sauvegarder(false);
  };

  /* Zone de danger : suppression avec revalidation par saisie du nom */
  const zdConfirm = $('[data-role=zd-confirm]', div);
  const zdNom = $('[data-role=zd-nom]', div);
  zdNom.placeholder = c.nom;
  $('[data-role=supprimer]', div).onclick = () => {
    zdConfirm.style.display = '';
    $('[data-role=supprimer]', div).style.display = 'none';
    zdNom.focus();
  };
  $('[data-role=zd-annuler]', div).onclick = () => {
    zdConfirm.style.display = 'none';
    $('[data-role=supprimer]', div).style.display = '';
    zdNom.value = '';
    $('[data-role=zd-valider]', div).disabled = true;
  };
  zdNom.oninput = () => {
    $('[data-role=zd-valider]', div).disabled = zdNom.value.trim() !== c.nom;
  };
  $('[data-role=zd-valider]', div).onclick = async () => {
    try {
      await api('POST', '/api/chantiers', { id: c.id, supprimer: true });
      toast(`Chantier « ${c.nom} » supprimé. Ses rapports restent dans la page Rapports.`);
      chargerChantiers();
    } catch (e) { toast(`Échec : ${e.message}`); }
  };

  $('[data-role=generer]', div).onclick = async () => {
    const periode = periodeChoisie();
    if (!periode) { toast('Choisissez d’abord une période (au moins la date de début).'); return; }
    const { debut, fin } = periode;
    try {
      await api('POST', '/api/generer', {
        chantier: c.nom,
        date_debut: debut,
        date_fin: fin,
        declenchement: 'manuel',
      });
      toast(`Génération lancée (${debut} → ${fin}) — suivi sur la page Debug`);
      setTimeout(chargerRapports, 8000);
    } catch (e) { toast(`Échec : ${e.message}`); }
  };

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
    await api('POST', '/api/chantiers', { nom: nom.trim(), wbs: '', conversation_bll: '', conversation_rt: '', emails: '', actif: false });
    toast('Chantier ajouté (inactif). Complétez WBS et conversations puis activez-le.');
    chargerChantiers();
  } catch (e) { toast(`Échec : ${e.message}`); }
};

$('#btn-decouverte').onclick = async () => {
  try {
    await api('POST', '/api/decouverte', { declenchement: 'manuel' });
    toast('Scan lancé. Les nouveaux chantiers apparaîtront en inactif.');
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

async function chargerContactsGlobaux() {
  try {
    contacts = (await api('GET', '/api/contacts')).contacts || [];
  } catch { contacts = []; }
}

rendreSemaine();
bandeauSante();
chargerContactsGlobaux().then(chargerChantiers);
chargerRapports();
