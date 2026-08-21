/*
 * Ajoute « connecté en tant que … · Déconnexion » dans l'en-tête, une fois
 * l'authentification Microsoft allumée. Tant qu'elle est éteinte, /auth/moi
 * répond { actif: false } et rien ne s'affiche.
 */
fetch('/auth/moi')
  .then((r) => (r.ok ? r.json() : null))
  .then((u) => {
    if (!u || !u.actif || !u.email) return;
    const entete = document.querySelector('header');
    if (!entete) return;
    const bloc = document.createElement('div');
    bloc.className = 'compte';
    const qui = document.createElement('span');
    qui.className = 'compte-nom';
    qui.textContent = u.nom || u.email;
    qui.title = u.email;
    const sortie = document.createElement('a');
    sortie.href = '/auth/logout';
    sortie.textContent = 'Déconnexion';
    bloc.append(qui, sortie);
    entete.appendChild(bloc);
  })
  .catch(() => {
    /* pas de bandeau si l'appel échoue : ce n'est qu'un confort */
  });
