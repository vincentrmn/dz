/* Page Configuration — carnet de destinataires */

const $ = (s, el) => (el || document).querySelector(s);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), 3200);
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

async function chargerContacts() {
  const zone = $('#liste-contacts');
  try {
    const contacts = (await api('GET', '/api/contacts')).contacts || [];
    if (!contacts.length) {
      zone.innerHTML = '<div class="vide">Aucun destinataire pour l’instant. Ajoutez les personnes qui recevront les rapports.</div>';
      return;
    }
    const tbl = document.createElement('table');
    tbl.innerHTML = '<thead><tr><th>Nom</th><th>Email</th><th></th></tr></thead>';
    const tb = document.createElement('tbody');
    contacts.forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td></td><td class="detail"></td><td style="text-align:right;"><button class="discret" title="Retirer du carnet">✕ Retirer</button></td>';
      tr.children[0].textContent = c.nom;
      tr.children[1].textContent = c.email;
      $('button', tr).onclick = async () => {
        if (!confirm(`Retirer ${c.nom} (${c.email}) du carnet ?`)) return;
        try {
          await api('POST', '/api/contacts', { id: c.id, supprimer: true });
          toast('Contact retiré. Pensez à vérifier les chantiers qui l’utilisaient.');
          chargerContacts();
        } catch (e) { toast(`Échec : ${e.message}`); }
      };
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    zone.innerHTML = '';
    zone.appendChild(tbl);
  } catch (e) {
    zone.innerHTML = `<div class="vide">Carnet injoignable (${e.message}).</div>`;
  }
}

$('#btn-ajouter-contact').onclick = async () => {
  const nom = $('#c-nom').value.trim();
  const email = $('#c-email').value.trim();
  if (!email) { toast('Renseignez une adresse email.'); return; }
  try {
    await api('POST', '/api/contacts', { nom, email });
    $('#c-nom').value = '';
    $('#c-email').value = '';
    toast('Contact ajouté.');
    chargerContacts();
  } catch (e) { toast(`Échec : ${e.message}`); }
};

/* Réglage du run hebdomadaire */
const selHeure = $('#r-heure');
for (let h = 0; h < 24; h++) {
  const o = document.createElement('option');
  o.value = h;
  o.textContent = String(h).padStart(2, '0') + ':00';
  selHeure.appendChild(o);
}

async function chargerReglages() {
  try {
    const r = (await api('GET', '/api/reglages')).reglages || {};
    const run = r.run_hebdo || { jour: 3, heure: 7 };
    $('#r-jour').value = String(run.jour);
    $('#r-heure').value = String(run.heure);
  } catch { /* valeurs par défaut du HTML */ }
}

$('#btn-reglage').onclick = async () => {
  try {
    await api('POST', '/api/reglages', { jour: Number($('#r-jour').value), heure: Number($('#r-heure').value) });
    toast('Créneau du run hebdomadaire enregistré.');
  } catch (e) { toast(`Échec : ${e.message}`); }
};

chargerReglages();
chargerContacts();
