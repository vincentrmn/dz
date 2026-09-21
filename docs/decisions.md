# Décisions tranchées

Une ligne par arbitrage, daté, avec la raison en quelques mots. Le récit est
dans `docs/journal/`. On n'y revient pas sans une raison nouvelle.

- **21/09** Gaichel devient trois fiches chantier ordinaires (22.06A, 22.06B, 22.06C), pas de notion de sections : le cockpit gère déjà tout (rapport, fichiers, email, cron) par chantier.
- **21/09** La fiche `22.06-Gaichel-Maisons` est désactivée et conservée, rapports et historique dz_runs intacts : la consigne « chantier pilote, ne pas changer » du CLAUDE.md devient caduque.
- **21/09** Convention de nommage : lettre collée au code (`22.06A`) dans Teams et Traxxeo ; l'outil tolère l'espace (`22.06 A` = `22.06A` après normalisation, égalité stricte, jamais de préfixe) pour ne pas vider le chapitre 1 en silence pendant la transition.
- **21/09** Nom des trois nouvelles fiches = celui produit par la découverte (`22.06A Gaichel-Maisons`), comme pour les autres chantiers.
- **21/09** Trois mails Gaichel le mercredi acceptés : la règle du 30/07 « 1 mail = 1 chantier » ne change pas.
- **21/09** Workflow korr installé dans dz (agents, skills, portiques, CI, mémoire rangée) : la méthode commune s'applique désormais ici, `/construire` exécute les plans.
- **21/09** `npm run check` = syntaxe (`node --check` via `scripts/syntaxe.sh`) + `eslint` (règles recommandées, quatre nuances de style désactivées pour ne pas retoucher le code existant éprouvé en prod : catch vides, erreurs attrapées non lues, échappements superflus, réaffectations inutiles) + `node --test tests/*.test.js` : le projet n'a pas de TypeScript, le check reste honnête et rapide.
- **21/09** L'ancien `CLAUDE.md` (321 lignes) est rangé verbatim dans `docs/contexte/` et `docs/journal/2026-09-02-etat-avant-workflow-korr.md`, vérifié ligne à ligne ; le nouveau fait 121 lignes.
