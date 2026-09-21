# CLAUDE.md : Hub Rapport Technique DZ Construct

Lu au début de chaque session. **Tenu sous 200 lignes** : ici les règles de tous
les jours et la carte de la mémoire. Le récit des sessions est dans
`docs/journal/`, les leçons par zone de code dans `.claude/rules/`, le contexte
durable dans `docs/contexte/`, la référence technique complète dans `docs/BIBLE.md`.

## 1. Le projet en dix lignes

Génération industrialisée du rapport technique hebdomadaire par chantier pour DZ Construct
(Luxembourg). Client : Francis ; décideur : Walter ; utilisateur interne : Fares. Phase 2 en
production depuis juillet 2026. Le mercredi matin, pour chaque chantier actif, un rapport PDF + Word
organisé par jour avec trois chapitres : activité des équipes (Traxxeo), illustrations et explications
techniques (conversation Teams `-RT-`), matériel et bons de livraison (conversation Teams `-BL&L-`).
Le rapport part par email à `dzconstruct@dzconstruct.lu` (1 mail = 1 chantier). Pas de couche IA :
**passthrough strict** des textes et photos, on n'invente jamais de contenu. Le cockpit web « Hub
Rapport Technique » (Express + front statique, Railway) pilote les chantiers, la période, les runs,
les rapports et la configuration ; quatre workflows n8n font le travail. Budget facturé : 1 à 2 jours,
donc toujours la solution la plus simple qui remplit le besoin, rien de spéculatif.

## 2. Stack et commandes

- Node 22, Express (`server.js`, `auth.js`), front statique `public/`, pas de framework, pas de TS.
- `npm run check` : DOIT passer avant tout commit (syntaxe `node --check`, `eslint`, `node --test`).
- `npm test` : tests ciblés dans `tests/` (ce qui a déjà cassé : Word, archives).
- Déploiement : **auto-deploy Railway à chaque push sur `main`** (~30 s). Vérifier avec
  `curl https://cockpit-production-c3dc.up.railway.app/api/health` (route ouverte) ; le reste des
  routes exige un login Microsoft ou l'en-tête `X-Cockpit-Token` (valeur dans Railway).
- Workflows n8n : uniquement par le **MCP n8n** (`https://n8n-production-8929d.up.railway.app/mcp-server/http`,
  peut demander une réautorisation OAuth en début de session). Après chaque `update_workflow` :
  **`publish_workflow`**, sinon rien n'est actif.
- Webhooks n8n publics (lecture directe possible) : `https://n8n-production-8929d.up.railway.app/webhook/dz/api/chantiers`, `.../dz/api/runs`.
- Au démarrage : `git fetch origin main` puis `git checkout -B main origin/main` (le conteneur peut être recloné).

## 3. Règles absolues

- Passthrough strict : ne jamais inventer, reformuler ni compléter un texte ou une photo de rapport.
- Aucun secret dans le code, les commits, les docs ou ce fichier ; les credentials vivent dans n8n
  et les variables dans Railway. Jamais de secret recopié depuis une capture d'écran.
- Aucun identifiant de modèle dans les commits, PR, code ou commentaires.
- `publish_workflow` après tout `update_workflow`. `Lancer génération` reste en
  `waitForSubWorkflow: true` (quota Graph par application) : jamais en parallèle.
- Ne jamais retirer le filtre des vidéos ni les lots de 12 + pause 15 s sur les images Teams.
- `auth.js` monté avant `express.static` ; ne jamais protéger `/icons/` (PDFShift les lit par URL).
- Tout ce qui doit survivre à un déploiement va sur le volume `/app/data`.
- Ne jamais transcrire du base64 à la main. Nœuds n8n nommés par leur nom exact français.
- Ne pas rouvrir une décision de `docs/decisions.md` sans raison nouvelle. Pas d'analyse non sollicitée.
- Toute évolution d'UI se vérifie par capture (palette DZ `--rouge:#ff110b`, `--gris:#8a8a81`).
- Tenir `docs/BIBLE.md` et la page `/guide` alignés avec l'outil à chaque évolution.

## 4. Architecture, en bref

- **Cockpit** (`server.js`) : pages `/` (Dashboard : chantiers, période, bouton scindé « Générer » /
  « Générer et envoyer »), `/rapports`, `/configuration` (créneau hebdo + carnet de destinataires),
  `/guide` (doc utilisateur intégrée), `/debug` (santé + journal des runs). Routes : proxys
  `/api/*` vers les webhooks n8n ; `POST /api/convert/docx` (html-to-docx, `htmlPourWord()` +
  `forcerWordModerne()`) ; dépôt `POST /api/reports/upload`, `GET /api/reports`, `/reports/:file` ;
  `GET /api/archives.zip` (rapports mensuels non vides). Rapports sur le volume `/app/data`.
- **Auth** (`auth.js`) : OIDC Microsoft single-tenant, comptes `@dzconstruct.lu` seulement, cookie
  signé ; jeton de service `X-Cockpit-Token` pour n8n ; `ACCES_SECOURS` = porte par code (Vincent).
  Retirer une variable `MS_*` dans Railway rouvre le Hub.
- **Workflows n8n** : `DZ — Générer rapport chantier` (`qZG6Q5LnQSrloeXR`, la chaîne complète par
  chantier) ; `DZ — Rapport hebdo` (`5su1DOeswBlCdakw`, webhook `dz/generer` + cron horaire comparé au
  créneau `run_hebdo`, défaut mercredi 7 h) ; `DZ — Découverte chantiers` (`49okCW9O85lYsP3r`, cron
  lundi 06:30 + webhook `dz/decouverte`, scan des conversations Teams `-BL&L-`/`-RT-`, nouveaux
  chantiers créés inactifs) ; `DZ — Cockpit API` (`FCZLzT8cabm3s3GE`, webhooks `dz/api/*`).
  Copie de référence datée du générateur : `n8n/dz-generer-rapport.workflow.mjs`.
- **Data Tables n8n** : `dz_chantiers` (`6LXQADAq7StJE6TN` : nom, wbs `;`, conversation_bll/rt,
  emails, mail_actif, actif, source, notes, supprime), `dz_runs` (`9HVj9380Vw6DulOr`), `dz_contacts`
  (`OQfO7bWw9oSYba7g`), `dz_reglages` (`B9TiHAJqJbOJXUNe`).
- **Sources** : Traxxeo (`person_hrd`, filtre `Heure travail` + WBS du chantier, champs enrichis) ;
  Microsoft Graph (compte `assembleur@dzconstruct.lu`, `hostedContents` pour les photos, lots de 12 +
  pause 15 s, vidéos écartées) ; PDFShift (HTML→PDF, forfait payant) ; email Graph `sendMail` depuis
  `dzconstruct@dzconstruct.lu` (pièce jointe si < 3 Mo, sinon liens seuls, en le disant).
- **Email** : part seulement si `mail_actif` (Config) et toggle du chantier et destinataires non vides
  et `envoyer=true` (cron hebdo ou « Générer et envoyer »). Pour tout couper : `mail_actif` à false.

## 5. Infra

- Railway : projet **dz** `1f9f5e94-05b5-4f53-9326-657a6ce965ab`, service **cockpit**
  `9521b395-17d6-4acf-ac50-f46a315a2dcd` (volume `/app/data`) ; projet **pacific-endurance**
  `46e4c916-b828-4291-8f9e-eaf4efb7e854` (n8n + Postgres). MCP Railway pour variables, logs,
  redeploy ; volumes et domaines par Vincent dans le dashboard ; `railway-agent` inutilisable.
- Tenant Microsoft géré par CBC Informatique (Benoît Herbays, Adrien Olivieri) ; les secrets client
  des deux apps (`DZ-Teams-Extractor`, `DZ – Hub Rapport Technique (login)`) expirent.
- Détail (IDs, credentials, passation) : `docs/contexte/architecture.md`, `docs/BIBLE.md`.

## 6. Conventions de travail avec Vincent (strictes)

- Vincent ne tape aucune commande ; il travaille depuis claude.ai/code. Il n'est pas développeur :
  instructions opérationnelles précises (quel nœud, quel champ, quel code à coller) ; Railway et
  Microsoft guidés écran par écran.
- Français, registre informel, explications simples sans jargon. Décisions tranchées, seulement les
  questions bloquantes. **Une action à la fois, confirmation avant de continuer** ; proposition
  validée avant de coder les gros morceaux.
- Branche de session, PR squash-merge vers `main` (CI `check` verte). Jamais de push direct sur `main`.
- En fin de session : entrée de journal ; leçon durable dans la règle du chemin ; décision dans
  `docs/decisions.md` ; feuille de route à jour. Ce fichier ne grandit pas.
- Avant de toucher un workflow n8n par le MCP : lire `.claude/rules/n8n.md`.

## 7. Carte de la mémoire

| Où | Quoi |
|---|---|
| `.claude/rules/cockpit.md` | serveur, auth, front, tests : règles et pièges (Word, icônes, Railway) |
| `.claude/rules/n8n.md` | workflows n8n, Graph, Traxxeo, PDFShift : règles et pièges |
| `docs/BIBLE.md` | référence technique complète (architecture, données, fragilités, exploitation) |
| `docs/contexte/` | architecture et outils, acquis Traxxeo, acquis Graph/Teams, pièges (texte d'origine), conventions, questions Francis, passation |
| `docs/decisions.md` | arbitrages datés |
| `docs/feuille-de-route.md` | à faire, prochaine étape, ce qui attend Vincent |
| `docs/plans/` | plans validés, exécutés par `/construire` |
| `docs/journal/` | une entrée par session, jamais chargée (dont l'état complet au 02/09) |
| page `/guide` (`public/guide.html`) | doc utilisateur : nommage Teams, activation d'un chantier, contacts |

## 8. Où on en est (21/09/2026)

Tout tourne en prod : rapport hebdo complet, Traxxeo actif, login Microsoft, email par Graph allumé,
archives mensuelles janv→juil. Huit chantiers actifs. Plan en cours : **Gaichel en trois rapports
A/B/C** (`docs/plans/gaichel-trois-rapports.md`), lot 1 avant le mercredi 23/09 7 h, lot 2 avant le
lundi 28/09 06:30. Ensuite : bugs remontés par Francis (liste à venir), premier vrai login DZ,
relecture du guide. Workflow korr installé le 21/09 (agents, skills, portiques, CI).
