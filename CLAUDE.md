# CLAUDE.md — Rapport Technique DZ Construct — Phase 2 (en production)

## Contexte

POC validé (rapport « ALPHA »), puis Phase 2 **construite et déployée** : génération industrialisée du rapport hebdomadaire par chantier. Client : DZ Construct (Luxembourg), interlocuteur : Francis. Décideur : Walter. Utilisateur interne côté DZ : Fares. Chantier pilote : **22.06-Gaichel-Maisons** (ne pas changer).

Le rapport hebdo est généré **le mercredi de la semaine suivante** (créneau configurable), organisé **par jour**, avec **3 chapitres par jour** :
1. Activité des équipes (Traxxeo)
2. Illustrations et explications techniques (Teams, conversation RT)
3. Matériel et bons de livraison (Teams, conversation BL&L)

Pas de couche IA de reformulation : **passthrough strict** des textes et photos (décision actée). Ne jamais inventer de contenu.

## Point de situation — 30/07/2026 (à lire en premier)

**Ce qui tourne en prod (validé en réel) :** rapport hebdo complet — Traxxeo **actif**, 3 chapitres, champs enrichis (qualif · catégorie · matricule ; activité + commentaire), **total du jour**, footer (nom de fichier gauche + `x/y` droite, remonté du bord), **PDF + Word propres** (Word sans « mode de compatibilité »). Cockpit : Dashboard, `/guide`, `/rapports`, `/configuration`, `/debug`, soft-delete, bouton scindé, favicon dz, nouvelle adresse DZ en pied. **Archives mensuelles janv→juil générées** (dossier ZIP unique : `GET /api/archives.zip`).

**Email :** fonctionne via **API Gmail OAuth2** mais depuis un **compte de test** (`vincent@korr.lu`). PAS encore basculé sur une boîte DZ.

**Correctif du 21/08 — photos Teams manquantes (résolu, validé en prod) :** des photos postées dans
Teams n'apparaissaient pas dans le rapport, en silence. Cause : les nœuds `Télécharger images RT`/`BLL`
téléchargeaient les `hostedContents` d'affilée et **Microsoft Graph répondait 429** au-delà d'environ
18 requêtes par ~20 s ; comme ces nœuds sont en `onError: continueRegularOutput`, les photos perdues
disparaissaient et le run restait « Succès ». Corrigé par un **téléchargement par lots de 12 avec pause
de 15 s** (nouveaux nœuds `Lot images RT` + `Patienter RT`, et jumeaux BL&L) et par un **contrôle du
compte** (`nbImagesAttendues` vs `nbImages` dans `Assembler RT`/`BLL` → « Succès partiel » + « N photo(s)
RT non téléchargée(s) » dans le journal). Mesuré sur 25.07 Ecole-Brouch : semaine 22→28/06 passée de
30 à **66/66 photos** ; quinzaine 15→30/06 de 28 à **106 photos RT + 26 BL&L**, sans perte.
**Deux suites traitées dans la foulée (21/08) :**
- **Poids des rapports** : récupérer toutes les photos faisait passer le Word au-delà de 25 Mo (limite
  des pièces jointes email). Les photos étaient inlinées à leur résolution d'origine (~211 Ko,
  1500×2000 px) alors que le rapport les affiche en 84 mm. Ajout des nœuds **`Redimensionner images RT`
  / `BLL`** (Edit Image, 900 px sur le grand côté, JPEG 78) → **59 Ko par photo, 3,6× plus léger, 272 dpi
  à l'impression** (le besoin réel est 150–200) : aucune perte visible. Mesuré sur 20 photos réelles ;
  alternatives écartées : 1200 px (2× seulement, on reste près de la limite) et 800 px (5×, marge plus
  courte que nécessaire).
- **Run hebdo en parallèle** : le quota Graph étant compté **par application**, 4 chantiers simultanés
  se le volaient. `Lancer génération` (workflow `DZ — Rapport hebdo`) est passé en
  **`waitForSubWorkflow: true`** → chantiers traités **un par un**, ~5 min pour les 4 actifs
  (linéaire ensuite : ~15 min si les 14 sont activés). **Ne jamais repasser en parallèle.**

**Côté Microsoft Graph : rien à demander à CBC.** Le 429 sur `hostedContents` est une limite de service
Microsoft, identique pour toute application, non réglable par tenant ; la réponse officielle est le
backoff, ce qui est en place. Écartés : le `$batch` Graph (chaque requête interne compte quand même dans
le quota) et une 2ᵉ app registration (contournement sale, complique la passation). À savoir : le quota
est **par application**, donc le futur `Mail.Send` partagera celui de `DZ-Teams-Extractor` — sans
conséquence (4 mails ne pèsent rien). Le seul levier structurel restant, **si un jour les régénérations
ou les archives deviennent pénibles** : mettre en cache les photos sur le volume du cockpit (indexées par
identifiant de photo) pour ne plus les retélécharger. ⚠️ Ça n'aide **pas** le run hebdo, dont les photos
sont neuves par définition. Non fait, non prioritaire.

**3 chantiers ouverts, pour la prochaine session :**

1. ✅ **Authentification Microsoft — FAITE le 21/08.** CBC (Adrien Olivieri, 17/08) a accordé
   `Mail.Send` sur `DZ-Teams-Extractor` et créé l'app **« DZ – Hub Rapport Technique (login) »**.
   Le login OIDC est codé (`auth.js`), déployé et allumé : le Hub n'accepte plus que les comptes
   `@dzconstruct.lu`. Détail complet dans `docs/BIBLE.md` §8. **Reste à faire par Vincent : le premier
   vrai login avec un compte DZ** (je ne peux pas le tester, il faut des identifiants Microsoft).
   ⚠️ Porte de secours si ça se verrouille : retirer une variable `MS_*` dans Railway rouvre le Hub.
   ⚠️ Le secret client de l'app login **expire** (date fixée par CBC) — à renouveler comme celui de
   l'app Teams. Et il a circulé par mail en clair : à régénérer une fois la config validée.
2. ✅ **Bascule email vers Graph — FAITE le 25/08, pas encore éprouvée par un envoi réel.**
   Le nœud Gmail est remplacé par `Préparer email Graph` (Code) + `Envoyer rapport par Graph` (HTTP
   vers `users/dzconstruct@dzconstruct.lu/sendMail`). `Mail.Send` vérifié présent dans un vrai jeton
   Graph. Le nœud Gmail reste sur le canvas, désactivé et débranché, comme repli.
   ⚠️ **Graph plafonne `sendMail` à 4 Mo** : le rapport est joint sous 3 Mo, sinon le message bascule
   sur les liens seuls **en le disant**. 2 rapports hebdo sur 32 sont concernés.
   **Reste à faire :** un envoi de test réel, puis mettre **`dzconstruct@dzconstruct.lu` en
   destinataire** sur les chantiers actifs et passer leur `mail_actif` à true (décidé avec Francis :
   **1 mail = 1 chantier**, DZ trie ensuite).
   *Reste optionnel côté CBC : la restriction `New-ApplicationAccessPolicy` sur la boîte
   `dzconstruct@dzconstruct.lu`. Adrien craignait qu'elle bride toute l'app — elle ne gouverne que les
   ressources Exchange (Mail, Calendars, Contacts) et n'a aucun effet sur Teams : on peut la poser sur
   `DZ-Teams-Extractor` sans risque, et une app dédiée au mail.send est inutile.*
3. **Bugs remontés par Francis** — Vincent apportera la liste dans la nouvelle session, à traiter.

**Décisions actées avec Francis (30/07) :** archives = 1 gros dossier **mensuel** janv→juil (✅ fait) ; envoi hebdo → **`dzconstruct@dzconstruct.lu`** (1 mail/chantier) ; auth = **tout `@dzconstruct.lu`** ; nouvelle adresse DZ = **195 Z.A.E. Wolser F, L-4026 Bettembourg** (✅ dans les pieds de page). **PDFShift** est passé en **forfait payant** (le gratuit 50/mois ne suffit pas : ~56 PDF/mois en régime hebdo).

**⚠️ Environnement :** le conteneur peut être **recloné** entre sessions (working dir revenu à l'état initial constaté le 30/07) — le vrai état est sur le remote GitHub : au démarrage, `git fetch` puis `git checkout -B claude/roadmap-deployment-t1m07g origin/claude/roadmap-deployment-t1m07g`. Le **MCP n8n peut demander une ré-autorisation** (OAuth) en début de session.

## Architecture en production

### Cockpit web « Hub Rapport Technique »
- Express (`server.js`) + front statique (`public/`), déployé sur **Railway**, URL : `https://cockpit-production-c3dc.up.railway.app`.
- Déploiement : **auto-deploy à chaque push GitHub** sur la branche suivie par le service Railway. Vérifier un déploiement en pollant un marqueur dans les assets déployés (ex. `curl …/styles.css | grep <nouvelle-classe>`), ~30 s après le push.
- Pages : `/` (Dashboard : chantiers, sélecteur de période calendrier, derniers rapports, bloc « Chantiers supprimés » restaurables), `/rapports` (classés par chantier), `/configuration` (créneau du run hebdo + carnet de destinataires), `/guide` (« Comment ça marche ? » — guide intégré : chaîne, nommage Teams, activation chantier, contacts), `/debug` (santé + journal des runs). Favicon : `public/favicon.png` (le « dz » rouge seul, extrait du logo).
- Dashboard : bouton scindé sur chaque chantier — clic principal « Générer le rapport » = **sans** email ; la flèche (visible si le toggle email du chantier est actif) ouvre « Générer et envoyer par email » (`envoyer: true` dans le POST `dz/generer`).
- Rapports stockés sur le **volume Railway monté sur `/app/data`** (persistant entre déploiements). Routes : upload `POST /api/reports/upload?chantier&periode&type=pdf|docx|html`, listing `GET /api/reports`, téléchargement `/reports/:file`, **archives** `GET /api/archives.zip` (un seul ZIP de tous les rapports **mensuels** non vides, classés par chantier ; `?format=pdf` pour PDF seuls ; seuil 92 Ko pour écarter les mois vides — dép. `archiver`).
- **Archives GAMMA générées le 30/07** (one-shot) : rapports mensuels janv→juil pour les 14 chantiers via `scripts/archives.py` (98 générés, 54 avec données, 44 vides écartés du ZIP). Les rapports mensuels vivent sur le volume à côté des hebdo.
- Conversion Word : `POST /api/convert/docx` (lib `html-to-docx`). Le HTML est réécrit pour le Word par **`htmlPourWord()`** (styles inline sur les tableaux, images dimensionnées en CSS `style="width:…"`, icônes base64) ; pied = nom de fichier + n° de page ; le docx est ensuite passé à **`forcerWordModerne()`** (dép. `jszip`) qui injecte `compatibilityMode=15` pour supprimer le « mode de compatibilité » de MS-365.
- Icônes des chapitres : fichiers PNG dans `public/icons/` (equipes, illustrations, materiel), référencés **par URL** dans le HTML du rapport.
- Le reste des routes `/api/*` sont des **proxys vers les webhooks n8n** (chantiers, runs, generer, decouverte, contacts, reglages).

### Workflows n8n (IDs)
- **`DZ — Générer rapport chantier`** (`qZG6Q5LnQSrloeXR`) : sous-workflow appelé par chantier. Chaîne : Config (drapeaux `graph_actif`, `traxxeo_actif`, `pdfshift_actif`, `mail_actif`, `mail_from`, `cockpit_url`) → journalisation début (dz_runs) → Auth Microsoft → lecture BL&L + RT (pagination) → téléchargement/compression images → Auth/Lire/Mapper Traxxeo (**actif**, credential « Traxxeo API ») → `Fusionner sources` → `Préparer rapport` (HTML) → dépôt HTML → PDFShift → dépôt PDF → conversion Word via cockpit → dépôt Word → bilan (Succès / Succès partiel / Erreur) → envoi email éventuel (nœud **Gmail OAuth2** `Envoyer rapport par Gmail`) → journalisation fin. Entrée booléenne `envoyer` : l'email ne part que si `envoyer=true` (cron hebdo, ou option explicite du cockpit) **en plus** des conditions mail_actif ×2 + destinataires + non-démo + fichier produit. ⚠️ Le nœud email **et** la branche « pas d'email » (sortie FALSE du IF) pointent tous deux vers `Journaliser fin` — sinon un run avec email reste bloqué « En cours / Démarrage » (bug corrigé le 15/07 quand l'email a enfin fonctionné).
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
- **Traxxeo** : ✅ **actif en production depuis le 15/07/2026** (offre signée, identifiants = phase de test, credential « Traxxeo API » httpBasicAuth sur `Auth Traxxeo`, `traxxeo_actif=true`, testé sur Gaichel). Contact vendeur = Matthieu ; support = ticket sur www.support.traxxeo.com. Pièges rencontrés à l'activation (ne pas re-découvrir) : (1) le MCP n8n **refuse d'attacher** un credential httpBasicAuth — sélection à la main dans l'UI obligatoire ; (2) l'UI **préaffiche** un credential non enregistré (re-sélectionner + Save + republier) ; (3) un credential d'avant redéploiement n8n peut être **indéchiffrable** (« Credentials could not be decrypted », encryptionKey changée) → re-saisir les valeurs ; (4) l'échec Traxxeo est **silencieux** (chapitre 1 vide, statut Succès). GAMMA seulement après BETA validée.
- **Email** : ✅ **fonctionne via l'API Gmail en OAuth2** (nœud `Envoyer rapport par Gmail`, credential « Gmail account » = compte `vincent@korr.lu`, testé le 15/07 : mail reçu avec PDF joint). Le **SMTP a été abandonné** : Railway bloque le SMTP sortant (timeout systématique) et Google a supprimé les mots de passe d'application. L'API Gmail passe en **HTTPS** (pas bloquée) et **OAuth2** (pas de mot de passe). Le compte korr est un **test** ; la cible DZ est **Microsoft Graph `Mail.Send`** (même logique OAuth2/HTTPS) — voir Passation. Config OAuth Google : projet Google Cloud « DZ Rapport Email », écran de consentement Interne, ID client OAuth Web avec redirect `https://n8n-production-8929d.up.railway.app/rest/oauth2-credential/callback`. Comme Traxxeo, le credential OAuth se **sélectionne à la main** sur le nœud (le MCP ne l'attache pas) et l'autorisation « Sign in with Google » doit être **complétée** (sinon « Unable to sign without access token »).
- **GitHub** : le dépôt contient le cockpit + `docs/BIBLE.md`, l'unique doc technique (architecture, technologies, workflows, données, fragilités, activations Traxxeo/email, exploitation). La doc utilisateur vit dans l'outil (page `/guide`). `MANUEL.md` et `MISE-EN-SERVICE.md` ont été supprimés le 13/07 (contenu fusionné dans BIBLE, `/guide` et les sections Passation/Francis de ce fichier). Tenir BIBLE et `/guide` à jour à chaque évolution.

## Données Traxxeo — acquis

- OAuth2 sur `https://ords.traxxeo.com/oauth/token` (Basic Auth, `grant_type=client_credentials`, form-urlencoded) ; données via `https://ords.traxxeo.com/api/v2/person_hrd` avec `all_data=Y` et `from_date`/`to_date` en `DD/MM/YYYY`.
- Gaichel = WBS `22.06 A` + `22.06 B` (pas de nœud parent `22.06` : filtrer côté code).
- Garder uniquement `work_code_name.trim() === 'Heure travail'` ; exclure « Jour férié », « Congé », « Heure trajet ».
- Dates reçues en `DD/MM/YYYY` → convertir en `YYYY-MM-DD`.
- `user_comment` rempli à ~70 % en prod (`'Calculated'` = vide) ; `declared_vehicle_name` = équipement ; `work_duration` = heures de la ligne. **Ne jamais utiliser « Heures déclarées visibles »** (total journée) comme heures de ligne.
- Doc publique `rest.traxxeo.com` = coquille vide ; la vraie doc est `wiki-api.traxxeo.com`.
- **Inventaire des champs prod (15/07, 508 lignes person_hrd inspectées)** — les champs demandés par Francis existent :
  - Catégorie employeur : `company_name` (`DZ CONSTRUCT`/`ARHIS`/`KENOB`/`IMPULSE`), `person_category_name` (`DZC`/`Arhis`/…/`Étudiants`), `employee_contract_type_name` (`Worker`/`Interim`).
  - Qualification : `qualification_name` (~72 % rempli) — `Coffreur B1/B2/B3/BD`, `Maçon B1-B3`, `Manoeuvre A2`, `Grutier F2`, `Chef d'équipe G1`…
  - Activité (liste finie, distincte de `user_comment`) : `activity_code` + `activity_name` (~90 %, 17 codes : `6-C` Coffrage, `6-B` Bettonage, `4-D` Dallage…) + famille `parent_activity_name` (10 valeurs : `GO BETON & FER COFFRAGE`…).
  - Code personne : `person_erp_id`/`person_identifier` **null même en prod** ; mais `company_nr` est en réalité un **matricule par personne** (086, 165…, ~70 valeurs distinctes) et `person_erp_company_code` = `10`+matricule — ⚠️ à confirmer avec Matthieu que c'est le matricule paie ; ne PAS utiliser `company_nr` comme catégorie société.
  - ⚠️ **Espaces de fin** dans tous les libellés Traxxeo (`"DZC "`, `"Chef de chantier "`) : toujours `trim()`.
  - Autres `work_code_name` vus : `Absence`, `Accident de travail`, `Maladie`, `Heure trajet` — le filtre `'Heure travail'` les exclut correctement.

## Microsoft Graph / Teams — acquis

- Convention de nommage **réelle** des conversations : `-BL&L-` (et non `-BLL-`) et `-RT-` dans le sujet du groupe.
- Pagination messages : `?$top=50` **dans l'URL** (jamais en queryParameters : erreur 400 « $top specified more than once ») ; condition de fin `{{ !$response.body["@odata.nextLink"] }}` — ne référencer **aucun autre nœud** dans les expressions de pagination (échec silencieux).
- Images de messages : `chats/{id}/messages/{msgId}/hostedContents/{hcId}/$value`.
- **Throttling `hostedContents` (mesuré le 21/08)** : Graph plafonne à **~18 requêtes par ~20 s par
  application** et renvoie **429** au-delà ; le quota se recharge tout seul en cours de run. Ralentir le
  débit ne suffit pas (testé à 4/300 ms, 1/500 ms et 1/1500 ms : toujours ~30 photos récupérées sur 66).
  Seule parade efficace : **lots de 12 + pause de 15 s** entre les lots (`splitInBatches` + `Wait`).
  Débit soutenable observé ≈ 0,6 photo/s ; compter ~2 min pour 100 photos.
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
- **`retryOnFail` est inopérant sur un nœud en `onError: continueRegularOutput`** : le nœud avale ses
  erreurs, ne « tombe » jamais, donc n8n ne le rejoue pas. Pour réessayer, il faut une vraie boucle
  (`splitInBatches` + `Wait`) — c'est ce qui est en place sur les téléchargements d'images.
- Un nœud HTTP en `responseFormat: file` **conserve le json d'entrée** (c'est ce qui permet de retrouver
  `date`/`url` sur chaque image) — mais **pas sur les items en échec**, dont le json est remplacé par
  l'objet d'erreur. Ne jamais compter les photos en se fiant aux items de sortie seuls.
- Les exécutions de test avec photos remplissent le Postgres n8n (crash « No space left on device » déjà vécu) : recommandé `EXECUTIONS_DATA_MAX_AGE=168` sur le service n8n (pas encore posé).

### PDFShift / rapport
- Body en mode « Using Fields Below », jamais `JSON.stringify` en mode JSON (erreur 400 « Rogue field ») ; `sandbox=false` en prod.
- CSS `running()` (logo répété par page) ne marche pas : logo première page uniquement.
- **Footer courant de chaque page** (nom de fichier à gauche, `x/y` à droite) : via le paramètre `footer` de PDFShift = objet `{ source, height }`. Le `source` est construit dans `Préparer rapport` (champ `footerHtml`) avec les placeholders **littéraux** `{{page}}` / `{{total}}` que PDFShift remplace — les garder dans la DONNÉE du nœud, pas dans une expression n8n (sinon n8n tente d'évaluer les accolades). Le `.pied` unique de fin a été retiré au profit de ce footer courant.
- **Word (.docx) via `html-to-docx`** : la lib ne comprend qu'un sous-ensemble du CSS (ignore `<style>` et les classes). Le cockpit (`htmlPourWord()` dans `server.js`) réécrit pour le Word : styles **en ligne** sur les tableaux (bordures/padding), et surtout **dimensions d'images en CSS `style="width:…"` — jamais en attributs `width=`/`height=`** (html-to-docx les ignore et prend la taille native : icônes 96px = énormes). Icônes 14px, photos 330px (ratio conservé via largeur seule), logo 220px. Pied Word = 4e argument `footerHTMLString` (nom de fichier) + `pageNumber:true` (numéro) ; le PDF garde le footer PDFShift complet.
- **Saut de page Word entre les jours** : le PDF s'appuie sur `.jour { page-break-before: always }`
  dans le `<style>`, que html-to-docx ignore. `htmlPourWord()` insère un `<div class="page-break"></div>`
  devant chaque `<div class="jour">` — seule forme que la lib traduit en `<w:br w:type="page"/>`.
  ⚠️ Ne **jamais** poser `page-break-after` en style sur le `<div class="jour">` lui-même : la lib
  remplace alors le nœud entier par le saut de page et tout le contenu de la journée disparaît.
- **Total du jour** : ligne `tr.jourtotal` (somme des heures de toutes les personnes) en bas du tableau équipes, en plus des « Total journée » par personne.
- **Ne jamais transcrire du base64 à la main** (corruption systématique constatée) : les icônes sont des fichiers servis par le cockpit, inlinés par code pour le docx. Pour pousser le jsCode de `Préparer rapport` (gros logo base64), vérifier le **sha256** avant/après.

### Cockpit / Railway
- Disque du service éphémère : tout ce qui doit survivre à un déploiement va sur le volume `/app/data`.
- **`auth.js` doit être monté AVANT `express.static`** : sinon les pages HTML sont servies directement
  par le middleware de fichiers statiques et échappent au garde.
- **Ne jamais protéger `/icons/`** : PDFShift va chercher les icônes de chapitre **par URL** pendant la
  fabrication du PDF. Les fermer viderait les rapports de leurs icônes, en silence.
- Variables Railway de l'authentification : `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`,
  `SESSION_SECRET`, `APP_URL`, `AUTH_DOMAINE`, `COCKPIT_TOKEN`, `ACCES_SECOURS` (porte de secours par
  code, celle de Vincent — la retirer la referme) et `ACCES_SECOURS_NOM`. Elles se posent avec le MCP Railway
  (`set-variables`) — chaque écriture déclenche un redéploiement.
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
- Tenir `docs/BIBLE.md` et la page `/guide` alignés avec l'outil.

## État des lots Phase 2

| Lot | État |
|---|---|
| 1 — Champs Traxxeo enrichis | ✅ **Terminé le 15/07, validé en réel.** Les 8 champs de Francis sont dans le rapport : sous-ligne Personne « qualification · catégorie · mat. NNN », cellule Tâche « activité (FR seul, découpe sur " / ") + commentaire libre en sous-ligne ». Reste : confirmer avec Matthieu que `company_nr` = matricule paie |
| 2 — Word (.docx) | ✅ Fait (html-to-docx via cockpit) |
| 3 — Cockpit config + découverte auto | ✅ Fait (Data Tables + scan Teams ; Excel SharePoint abandonné au profit des Data Tables n8n) |
| 4 — Dépôt des rapports | ✅ **Tranché par Francis (30/07)** : les rapports hebdo partent par **email à `dzconstruct@dzconstruct.lu`** (1/chantier), DZ classe ensuite. Pas de dépôt SharePoint direct pour l'instant. Reste : bascule email Graph (attente CBC). |
| 5 — Déclenchement | ✅ Fait (webhook à la demande + cron hebdo configurable) |
| 6 — BETA Gaichel (démo Walter) | **Prêt** (hors envoi email DZ — bascule Graph en attente CBC) |
| 7 — GAMMA (backfill) | ✅ **Fait le 30/07** : archives **mensuelles** janv→juil (ZIP `/api/archives.zip`). *(Format mensuel décidé avec Francis, pas hebdo.)* |

## Roadmap

Fait le 13/07 au soir (session « déploiement roadmap ») :

- ✅ **« Comment ça marche ? »** — page `/guide` intégrée au cockpit (chaîne de bout en bout, contenu du rapport, nommage Teams `-BL&L-`/`-RT-` avec exemples, activation d'un chantier pas à pas, rôle de chaque page, run du mercredi, envoi email, suppression/restauration, contacts Vincent/Benoît/Matthieu). Première version complète rédigée en autonomie : **à faire relire par Vincent**, le contenu s'ajuste dans `public/guide.html`.
- ✅ **Soft-delete des chantiers** — colonne `supprime` dans dz_chantiers ; suppression cockpit = marquage (`supprime=true, actif=false`) ; restauration en un clic (bloc « Chantiers supprimés » du Dashboard) ; run hebdo et scan de découverte ignorent ces lignes. Testé en réel (chantier `00.00-Test-SoftDelete`, id 18, laissé en supprimé comme exemple).
- ✅ **Générer + envoyer en une action** — bouton scindé sur la carte chantier ; drapeau `envoyer` propagé webhook → orchestrateur → générateur (6e condition du IF « Envoi email ? »).
- ✅ **Favicon** — `public/favicon.png` : le « dz » rouge seul.

Reste, par priorité (détail dans « Point de situation » en tête) :

1. **Authentification Microsoft** + **bascule email vers Graph `Mail.Send`** (boîte `dzconstruct@dzconstruct.lu`) — **en attente des credentials CBC** (2 apps, cf. Point de situation). Une fois reçus : coder le login OIDC dans le cockpit, protéger les pages, et remplacer le nœud Gmail par un appel Graph `sendMail` (from = `dzconstruct@dzconstruct.lu`).
2. **Bugs Francis** — à traiter dès que Vincent apporte la liste.
3. **Config envoi hebdo** : mettre `dzconstruct@dzconstruct.lu` en destinataire sur les chantiers actifs + `mail_actif` (à faire au moment d'allumer l'envoi auto, après la bascule Graph).
4. **Relecture du guide `/guide`** par Vincent (et Francis ?), puis en tirer un **manuel PDF** si demandé.
5. *(Qualité, non bloquant)* Remplacer les secrets en clair des nœuds n8n (client_secret Graph dans les 2 `Auth Microsoft`, clé PDFShift dans `Convertir en PDF`) par des credentials n8n — à la main dans l'UI. Et poser `EXECUTIONS_DATA_MAX_AGE=168` (ou `EXECUTIONS_DATA_PRUNE`) sur le service n8n Railway (les archives du 30/07 ont été passées en **lots surveillés** sans toucher à la config, pour ne pas redémarrer n8n — mais le réglage reste souhaitable en production).

**Fait récemment (au-delà du 13/07) :** Traxxeo actif + champs enrichis (15/07) ; email Gmail OAuth2 + fix topologie `Journaliser fin` (15/07) ; retouches rapport suite retours Francis (Word lisible, total du jour, footer nom+`x/y` agrandi/remonté, mode compatibilité Word levé) ; nouvelle adresse DZ ; contacts du guide complétés (CBC `support@cbc.lu`, Traxxeo helpdesk via Fares `dzconstruct@dzconstruct.lu`) ; **archives GAMMA mensuelles janv→juil générées + endpoint `/api/archives.zip`** (30/07).

### Hors périmètre (garder au chaud)
- Bascule conversation Teams → canal : faisable (~mêmes endpoints Graph, quelques heures), uniquement si DZ fait évoluer son usage de Teams. Ne pas anticiper.

## Pour Francis — questions & points fragiles

À dérouler avec Francis (démo BETA fin juillet ou avant). Les réponses conditionnent la fin de la Phase 2.

### Questions — réponses reçues le 30/07 ✅, et ce qui reste ouvert
1. ✅ **Dépôt des rapports (Lot 4)** → **email à `dzconstruct@dzconstruct.lu`** (1/chantier), DZ classe ensuite. Pas de SharePoint direct.
2. ✅ **Adresse expéditrice** → **`dzconstruct@dzconstruct.lu`** (émetteur = destinataire), via Microsoft Graph `Mail.Send`.
5. ✅ **Accès à l'outil** → **tout compte `@dzconstruct.lu`** (auth Microsoft single-tenant).
3. ⏳ **Conversations RT non alimentées** (encore ouvert) : semaine testée = 0 message RT sur les 11 chantiers équipés (BL&L actives). Les équipes savent-elles qu'elles doivent poster les explications techniques dans la conversation RT ? 3 chantiers sans conversation RT du tout (26.06 Maison-OMS, 26.07 MaisonFluhe, 99.02 Chantiers-Divers) — à créer ?
4. ⏳ **Compte assembleur dans chaque conversation** (encore ouvert) : la découverte ne voit que les conversations dont `assembleur@dzconstruct.lu` est membre. Options : (a) règle « toujours inclure assembleur@ à la création » (simple mais fragile) ; (b) basculer vers des **canaux d'équipe Teams** → lecture sans compte invité (~quelques heures). À trancher selon l'usage Teams de DZ.

### Points fragiles à connaître (état au 13/07)
- ✅ **Cockpit fermé** (21/08) : login Microsoft, comptes `@dzconstruct.lu` uniquement. L'URL peut être diffusée. Les fichiers de rapports (`/reports/`) sont protégés eux aussi ; n8n y accède avec un jeton de service (`X-Cockpit-Token`). Si un partage externe devient nécessaire, `RAPPORTS_PUBLICS=true` dans Railway les rouvre.
- **Emails** : bascule sur **Microsoft Graph `sendMail`** depuis `dzconstruct@dzconstruct.lu` (25/08). Le nœud Gmail reste débranché comme repli. ⚠️ Limite Graph de 4 Mo : au-delà, le rapport part sans pièce jointe, avec mention dans le message et dans le journal.
- **Secret Microsoft qui expire** : le client_secret de l'app « DZ-Teams-Extractor » a une date d'expiration fixée par CBC — à renouveler avant échéance sinon plus de lecture Teams (et prévenir Vincent pour la mise à jour dans n8n).
- **Comptes personnels de Vincent** : Railway, PDFShift et le Gmail de test sont sur ses comptes — la passation vers des comptes DZ est décrite dans la section « Passation à DZ » ci-dessous.
- **PDFShift** : ✅ **forfait payant** (le gratuit 50/mois ne suffit pas au régime hebdo ~56 PDF/mois). Chaque PDF = 1 crédit ; surveiller le solde. Option future si on veut supprimer ce coût/ce tiers : auto-héberger la conversion HTML→PDF (Chromium) dans le cockpit — non fait, à ne considérer que si la confidentialité des données RH devient un sujet chez DZ.

## Passation à DZ (séquence technique)

Objectif : plus rien ne dépend des comptes personnels de Vincent. À dérouler dans cet ordre, le moment venu :

1. **Comptes à créer côté DZ** (préalable) : un compte **Railway** avec facturation DZ ; un compte **PDFShift** — le Microsoft est déjà chez DZ (tenant CBC), et la boîte d'envoi retenue est **`dzconstruct@dzconstruct.lu`** (existe déjà).
2. **GitHub** : transférer le repo `vincentrmn/dz` vers une organisation DZ (Settings → Danger Zone → Transfer ownership). Les URLs de clone changent, rien d'autre.
3. **Railway — cockpit** : transférer le projet `dz` vers le workspace DZ (Project → Settings → Transfer project) — le **volume `/app/data` suit le projet** (les rapports sont conservés). Rebrancher ensuite le service sur le repo GitHub transféré (Settings du service → Source) et vérifier la variable `N8N_WEBHOOK_BASE`.
4. **Railway — n8n** : transférer le projet `pacific-endurance` (n8n + Postgres, le volume suit aussi). Alternative propre si le transfert coince : réinstaller n8n chez DZ et réimporter (voir 5).
5. **n8n — export/réimport** (seulement si nouvelle instance) : exporter les 4 workflows en JSON (menu ⋯ → Download) et les Data Tables en CSV ; réimporter ; **republier** chaque workflow ; reporter l'URL de la nouvelle instance dans `N8N_WEBHOOK_BASE` du cockpit.
6. **Credentials à recréer dans n8n côté DZ** : Microsoft Graph (l'app « DZ-Teams-Extractor » est déjà dans le tenant DZ : reporter client_id/secret, CBC peut générer un nouveau secret) ; Traxxeo (identifiants du contrat DZ) ; PDFShift (clé du nouveau compte, à poser dans `Convertir en PDF`) ; envoi email (Graph `Mail.Send` une fois la bascule faite). Renseigner les nœuds `Auth Microsoft` ×2, `Auth Traxxeo`, `Convertir en PDF`.
7. **Accès humains** : ajouter le(s) admin(s) DZ sur Railway, n8n (compte owner), GitHub ; retirer les accès de Vincent à la fin.
8. **Validation post-passation** : une génération manuelle Gaichel (Succès dans Debug, PDF + Word téléchargeables) ; attendre un mercredi (cron OK) ; un envoi email test ; un scan de découverte. Ensuite seulement, fermer les anciens comptes.

Points d'attention : le **secret Microsoft expire** (date fixée par CBC — calendrier de renouvellement) ; les rapports du volume et l'historique dz_runs survivent au transfert de projet Railway mais **pas** à une recréation de service (copier `/app/data` avant si besoin) ; après bascule GitHub, vérifier que l'auto-deploy pointe sur la bonne branche.

## Contrainte budget

Enveloppe facturée : **1 à 2 jours** (choix assumé de Vincent, service à Francis). L'effort réel est supérieur : privilégier systématiquement la solution la plus simple qui remplit le besoin, réutiliser l'existant, ne rien construire de spéculatif.

## Définition of done Phase 2

- Rapport hebdo Gaichel généré automatiquement le mercredi, PDF + Word, chapitres complets avec champs Traxxeo enrichis et totaux journée. ✅ *(Validé en réel le 15/07.)*
- Nouveau chantier activable par configuration (procédure Fares = « Comment ça marche ? »).
- Rapports déposés selon l'option retenue par Francis. *(Reste : décision + implémentation.)*
- Envoi email opérationnel. ✅ *(Gmail OAuth2 validé le 15/07 ; bascule Graph/boîte DZ pour la prod.)*
- Backfill GAMMA depuis janvier 2026 classé. *(Après offre Traxxeo.)*
