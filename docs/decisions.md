# Décisions tranchées

Une ligne par arbitrage, daté, avec la raison en quelques mots. Le récit est
dans `docs/journal/`. On n'y revient pas sans une raison nouvelle.

- **24/11** Lot 1 des rapports du jour livré avant le lot 2, malgré le conseil de la veille d'attendre le générateur : le plan veut le lot 1 en ligne d'abord (les rapports du jour des tests du lot 2 arrivent rangés sous leur semaine) et le guide n'annonce les rapports du jour que quelques heures trop tôt.
- **21/09** Gaichel devient trois fiches chantier ordinaires (22.06A, 22.06B, 22.06C), pas de notion de sections : le cockpit gère déjà tout (rapport, fichiers, email, cron) par chantier.
- **21/09** La fiche `22.06-Gaichel-Maisons` est désactivée et conservée, rapports et historique dz_runs intacts : la consigne « chantier pilote, ne pas changer » du CLAUDE.md devient caduque.
- **21/09** Convention de nommage : lettre collée au code (`22.06A`) dans Teams et Traxxeo ; l'outil tolère l'espace (`22.06 A` = `22.06A` après normalisation, égalité stricte, jamais de préfixe) pour ne pas vider le chapitre 1 en silence pendant la transition.
- **21/09** Nom des trois nouvelles fiches = celui produit par la découverte (`22.06A Gaichel-Maisons`), comme pour les autres chantiers.
- **21/09** Trois mails Gaichel le mercredi acceptés : la règle du 30/07 « 1 mail = 1 chantier » ne change pas.
- **21/09** A et C sont activées sans conversations Teams plutôt que d'attendre : chapitre 1 seul en attendant l'ajout du compte assembleur, plutôt qu'un rapport agrégé qui perdrait les heures de C.
- **21/09** Workflow korr installé dans dz (agents, skills, portiques, CI, mémoire rangée) : la méthode commune s'applique désormais ici, `/construire` exécute les plans.
- **21/09** `npm run check` = syntaxe (`node --check` via `scripts/syntaxe.sh`) + `eslint` (règles recommandées, quatre nuances de style désactivées pour ne pas retoucher le code existant éprouvé en prod : catch vides, erreurs attrapées non lues, échappements superflus, réaffectations inutiles) + `node --test tests/*.test.js` : le projet n'a pas de TypeScript, le check reste honnête et rapide.
- **21/09** L'ancien `CLAUDE.md` (321 lignes) est rangé verbatim dans `docs/contexte/` et `docs/journal/2026-09-02-etat-avant-workflow-korr.md`, vérifié ligne à ligne ; le nouveau fait 121 lignes.
- **25/09** Chaque run note « email envoyé à … » ou « email NON envoyé : <raison> » ; un envoi demandé (cron ou « Générer et envoyer ») qui ne part pas passe le run en « Succès partiel » : un « Succès » ne doit plus pouvoir cacher un mail non parti.
- **25/09** Tout chantier reçoit `dzconstruct@dzconstruct.lu` par défaut (fiches vides remplies, découverte, bouton « Ajouter un chantier ») ; la règle du 30/07 « 1 mail = 1 chantier » ne change pas.
- **25/09** 26.07 MaisonFluhe : envoi mail rallumé (`mail_actif` repassé à true), coupé par erreur.
- **25/09** Écartés par Vincent : alerte rouge sur la carte chantier sans adresse, récapitulatif envoyé à Vincent, Vincent en copie cachée des mails.
- **23/11** Rapports du jour : en plus du rapport de la semaine, qui reste inchangé, un rapport par jour et par chantier, tiré de la même extraction dans le même run (boucle `Lot documents` du générateur). PDF et Word. Lundi à vendredi toujours, même vides ; samedi et dimanche seulement s'il y a eu de l'activité. Page de garde « Rapport technique journalier ».
- **23/11** Un seul mail par chantier, qui contient la semaine et les rapports du jour : la règle du 30/07 « 1 mail = 1 chantier » ne change pas. Tout est joint si le total, mesuré une fois encodé, tient sous 3 Mo ; sinon le mail ne contient que des liens et le dit.
- **23/11** Génération manuelle : rapports du jour seulement si la période fait 7 jours ou moins ; les archives mensuelles restent un seul rapport.
- **23/11** Pas d'interrupteur : mise en service directe pour le cron du mercredi 25/11, parce que DZ utilise déjà la plateforme. Retour arrière : republier la version `e8bc88ae-bdf7-48ea-a068-a4d106f4ef8d` du générateur.
- **23/11** Vérification sans mail de test : par la page Rapports, la page Debug, puis par la confirmation de Fares ou Francis après le cron.
- **23/11** En-tête du Hub : sous 1 080 px, il passe à la ligne et n'est plus collant (165 px sur trois lignes à 390 px), parce que le menu de 840 px (jusqu'à ~1 060 px connecté) faisait déborder toutes les pages et que le critère « sans scroll horizontal » des rapports du jour l'exige. Les tableaux préexistants qui débordent à 390 px restent hors périmètre.
