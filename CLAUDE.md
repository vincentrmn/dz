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
- Pages : `/` (Dashboard : chantiers, sélecteur de période calendrier, derniers rapports), `/rapports` (classés par chantier), `/configuration` (créneau du run hebdo + carnet de destinataires), `/debug` (santé + journal des runs).
- Rapports stockés sur le **volume Railway monté sur `/app/data`** (persistant entre déploiements). Routes : upload `POST /api/reports/upload?chantier&periode&type=pdf|docx|html`, listing `GET /api/reports`, téléchargement `/reports/:file`.
- Conversion Word : `POST /api/convert/docx` (lib `html-to-docx` ; les icônes du HTML sont inlinées en base64 côté serveur par `inlinerIcones()` avant conversion).
- Icônes des chapitres : fichiers PNG dans `public/icons/` (equipes, illustrations, materiel), référencés **par URL** dans le HTML du rapport.
- Le reste des routes `/api/*` sont des **proxys vers les webhooks n8n** (chantiers, runs, generer, decouverte, contacts, reglages).

### Workflows n8n (IDs)
- **`DZ — Générer rapport chantier`** (`qZG6Q5LnQSrloeXR`) : sous-workflow appelé par chantier. Chaîne : Config (drapeaux `graph_actif`, `traxxeo_actif`, `pdfshift_actif`, `mail_actif`, `mail_from`, `cockpit_url`) → journalisation début (dz_runs) → Auth Microsoft → lecture BL&L + RT (pagination) → téléchargement/compression images → Auth/Lire/Mapper Traxxeo (désactivé tant que l'offre n'est pas signée) → `Fusionner sources` → `Préparer rapport` (HTML) → dépôt HTML → PDFShift → dépôt PDF → conversion Word via cockpit → dépôt Word → bilan (Succès / Succès partiel / Erreur) → envoi email éventuel (SMTP) → journalisation fin.
- **`DZ — Rapport hebdo`** (`5su1DOeswBlCdakw`) : webhook `dz/generer` (génération à la demande) + **cron horaire** dont un nœud Code (Europe/Luxembourg) compare au créneau stocké dans `dz_reglages` (`run_hebdo`, défaut mercredi 7 h). Charge les chantiers actifs et lance le sous-workflow pour chacun (`waitForSubWorkflow=false`).
- **`DZ — Découverte chantiers`** (`49okCW9O85lYsP3r`) : cron lundi 06:30 + webhook `dz/decouverte`. Scanne les conversations Teams du compte assembleur (regex `-\s*(BL&L|BLL|RT)\s*-`), normalise les codes (`CH:22-06 B` → `22.06 B`), **upsert** dans dz_chantiers en préservant nom/wbs/actif existants et en ne remplissant que les IDs de conversations manquants. Nouveautés créées en `actif=false` (validation humaine).
- **`DZ — Cockpit API`** (`FCZLzT8cabm3s3GE`) : webhooks GET/POST `dz/api/chantiers` (y compris **suppression** via `{id, supprimer:true}`), GET `dz/api/runs`, GET/POST `dz/api/contacts`, GET/POST `dz/api/reglages`.

### Data Tables n8n (IDs)
- **dz_chantiers** (`6LXQADAq7StJE6TN`) : nom, wbs, conversation_bll, conversation_rt, emails (séparés par `;`), mail_actif, actif, source (`pilote`/`decouverte`/`cockpit`), notes.
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
- **GitHub** : le dépôt contient le cockpit + `docs/MANUEL.md` (manuel utilisateur, à convertir en PDF à la fin) + `docs/MISE-EN-SERVICE.md` (exploitation, passation à DZ, questions ouvertes). Les tenir à jour à chaque évolution.

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
- Suppression d'un chantier (Zone de danger) = suppression de la **ligne de config uniquement** : les rapports générés restent sur le volume, l'historique reste dans dz_runs. ⚠️ Le scan de découverte **recréera** le chantier (inactif) tant que le soft-delete de la roadmap n'est pas implémenté.
- L'envoi email d'un chantier ne part que si : interrupteur général `mail_actif` (Config) **et** toggle du chantier **et** destinataires non vides.

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

Par priorité :

1. **« Comment ça marche ? » — LA partie stratégique.** Un grand guide intégré à l'outil (pas un PDF à part) expliquant pas à pas : comment fonctionne la chaîne de bout en bout, à quoi sert chaque menu, comment bien nommer les prochaines conversations Teams (`… -BL&L- …` / `… -RT- …`), comment activer un nouveau chantier, comment maintenir l'outil, qui contacter en cas de besoin (Vincent, CBC/Benoît pour le tenant Microsoft, Matthieu pour Traxxeo). Exhaustif mais parfaitement intégré à l'UI/UX — à travailler ensemble avant d'implémenter.
2. **Réglage SMTP Gmail** (côté Vincent : port 465 SSL/TLS + mot de passe d'application), puis re-test d'envoi sur Gaichel.
3. **Suppression de chantier durable (soft-delete).** Aujourd'hui un chantier supprimé est recréé (inactif) au scan suivant → relou. Solution retenue à implémenter : ne plus effacer la ligne mais la marquer supprimée (colonne dédiée dans dz_chantiers) ; le scan ignore ces lignes, le Dashboard les masque, et prévoir une restauration simple.
4. **Générer + envoyer par email en une action.** Proposition sans surcharger l'UI : transformer « Générer le rapport » en bouton scindé (split button) — clic principal = générer ; petite flèche = menu avec « Générer et envoyer par email » (visible seulement si le toggle email du chantier est actif). Le cron hebdo, lui, envoie déjà automatiquement.
5. **Authentification Microsoft** pour accéder à l'outil (login Entra ID / compte DZ, tenant géré par CBC — prévoir d'impliquer Benoît pour l'app registration). Aujourd'hui le cockpit est public : à traiter avant un usage large.
6. **Favicon** : utiliser uniquement le « dz » rouge du logo (l'actuel est le logo complet, déformé en 16×16).
7. **À demander à Francis** : (a) où déposer les rapports — quel site/répertoire SharePoint, option tampon secrétariat ou dépôt direct (Lot 4) ; (b) quelle adresse email doit être l'expéditeur des rapports (aujourd'hui un Gmail de test) ; (c) pourquoi les conversations RT ne sont pas alimentées.
8. **Manuel PDF** : convertir `docs/MANUEL.md` en PDF quand le contenu est validé (probablement fusionné avec le « Comment ça marche ? »).
9. **GAMMA** : backfill des rapports depuis début janvier 2026 après validation BETA + offre Traxxeo (attention volumétrie PDFShift ; les semaines sans usage Teams auront peu/pas de photos — attendu, ne pas « corriger »).

### Hors périmètre (garder au chaud)
- Bascule conversation Teams → canal : faisable (~mêmes endpoints Graph, quelques heures), uniquement si DZ fait évoluer son usage de Teams. Ne pas anticiper.

## Contrainte budget

Enveloppe facturée : **1 à 2 jours** (choix assumé de Vincent, service à Francis). L'effort réel est supérieur : privilégier systématiquement la solution la plus simple qui remplit le besoin, réutiliser l'existant, ne rien construire de spéculatif.

## Définition of done Phase 2

- Rapport hebdo Gaichel généré automatiquement le mercredi, PDF + Word, chapitres complets avec champs Traxxeo enrichis et totaux journée. *(Reste : Traxxeo actif.)*
- Nouveau chantier activable par configuration (procédure Fares = « Comment ça marche ? »).
- Rapports déposés selon l'option retenue par Francis. *(Reste : décision + implémentation.)*
- Envoi email opérationnel. *(Reste : SMTP.)*
- Backfill GAMMA depuis janvier 2026 classé. *(Après offre Traxxeo.)*
