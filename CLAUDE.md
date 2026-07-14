# CLAUDE.md — Rapport Technique DZ Construct — Phase 2 (en production)

## Contexte

POC validé (rapport « ALPHA »), puis Phase 2 **construite et déployée** : génération industrialisée du rapport hebdomadaire par chantier. Client : DZ Construct (Luxembourg), interlocuteur : Francis. Décideur : Walter. Utilisateur interne côté DZ : Fares. Chantier pilote : **22.06-Gaichel-Maisons** (ne pas changer).

Le rapport hebdo est généré **le mercredi de la semaine suivante** (créneau configurable), organisé **par jour**, avec **3 chapitres par jour** :
1. Activité des équipes (Traxxeo)
2. Illustrations et explications techniques (Teams, conversation RT)
3. Matériel et bons de livraison (Teams, conversation BL&L)

Pas de couche IA de reformulation : **passthrough strict** des textes et photos (décision actée). Ne jamais inventer de contenu.

## Architecture en production

### Cockpit web « Hub Rapport Technique »
- Express (`server.js`) + front statique (`public/`), déployé sur **Railway**, URL : `https://cockpit-production-c3dc.up.railway.app`.
- Déploiement : **auto-deploy à chaque push GitHub** sur la branche suivie par le service Railway. Vérifier un déploiement en pollant un marqueur dans les assets déployés (ex. `curl …/styles.css | grep <nouvelle-classe>`), ~30 s après le push.
- Pages : `/` (Dashboard : chantiers, sélecteur de période calendrier, derniers rapports, bloc « Chantiers supprimés » restaurables), `/rapports` (classés par chantier), `/configuration` (créneau du run hebdo + carnet de destinataires), `/guide` (« Comment ça marche ? » — guide intégré : chaîne, nommage Teams, activation chantier, contacts), `/debug` (santé + journal des runs). Favicon : `public/favicon.png` (le « dz » rouge seul, extrait du logo).
- Dashboard : bouton scindé sur chaque chantier — clic principal « Générer le rapport » = **sans** email ; la flèche (visible si le toggle email du chantier est actif) ouvre « Générer et envoyer par email » (`envoyer: true` dans le POST `dz/generer`).
- Rapports stockés sur le **volume Railway monté sur `/app/data`** (persistant entre déploiements). Routes : upload `POST /api/reports/upload?chantier&periode&type=pdf|docx|html`, listing `GET /api/reports`, téléchargement `/reports/:file`.
- Conversion Word : `POST /api/convert/docx` (lib `html-to-docx` ; les icônes du HTML sont inlinées en base64 côté serveur par `inlinerIcones()` avant conversion).
- Icônes des chapitres : fichiers PNG dans `public/icons/` (equipes, illustrations, materiel), référencés **par URL** dans le HTML du rapport.
- Le reste des routes `/api/*` sont des **proxys vers les webhooks n8n** (chantiers, runs, generer, decouverte, contacts, reglages).

### Workflows n8n (IDs)
- **`DZ — Générer rapport chantier`** (`qZG6Q5LnQSrloeXR`) : sous-workflow appelé par chantier. Chaîne : Config (drapeaux `graph_actif`, `traxxeo_actif`, `pdfshift_actif`, `mail_actif`, `mail_from`, `cockpit_url`) → journalisation début (dz_runs) → Auth Microsoft → lecture BL&L + RT (pagination) → téléchargement/compression images → Auth/Lire/Mapper Traxxeo (désactivé tant que l'offre n'est pas signée) → `Fusionner sources` → `Préparer rapport` (HTML) → dépôt HTML → PDFShift → dépôt PDF → conversion Word via cockpit → dépôt Word → bilan (Succès / Succès partiel / Erreur) → envoi email éventuel (SMTP) → journalisation fin. Entrée booléenne `envoyer` : l'email ne part que si `envoyer=true` (cron hebdo, ou option explicite du cockpit) **en plus** des conditions mail_actif ×2 + destinataires + non-démo + fichier produit.
- **`DZ — Rapport hebdo`** (`5su1DOeswBlCdakw`) : webhook `dz/generer` (génération à la demande) + **cron horaire** dont un nœud Code (Europe/Luxembourg) compare au créneau stocké dans `dz_reglages` (`run_hebdo`, défaut mercredi 7 h). Charge les chantiers actifs et lance le sous-workflow pour chacun (`waitForSubWorkflow=false`).
- **`DZ — Découverte chantiers`** (`49okCW9O85lYsP3r`) : cron lundi 06:30 + webhook `dz/decouverte`. Scanne les conversations Teams du compte assembleur (regex `-\s*(BL&L|BLL|RT)\s*-`), normalise les codes (`CH:22-06 B` → `22.06 B`), **upsert** dans dz_chantiers en préservant nom/wbs/actif existants et en ne remplissant que les IDs de conversations manquants. Nouveautés créées en `actif=false` (validation humaine).
- **`DZ — Cockpit API`** (`FCZLzT8cabm3s3GE`) : webhooks GET/POST `dz/api/chantiers` (suppression **soft** via `{id, supprimer:true}` → `supprime=true, actif=false` ; restauration via `{id, restaurer:true}`), GET `dz/api/runs`, GET/POST `dz/api/contacts`, GET/POST `dz/api/reglages`.

### Data Tables n8n (IDs)
- **dz_chantiers** (`6LXQADAq7StJE6TN`) : nom, wbs, conversation_bll, conversation_rt, emails (séparés par `;`), mail_actif, actif, source (`pilote`/`decouverte`/`cockpit`), notes, supprime (soft-delete).
- **dz_runs** (`9HVj9380Vw6DulOr`) : journal des générations (chantier, période, statut, étape, message, stats, declenchement).
- **dz_contacts** (`OQfO7bWw9oSYba7g`) : nom, email (carnet de destinataires).
- **dz_reglages** (`B9TiHAJqJbOJXUNe`) : clé/valeur ; `run_hebdo` = `{"jour": 3, "heure": 7}`.

### Railway (IDs)
- Projet **dz** `1f9f5e94-05b5-4f53-9326-657a6ce965ab`, service **cockpit** `9521b395-17d6-4acf-ac50-f46a315a2dcd` (volume sur `/app/data`).
- Projet **pacific-endurance** `46e4c916-b828-4291-8f9e-eaf4efb7e854` : n8n + son **Postgres** `18c9a309-1884-442d-8059-869923dac7e1` (volume agrandi à 5 GB après saturation).
- Le MCP Railway permet redeploy/logs/list-deployments ; **`railway-agent` est inutilisable** (limite d'usage permanente) ; volumes, domaines et variables d'environnement se font **par Vincent dans le dashboard** (guider pas à pas).

## Environnement & outils

- **n8n v2.16** self-hosted Railway, MCP officiel : `https://n8n-production-8929d.up.railway.app/mcp-server/http`. Après chaque `update_workflow` : **`publish_workflow` obligatoire**, sinon la modif n'est pas active.
- **PDFShift** pour HTML→PDF (credential dans le nœud).
- **Microsoft Graph** : compte `assembleur@dzconstruct.lu`, permissions Chat.Read.All, Files.Read.All, Team.ReadBasic.All, Channel.ReadBasic.All. Tenant géré par CBC Informatique (Benoît Herbays).
- **Traxxeo** : contact vendeur = Matthieu. ⚠️ Accès API **payant**, offre commerciale en attente : `traxxeo_actif=false`, ne rien lancer de massif (backfill GAMMA) avant signature. Pour activer : sélectionner le credential Basic Auth sur « Auth Traxxeo » (à la main dans l'UI n8n) + passer `traxxeo_actif` à `true` dans « Config ».
- **SMTP** : nœud emailSend n8n, credential « SMTP account ». Railway **bloque le port 25** ; Gmail exige `smtp.gmail.com` port 465 SSL/TLS (ou 587 STARTTLS) + **mot de passe d'application** Google. État courant : *Connection timeout* → configuration Gmail à corriger côté Vincent, puis re-tester.
- **GitHub** : le dépôt contient le cockpit + `docs/MANUEL.md` (manuel utilisateur, à convertir en PDF à la fin) + `docs/MISE-EN-SERVICE.md` (exploitation, passation à DZ, questions ouvertes) + `docs/BIBLE.md` (référence technique complète : architecture, technologies, workflows, données, fragilités, exploitation). Les tenir à jour à chaque évolution.

## Données Traxxeo — acquis

- OAuth2 sur `https://ords.traxxeo.com/oauth/token` (Basic Auth, `grant_type=client_credentials`, form-urlencoded) ; données via `https://ords.traxxeo.com/api/v2/person_hrd` avec `all_data=Y` et `from_date`/`to_date` en `DD/MM/YYYY`.
- Gaichel = WBS `22.06 A` + `22.06 B` (pas de nœud parent `22.06` : filtrer côté code).
- Garder uniquement `work_code_name.trim() === 'Heure travail'` ; exclure « Jour férié », « Congé », « Heure trajet ».
- Dates reçues en `DD/MM/YYYY` → convertir en `YYYY-MM-DD`.
- `user_comment` rempli à ~39 % sur Gaichel (`'Calculated'` = vide) ; `declared_vehicle_name` = équipement ; `work_duration` = heures de la ligne. **Ne jamais utiliser « Heures déclarées visibles »** (total journée) comme heures de ligne.
- Doc publique `rest.traxxeo.com` = coquille vide ; la vraie doc est `wiki-api.traxxeo.com`.
- Champs encore à vérifier avec Matthieu : Personne-Code (`person_erp_id`/`person_identifier` null), catégorie DZC vs intérim (piste `company_nr`), qualification, activité de liste finie.

## Microsoft Graph / Teams — acquis

- Convention de nommage **réelle** des conversations : `-BL&L-` (et non `-BLL-`) et `-RT-` dans le sujet du groupe.
- Pagination messages : `?$top=50` **dans l'URL** (jamais en queryParameters : erreur 400 « $top specified more than once ») ; condition de fin `{{ !$response.body["@odata.nextLink"] }}` — ne référencer **aucun autre nœud** dans les expressions de pagination (échec silencieux).
- Images de messages : `chats/{id}/messages/{msgId}/hostedContents/{hcId}/$value`.
- 15 chantiers découverts par scan ; 3 sans conversation RT (26.06 Maison-OMS, 26.07 MaisonFluhe, 99.02 Chantiers-Divers) ; la semaine testée, RT vide partout → **question posée à Francis** (pourquoi les RT ne sont pas alimentés) — pas un bug.

## Pièges connus (ne pas re-découvrir)

### n8n
- Binaire stocké en références filesystem : `getBinaryDataBuffer()`, jamais lire `.data` directement.
- Éviter le nœud Merge pour des branches de tailles différentes : `$('NomDuNœud').all()` dans un nœud Code.
- Après un nœud Code, `$('Node').item` casse (« Paired item data unavailable ») : utiliser **`$('Node').first().json`** partout.
- `Préparer rapport` lit `$('Fusionner sources')` directement, pas `$input`.
- Le validateur du MCP n8n **refuse d'attacher un credential httpBasicAuth** à un nœud httpRequest : laisser le nœud sans credential et le faire sélectionner à la main dans l'UI.
- Expressions dans les params bruts : chaînes préfixées `=`.
- Normaliser les clés de date avec `.substring(0, 10)` (contamination inter-jours sinon).
- Semaine « lundi→dimanche » : calcul ISO propre (règle du 4 janvier) — un calcul naïf donne dimanche→samedi.
- Les exécutions de test avec photos remplissent le Postgres n8n (crash « No space left on device » déjà vécu) : recommandé `EXECUTIONS_DATA_MAX_AGE=168` sur le service n8n (pas encore posé).

### PDFShift / rapport
- Body en mode « Using Fields Below », jamais `JSON.stringify` en mode JSON (erreur 400 « Rogue field ») ; `sandbox=false` en prod.
- CSS `running()` (logo répété par page) ne marche pas : logo première page uniquement.
- **Ne jamais transcrire du base64 à la main** (corruption systématique constatée) : les icônes sont des fichiers servis par le cockpit, inlinés par code pour le docx.

### Cockpit / Railway
- Disque du service éphémère : tout ce qui doit survivre à un déploiement va sur le volume `/app/data`.
- Depuis l'environnement de dev distant, Chromium/Playwright **ne sort pas sur Internet** (proxy → ERR_CONNECTION_RESET) : pour vérifier l'UI, servir `public/` en local avec des stubs `/api/*` et capturer sur `127.0.0.1`. `curl` fonctionne normalement pour vérifier la prod.

### Fonctionnel
- Suppression d'un chantier (Zone de danger) = **soft-delete** : la ligne reste dans dz_chantiers avec `supprime=true, actif=false`, masquée du Dashboard (bloc « Chantiers supprimés » avec restauration), ignorée par le run hebdo et par le scan de découverte. Les rapports générés restent sur le volume, l'historique dans dz_runs. La restauration remet `supprime=false` (le chantier revient inactif).
- L'envoi email d'un chantier ne part que si : interrupteur général `mail_actif` (Config) **et** toggle du chantier **et** destinataires non vides **et** `envoyer=true` (cron hebdo ou « Générer et envoyer par email » du cockpit).

## Conventions de travail

- Communication en **français**, registre informel, explications simples sans jargon.
- **Une action à la fois, confirmation avant de continuer.** Jamais de batch d'étapes sans accord explicite.
- Nœuds n8n référencés par leur **nom exact français** (accents et casse) : `Fusionner sources`, `Préparer rapport`, `Lire messages BLL`, `Config`…
- Ne pas rouvrir de décisions closes. Pas d'analyse non sollicitée.
- Vincent n'est pas développeur pur : instructions opérationnelles précises (quel nœud, quel champ, quel code à coller) ; pour Railway/Gmail, guider écran par écran.
- **Jamais de secrets dans le repo ni dans les fichiers** (tokens, client_secret, tenant ID). Les credentials vivent dans n8n.
- L'UI du cockpit est en français, épurée, palette DZ (`--rouge:#ff110b`, `--gris:#8a8a81`) ; toute évolution d'UI se vérifie par capture d'écran avant d'annoncer que c'est fait.
- Tenir `docs/MANUEL.md` et `docs/MISE-EN-SERVICE.md` alignés avec l'outil.

## État des lots Phase 2

| Lot | État |
|---|---|
| 1 — Champs Traxxeo enrichis | Codé, **en attente offre Traxxeo** (traxxeo_actif=false) ; champs manquants à vérifier avec Matthieu |
| 2 — Word (.docx) | ✅ Fait (html-to-docx via cockpit) |
| 3 — Cockpit config + découverte auto | ✅ Fait (Data Tables + scan Teams ; Excel SharePoint abandonné au profit des Data Tables n8n) |
| 4 — Dépôt des rapports | ⏳ Décision Francis en attente (voir roadmap « à demander à Francis ») |
| 5 — Déclenchement | ✅ Fait (webhook à la demande + cron hebdo configurable) |
| 6 — BETA Gaichel (démo Walter fin juillet) | Prêt hors Traxxeo/SMTP |
| 7 — GAMMA (backfill depuis janvier 2026) | ⏳ Après BETA validée + offre Traxxeo signée |

## Roadmap

Fait le 13/07 au soir (session « déploiement roadmap ») :

- ✅ **« Comment ça marche ? »** — page `/guide` intégrée au cockpit (chaîne de bout en bout, contenu du rapport, nommage Teams `-BL&L-`/`-RT-` avec exemples, activation d'un chantier pas à pas, rôle de chaque page, run du mercredi, envoi email, suppression/restauration, contacts Vincent/Benoît/Matthieu). Première version complète rédigée en autonomie : **à faire relire par Vincent**, le contenu s'ajuste dans `public/guide.html`.
- ✅ **Soft-delete des chantiers** — colonne `supprime` dans dz_chantiers ; suppression cockpit = marquage (`supprime=true, actif=false`) ; restauration en un clic (bloc « Chantiers supprimés » du Dashboard) ; run hebdo et scan de découverte ignorent ces lignes. Testé en réel (chantier `00.00-Test-SoftDelete`, id 18, laissé en supprimé comme exemple).
- ✅ **Générer + envoyer en une action** — bouton scindé sur la carte chantier ; drapeau `envoyer` propagé webhook → orchestrateur → générateur (6e condition du IF « Envoi email ? »).
- ✅ **Favicon** — `public/favicon.png` : le « dz » rouge seul.

Reste, par priorité :

1. **Réglage SMTP Gmail** (côté Vincent : port 465 SSL/TLS + mot de passe d'application Google sur le credential « SMTP account » n8n), puis re-test d'envoi sur Gaichel — dernier essai : *Connection timeout*.
2. **Relecture du guide `/guide`** par Vincent (et Francis ?) — ajuster le texte, puis en tirer le manuel PDF (point 5).
3. **Authentification Microsoft** pour accéder à l'outil (login Entra ID / compte DZ, tenant géré par CBC — prévoir d'impliquer Benoît pour l'app registration). Aujourd'hui le cockpit est public : à traiter avant un usage large.
4. **À demander à Francis** : voir la section dédiée « Pour Francis — questions & points fragiles » ci-dessous.
5. **Manuel PDF** : convertir `docs/MANUEL.md` en PDF quand le contenu est validé (probablement fusionné avec le « Comment ça marche ? »).
6. **GAMMA** : backfill des rapports depuis début janvier 2026 après validation BETA + offre Traxxeo (attention volumétrie PDFShift ; les semaines sans usage Teams auront peu/pas de photos — attendu, ne pas « corriger »).
7. *(Qualité, non bloquant)* Remplacer les secrets en clair des nœuds n8n (client_secret Graph dans les 2 `Auth Microsoft`, clé PDFShift dans `Convertir en PDF`) par des credentials n8n — à faire à la main dans l'UI (le MCP ne sait pas attacher un credential httpBasicAuth). Et poser `EXECUTIONS_DATA_MAX_AGE=168` sur le service n8n Railway.

### Hors périmètre (garder au chaud)
- Bascule conversation Teams → canal : faisable (~mêmes endpoints Graph, quelques heures), uniquement si DZ fait évoluer son usage de Teams. Ne pas anticiper.

## Pour Francis — questions & points fragiles

À dérouler avec Francis (démo BETA fin juillet ou avant). Les réponses conditionnent la fin de la Phase 2.

### Questions à poser
1. **Dépôt des rapports (Lot 4)** : où doivent-ils atterrir ? Site/répertoire SharePoint précis, ou tampon secrétariat qui valide avant classement ? Aujourd'hui les rapports vivent dans le Hub (volume Railway), ça marche mais ce n'est pas le classement définitif DZ.
2. **Adresse expéditrice des emails** : aujourd'hui un Gmail de test. Proposer une boîte DZ (`rapports@dzconstruct.lu` ou `assembleur@`) via Microsoft Graph (voir fragilité SMTP ci-dessous) — qui la crée, qui la relève ?
3. **Conversations RT non alimentées** : sur la semaine testée, 0 message RT sur les 11 chantiers équipés (les BL&L sont actives : 57 messages, 61 photos). Les équipes savent-elles qu'elles doivent poster les explications techniques dans la conversation RT ? Et 3 chantiers n'ont pas de conversation RT du tout (26.06 Maison-OMS, 26.07 MaisonFluhe, 99.02 Chantiers-Divers) — faut-il les créer ?
4. **Compte assembleur dans chaque conversation** : la découverte automatique ne voit que les conversations dont `assembleur@dzconstruct.lu` est membre. Deux options à lui proposer : (a) garder la règle « toujours inclure assembleur@ à la création » (simple, mais fragile : une conversation créée sans lui est invisible) ; (b) basculer vers des **canaux d'équipe Teams** (une équipe « Chantiers », un canal par chantier) — l'outil pourrait alors tout lire **sans** compte invité, la fragilité disparaît (~quelques heures d'adaptation, endpoints Graph similaires). À trancher selon l'usage Teams que DZ veut avoir.
5. **Qui utilise l'outil chez DZ** : confirmer que c'est Fares (et qui d'autre ?) — nécessaire pour la liste d'accès de l'authentification Microsoft à venir.

### Points fragiles à connaître (état au 13/07)
- **Cockpit public** : pas encore d'authentification — ne pas diffuser l'URL largement avant le login Microsoft (roadmap n°3).
- **Emails** : l'envoi SMTP est bloqué depuis Railway (timeout) ; bascule prévue vers Microsoft Graph `Mail.Send` (demande faite à Benoît). D'ici là, aucun email ne part.
- **Secret Microsoft qui expire** : le client_secret de l'app « DZ-Teams-Extractor » a une date d'expiration fixée par CBC — à renouveler avant échéance sinon plus de lecture Teams (et prévenir Vincent pour la mise à jour dans n8n).
- **Traxxeo inactif** : chapitre « Activité des équipes » vide tant que l'offre API n'est pas signée (Matthieu).
- **Comptes personnels de Vincent** : Railway, PDFShift et le Gmail de test sont sur ses comptes — la passation vers des comptes DZ est décrite dans `docs/MISE-EN-SERVICE.md`.
- **Crédits PDFShift** : chaque PDF consomme des crédits payants — le backfill GAMMA (6+ mois × 15 chantiers) devra être budgété.

## Contrainte budget

Enveloppe facturée : **1 à 2 jours** (choix assumé de Vincent, service à Francis). L'effort réel est supérieur : privilégier systématiquement la solution la plus simple qui remplit le besoin, réutiliser l'existant, ne rien construire de spéculatif.

## Définition of done Phase 2

- Rapport hebdo Gaichel généré automatiquement le mercredi, PDF + Word, chapitres complets avec champs Traxxeo enrichis et totaux journée. *(Reste : Traxxeo actif.)*
- Nouveau chantier activable par configuration (procédure Fares = « Comment ça marche ? »).
- Rapports déposés selon l'option retenue par Francis. *(Reste : décision + implémentation.)*
- Envoi email opérationnel. *(Reste : SMTP.)*
- Backfill GAMMA depuis janvier 2026 classé. *(Après offre Traxxeo.)*
