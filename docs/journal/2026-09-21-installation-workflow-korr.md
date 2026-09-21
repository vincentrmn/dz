# Session « installation du workflow korr » (21/09/2026)

## Ce qui a été décidé
- Workflow korr installé dans dz (agents, skills, portiques, CI, mémoire rangée) : la méthode commune s'applique désormais ici, `/construire` exécute les plans.
- `npm run check` = syntaxe (`node --check` via `scripts/syntaxe.sh`) + `eslint` (règles recommandées, quatre nuances de style désactivées pour ne pas retoucher le code existant éprouvé en prod : catch vides, erreurs attrapées non lues, échappements superflus, réaffectations inutiles) + `node --test tests/*.test.js` : le projet n'a pas de TypeScript, le check reste honnête et rapide.
- L'ancien `CLAUDE.md` (321 lignes) est rangé verbatim dans `docs/contexte/` et `docs/journal/2026-09-02-etat-avant-workflow-korr.md`, vérifié ligne à ligne ; le nouveau fait 121 lignes.

## Ce qui a été fait
- Clone de `vincentrmn/korr-workflow` (commit c5a7ef3) dans le bac à sable ; `scripts/installer.sh` lancé sur dz : 18 fichiers communs recopiés (5 agents, 6 skills cadrer/construire/livrer/journal/installer/staging, 5 portiques), `.claude/settings.json` et `.github/workflows/ci.yml` créés, `docs/decisions.md` laissé tel quel, gabarits `.gabarit.md` de plan et de journal posés, version notée dans `.claude/workflow-version`.
- `ci.yml` adapté (commentaire, plus de variable Next).
- `package.json` : scripts `typecheck`, `lint`, `test`, `check` ; devDependencies `eslint`, `@eslint/js`, `globals`.
- `eslint.config.mjs` créé ; `scripts/syntaxe.sh` créé.
- `tests/word.test.js` créé (5 tests : saut de page Word devant chaque jour avec contenu conservé, icônes inlinées avec largeur en style et non en attribut, photos à 330 px, `forcerWordModerne` injecte compatibilityMode=15 et rend tel quel un buffer non docx, regex des archives mensuelles qui écarte hebdo et HTML).
- `server.js` : seul changement de code de la session, `app.listen` mis sous `require.main === module` et export de `app`, `htmlPourWord`, `forcerWordModerne`, `MOIS_RE`, `SEUIL_VIDE`, pour rendre le fichier testable sans le démarrer.
- `.gitignore` : ajout de `.verif/`, `.verif-check.log`.
- Deux règles par chemin créées : `.claude/rules/cockpit.md` (`server.js`, `auth.js`, `public/**`, `tests/**`) et `.claude/rules/n8n.md` (`n8n/**`, `scripts/**`), tirées des « Pièges connus » de l'ancien CLAUDE.md.
- Ancien `CLAUDE.md` découpé verbatim en `docs/contexte/architecture.md`, `docs/contexte/traxxeo.md`, `docs/contexte/microsoft-graph-teams.md`, `docs/contexte/pieges.md`, `docs/contexte/conventions-francis-passation.md` ; la partie récit (point de situation, état des lots, roadmap) va dans `docs/journal/2026-09-02-etat-avant-workflow-korr.md`.
- Nouveau `CLAUDE.md` écrit (huit sections du gabarit korr).
- `docs/feuille-de-route.md` créée.

## Ce qui a été vérifié (et comment)
- `npm run check` : sortie 0 (syntaxe OK, lint 0 problème, 5 tests passent).
- Contrôle ligne à ligne par script Python : 0 ligne non vide de l'ancien CLAUDE.md absente de la concaténation des nouveaux fichiers de `docs/contexte/`.
- Serveur lancé en local (`PORT=3457`, `DATA_DIR` temporaire) : `GET /api/health` répond `{"cockpit":"ok","n8n":"ok",...}` ; `POST /api/convert/docx` répond 200, docx de 22 779 octets avec `compatibilityMode` à 15.
- Portiques testés avec un JSON simulé sur l'entrée standard : `garde-commit.sh` refuse (code 2) un CLAUDE.md de plus de 200 lignes et un message contenant un identifiant de modèle ; `garde-push.sh` refuse un push sur `main` (code 2) et accepte une branche de session (code 0) ; `garde-fichiers.sh` refuse `.env` (code 2).

## Ce qui n'a pas pu être vérifié
- Les portiques ne sont pas actifs dans cette session (session ouverte sur `/home/user`, deux dépôts) : le `settings.json` de dz sera actif dans une session ouverte directement sur dz.
- La CI GitHub n'a pas encore tourné : première exécution attendue sur la PR d'installation.
- Le déploiement Railway du `server.js` modifié se vérifie après le merge, par `curl .../api/health`.

## Leçons durables (reportées dans les règles ou les skills)
- Aucune leçon de code pour cette session.
- Signalé pour `korr-workflow` (pas écrit ici) : l'installateur ne crée pas `docs/feuille-de-route.md` alors que le gabarit de CLAUDE.md et le documentaliste y renvoient.

## Prochaine étape
PR « Workflow korr : installation » à fusionner sur `main` quand `check` est vert. Vincent protège `main` sur GitHub (status check `check`) et décide d'un staging. Puis session neuve `/construire docs/plans/gaichel-trois-rapports.md`.
