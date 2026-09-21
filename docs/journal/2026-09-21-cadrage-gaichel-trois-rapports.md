# Session « cadrage Gaichel en trois rapports » (21/09/2026)

## Ce qui a été décidé
- Gaichel A, B, C = trois fiches chantier ordinaires dans le cockpit, pas de notion de sections : tout (rapport, fichiers, email, cron) marche déjà par chantier.
- La fiche `22.06-Gaichel-Maisons` est désactivée et conservée : rapports passés et historique dz_runs intacts. La consigne « chantier pilote, ne pas changer » du CLAUDE.md est caduque.
- Convention de nommage : lettre collée au code (`22.06A`) dans Teams et Traxxeo ; l'outil tolère l'espace (`22.06 A` égale `22.06A`), normalisation dans le filtre Traxxeo et dans la découverte, égalité stricte après normalisation, jamais de correspondance par préfixe : rigueur demandée par Francis, tolérance pour ne jamais vider le chapitre 1 en silence pendant la transition.
- Nom des nouvelles fiches = celui que produit la découverte (`22.06A Gaichel-Maisons`), comme les autres chantiers découverts.
- Trois mails Gaichel le mercredi acceptés (1 mail = 1 chantier, décision du 30/07 inchangée).
- Communication à Francis préparée par Claude en fin de lot 2, envoyée par Vincent.

## Ce qui a été fait
- Lecture de CLAUDE.md, `docs/BIBLE.md`, `public/guide.html`, le cockpit et la copie de référence du générateur (`n8n/dz-generer-rapport.workflow.mjs`).
- Deux salves de questions à Vincent pour cadrer le besoin de Francis (trois parties Gaichel, six conversations Teams déjà créées, trois projets Traxxeo).
- Projet de plan rédigé par l'architecte, puis plan final écrit et validé par Vincent : `docs/plans/gaichel-trois-rapports.md`.
- Commit sur la branche `claude/gaichel-reports-by-section-oikbe1`.

## Ce qui a été vérifié (et comment)
- `curl` sur le webhook public `dz/api/chantiers` de n8n le 21/09 : une seule fiche Gaichel active (id 1, wbs `22.06 A;22.06 B`) ; une fiche `22.06A` (id 19, vide, source cockpit) déjà en soft-delete ; aucune fiche A/B/C créée par le scan du lundi ; 8 chantiers actifs (le CLAUDE.md en indique 4, chiffre daté du 25/08).
- `curl` sur `/api/health` du cockpit : 200. `curl` sur `/api/chantiers` sans jeton : 401 (garde d'authentification active).
- Lecture de la copie du générateur : le filtre WBS est une égalité stricte après `trim()`, aucune lecture d'un « 5e caractère » ou logique positionnelle qui casserait avec une lettre collée.

## Ce qui n'a pas pu être vérifié
- Le MCP n8n n'était pas disponible dans cette session : le workflow de découverte (`49okCW9O85lYsP3r`) n'a pas été lu en direct. On ne sait donc pas s'il rabat `22.06A` sur `22.06` (hypothèse plausible : il ne remplit que les IDs de conversation manquants, et la fiche 1 a déjà les siens, donc un rabattement serait resté invisible dans les faits constatés) ni ce qu'il fait d'une fiche existante soft-deletée de même nom (id 19). C'est le premier travail de `/construire`, lot 1.
- Le nœud vivant `Mapper activité Traxxeo` du générateur (`qZG6Q5LnQSrloeXR`) n'a pas non plus été relu en direct (seule la copie datée du dépôt a servi de base au plan).

## Leçons durables (reportées dans les règles ou les skills)
- Aucune leçon de code à écrire dans `.claude/rules/` pour cette session (aucune règle n'existe encore sur ce projet ; rien ici ne relève d'un piège de code vérifié).
- Signalé pour `korr-workflow` (pas écrit ici) : `/cadrer` a été lancé sur un projet où la mémoire korr n'était pas encore installée (pas de `docs/decisions.md`, pas de `docs/feuille-de-route.md`, pas de `docs/journal/`) ; la procédure suppose leur existence et devrait prévoir ce cas (les créer à la volée ou le signaler explicitement en amont).

## Prochaine étape
PR de plan à fusionner sur `main`, puis dans une session neuve `/construire docs/plans/gaichel-trois-rapports.md` :
- lot 1 (les trois rapports, normalisation Traxxeo, trois fiches, désactivation de la fiche 1) à finir avant le mercredi 23/09 7 h, run hebdo ;
- lot 2 (découverte, guide, BIBLE, communication à Francis) à publier avant le scan du lundi 28/09 06:30.
