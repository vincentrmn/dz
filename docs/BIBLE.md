# La Bible — Rapport Technique DZ Construct

*Référence technique complète de l'outil : architecture, technologies, workflows, données, fragilités, exploitation.*
*Version au 21/08/2026. Public : Vincent, un successeur technique, ou un lecteur curieux chez DZ/CBC.*

Les autres documents : la page **`/guide`** du Hub (« Comment ça marche ? », la doc utilisateur,
intégrée à l'outil) et **`CLAUDE.md`** (le pilotage du projet : roadmap, questions pour Francis,
séquence de passation). Ce document-ci est le niveau en dessous : **comment c'est construit et pourquoi**.

---

## 1. Le besoin, en une phrase

Chaque semaine, DZ Construct doit produire un **rapport technique par chantier**, organisé **jour par
jour**, qui rassemble ce qui existe déjà ailleurs : les **heures pointées dans Traxxeo** et les
**photos/messages postés dans Teams**. L'outil automatise cet assemblage, sans reformulation ni ajout :
**passthrough strict** — ce que les équipes ont écrit est ce qui apparaît, l'outil n'invente jamais rien.

Chaque rapport contient, pour chaque jour de la période, trois chapitres :
1. **Activité des équipes** (Traxxeo) : personne, tâche, équipement, heures, total journée par personne.
2. **Illustrations et explications techniques** (conversation Teams « RT »).
3. **Matériel et bons de livraison** (conversation Teams « BL&L »).

## 2. Vue d'ensemble de l'architecture

```
  Équipes chantier                    Moteur (n8n sur Railway)                   Utilisateur DZ
┌──────────────────┐       ┌────────────────────────────────────────┐       ┌─────────────────────┐
│ Teams (photos,   │──────▶│  4 workflows :                         │──────▶│ Hub Rapport         │
│ messages)        │ Graph │  · DZ — Rapport hebdo (orchestrateur)  │ HTTP  │ Technique (cockpit) │
│                  │       │  · DZ — Générer rapport chantier       │       │ cockpit-production- │
│ Traxxeo (heures) │──────▶│  · DZ — Découverte chantiers           │       │ c3dc.up.railway.app │
│                  │ ORDS  │  · DZ — Cockpit API                    │       │                     │
└──────────────────┘  API  │  + 4 Data Tables (config & journal)    │       │ PDF + Word + aperçu │
                           └────────────────────────────────────────┘       │ + envoi email       │
                                        │ PDFShift (HTML→PDF)               └─────────────────────┘
                                        │ cockpit /api/convert/docx (HTML→Word)
```

Deux applications hébergées sur **Railway** (cloud), dans le compte de Vincent :
- le **Hub** (projet Railway `dz`, service `cockpit`) : l'interface web + le stockage des rapports ;
- **n8n** (projet Railway `pacific-endurance`) : le moteur d'automatisation qui fait tout le travail,
  avec sa base **Postgres**.

Le code du Hub vit sur **GitHub** (`vincentrmn/dz`) ; chaque push sur la branche suivie par Railway
redéploie automatiquement le service en ~30 secondes. Les workflows n8n, eux, vivent dans n8n
(exportables en JSON).

## 3. Les technologies, une par une

| Brique | Techno | Rôle exact | Compte / accès |
|---|---|---|---|
| Hub (cockpit) | Node.js + Express, front statique HTML/CSS/JS sans framework | Interface web, proxy vers n8n, stockage et distribution des rapports, conversion Word | Railway (compte Vincent), code sur GitHub |
| Moteur | n8n v2.16 self-hosted | Orchestration : lecture des sources, assemblage HTML, conversions, dépôt, email, journal | Railway (compte Vincent) |
| Config & journal | Data Tables n8n (tables intégrées à n8n, stockées dans son Postgres) | `dz_chantiers`, `dz_runs`, `dz_contacts`, `dz_reglages` | Via n8n ou via le Hub |
| Lecture Teams | Microsoft Graph API (permissions applicatives) | Liste des conversations du compte assembleur, messages, images | App « DZ-Teams-Extractor », tenant DZ géré par CBC (Benoît Herbays) |
| Heures | API Traxxeo (ORDS, OAuth2 client_credentials) | Endpoint `person_hrd` : lignes de pointage par personne/jour/WBS | Contrat DZ–Traxxeo (Matthieu) — **actif depuis le 15/07/2026**, credential n8n « Traxxeo API » |
| HTML → PDF | PDFShift (service SaaS) | Convertit le HTML du rapport en PDF fidèle | Clé du POC (compte Vincent), crédits payants |
| HTML → Word | Librairie `html-to-docx` dans le Hub | Endpoint `POST /api/convert/docx`, icônes inlinées en base64 avant conversion | Aucun compte, tourne dans le Hub |
| Email | **Microsoft Graph `sendMail`** (permission applicative `Mail.Send`) | Envoi du rapport (liens + fichier joint) aux destinataires du chantier, depuis `dzconstruct@dzconstruct.lu` | App « DZ-Teams-Extractor », `Mail.Send` accordée par CBC le 17/08/2026. Le nœud Gmail (compte `vincent@korr.lu`) reste sur le canvas, **désactivé et débranché**, comme repli. SMTP définitivement écarté (Railway le bloque + fin des mots de passe d'app Google) |
| Hébergement | Railway | Les deux services + volume persistant + Postgres n8n | Compte Vincent (passation prévue) |
| Code source | GitHub `vincentrmn/dz` | Hub + docs + copie de référence du workflow générateur | Compte Vincent |

## 4. Le cycle de vie d'un rapport, pas à pas

Ce qui se passe le mercredi à 7 h (ou lors d'un clic sur « Générer le rapport ») :

1. **Déclenchement.** Le workflow `DZ — Rapport hebdo` a un cron qui se réveille **toutes les heures**
   et compare l'heure du Luxembourg au créneau stocké dans `dz_reglages` (`run_hebdo`, défaut mercredi 7 h,
   réglable dans la page Configuration). Si ça matche : c'est parti pour la **semaine précédente**
   (lundi → dimanche). Le bouton du Hub appelle le même workflow via le webhook `dz/generer`, avec la
   période choisie et le drapeau `envoyer` (true seulement via « Générer et envoyer par email »).
2. **Sélection des chantiers.** Lecture de `dz_chantiers` : tous les chantiers `actif=true` (cron) ou le
   chantier nommé (manuel). Les lignes `supprime=true` sont toujours exclues.
3. **Lancement séquentiel.** L'orchestrateur lance le sous-workflow `DZ — Générer rapport chantier`
   **un chantier après l'autre** (`waitForSubWorkflow: true`). Ne pas repasser en parallèle : le quota
   Graph sur les photos est compté **par application**, donc des chantiers simultanés se le volent et
   perdent des photos. Compter ~5 min pour 4 chantiers actifs.
4. **Journal « En cours ».** Le sous-workflow écrit immédiatement une ligne dans `dz_runs`
   (chantier, période, statut « En cours ») — c'est ce qu'affiche la page Debug.
5. **Lecture Teams.** Authentification Graph (token applicatif), puis lecture **paginée** des messages
   des deux conversations (BL&L et RT) sur la période, puis téléchargement des images hébergées
   (`hostedContents`). Ce téléchargement se fait **par lots de 12 avec une pause de 15 s entre chaque
   lot** (nœuds `Lot images RT` / `Patienter RT`, et leurs jumeaux BL&L) : Microsoft Graph plafonne les
   `hostedContents` autour de 18 requêtes par ~20 s et rejette le reste en **429**. Voir §9.
   Chaque photo est ensuite **redimensionnée à 900 px** sur son grand côté, en JPEG qualité 78
   (nœuds `Redimensionner images RT` / `BLL`). Le rapport les affiche en 84 mm de large, soit 272 dpi
   à l'impression pour un besoin réel de 150–200 : aucune perte visible, et ~3,6× moins lourd
   (211 Ko → 59 Ko par photo). Sans ça, une semaine chargée produit un Word de plus de 25 Mo,
   au-dessus de la limite des pièces jointes email.
6. **Lecture Traxxeo** *(quand `traxxeo_actif=true`)*. Token OAuth2, puis `person_hrd` sur la période,
   filtré sur les WBS du chantier et sur `work_code_name = 'Heure travail'` (on exclut congés, trajets,
   jours fériés). Calcul des totaux par personne et par jour.
7. **Assemblage.** Le nœud `Fusionner sources` regroupe tout par jour ; `Préparer rapport` génère le
   HTML final (logo, page de garde, icônes de chapitres servies par le Hub, tableaux d'heures, photos).
8. **Conversions et dépôt.** Le HTML part chez PDFShift (→ PDF) et vers le Hub (`/api/convert/docx`,
   → Word). Les trois fichiers (aperçu HTML, PDF, Word) sont déposés sur le Hub via
   `POST /api/reports/upload` et stockés sur le **volume Railway `/app/data`** (persistant).
   Régénérer la même période **remplace** les fichiers (pas de doublon).
9. **Bilan.** Statut final calculé : Succès / Succès partiel / Erreur. « Succès partiel » couvre une
   conversion en échec **et** des photos annoncées par Teams mais non téléchargées (`Assembler RT` /
   `Assembler BLL` comparent `nbImagesAttendues` à `nbImages`).
10. **Email éventuel.** Six conditions cumulatives : interrupteur général `mail_actif` (nœud Config)
    + toggle email du chantier + destinataires non vides + pas en mode démo + fichier produit
    + `envoyer=true` (cron hebdo ou demande explicite du Hub). L'envoi passe par **Microsoft Graph
    `sendMail`** depuis la boîte `dzconstruct@dzconstruct.lu` (`Config.mail_from`), avec le jeton
    applicatif de `DZ-Teams-Extractor`.
    ⚠️ **Graph plafonne `sendMail` à 4 Mo, pièce jointe encodée comprise.** Le nœud
    `Préparer email Graph` joint donc le rapport quand il tient sous 3 Mo, et bascule sinon sur les
    seuls liens **en le disant dans le message**. Sur 32 rapports hebdo mesurés, la médiane est à
    0,07 Mo et 2 dépassent la limite : les chantiers les plus actifs. Joindre systématiquement
    exigerait une session d'envoi en plusieurs morceaux (brouillon + upload par tranches + envoi),
    bien plus lourde — à faire seulement si DZ juge la pièce jointe indispensable partout.
11. **Journal final.** La ligne `dz_runs` est complétée : statut, étape, URLs PDF/Word, statistiques
    (« BLL : 5 message(s), 11 photo(s)… »).

## 5. Les quatre workflows n8n

| Workflow | ID | Déclencheurs | Ce qu'il fait |
|---|---|---|---|
| DZ — Rapport hebdo | `5su1DOeswBlCdakw` | Webhook `dz/generer` + cron horaire (créneau configurable) | Orchestrateur : calcule la période, sélectionne les chantiers, lance le générateur pour chacun |
| DZ — Générer rapport chantier | `qZG6Q5LnQSrloeXR` | Appelé par l'orchestrateur (sous-workflow) | Toute la chaîne du §4, étapes 4 à 11 |
| DZ — Découverte chantiers | `49okCW9O85lYsP3r` | Cron lundi 06:30 + webhook `dz/decouverte` (bouton Scan) | Parcourt les conversations Teams du compte assembleur, repère `-BL&L-`/`-BLL-`/`-RT-` dans les noms, normalise les codes chantier (`CH:22-06 B` → `22.06 B`), crée les nouveaux chantiers **inactifs**, complète les IDs manquants des existants, ignore les supprimés |
| DZ — Cockpit API | `FCZLzT8cabm3s3GE` | 7 webhooks `dz/api/*` | Le « backend » du Hub : lecture/écriture des chantiers (dont suppression soft et restauration), journal des runs, contacts, réglages |

Règle d'or n8n : après toute modification d'un workflow, **le publier** (sinon la modif n'est pas active).
Une copie de référence du générateur est archivée dans le repo (`n8n/dz-generer-rapport.workflow.mjs`).

## 6. Les données

### Data Tables n8n
| Table | ID | Contenu |
|---|---|---|
| `dz_chantiers` | `6LXQADAq7StJE6TN` | La configuration : nom, wbs (séparés par `;`), conversation_bll, conversation_rt, emails (séparés par `;`), mail_actif, actif, source (`pilote`/`decouverte`/`cockpit`), notes, supprime |
| `dz_runs` | `9HVj9380Vw6DulOr` | Le journal : chantier, période, statut, étape, message, stats, pdf_url, docx_url, declenchement, horodatages |
| `dz_contacts` | `OQfO7bWw9oSYba7g` | Le carnet de destinataires : nom, email |
| `dz_reglages` | `B9TiHAJqJbOJXUNe` | Clé/valeur ; `run_hebdo` = `{"jour": 3, "heure": 7}` |

### Fichiers
Les rapports vivent sur le **volume Railway** monté sur `/app/data` du service cockpit — ils survivent
aux redéploiements. Nommage : `<chantier>__<debut>_<fin>.<pdf|docx|html>` (les caractères spéciaux du
nom sont remplacés par `_`). Le disque hors volume est **éphémère** : tout ce qui doit survivre va sur
le volume.

### Ce qui n'est stocké nulle part
Les photos Teams ne sont pas archivées séparément : elles sont téléchargées au moment de la génération
et embarquées dans les fichiers produits. Supprimer une conversation Teams fait donc perdre la matière
première des périodes non encore générées.

## 7. Le Hub en détail

- `server.js` (Express) : sert `public/`, expose les routes, ne parle jamais au navigateur en direct
  de n8n (le front appelle `/api/*` du Hub, qui **proxifie** vers les webhooks n8n — une seule origine,
  pas de CORS, et l'URL n8n reste côté serveur).
- Routes propres au Hub (pas proxifiées) : `/api/health` (santé), `/api/convert/docx` (Word),
  `/api/reports/upload`, `/api/reports` (listing), `/reports/:file` (téléchargement).
- Front : HTML/CSS/JS vanilla, palette DZ (`--rouge:#ff110b`, `--gris:#8a8a81`), aucune dépendance
  front, favicon = le « dz » rouge.
- Pages : `/` (Dashboard), `/rapports`, `/configuration`, `/guide`, `/debug`, plus `/login`
  (page de connexion) et les routes `/auth/*` de l'authentification Microsoft — voir §8.
- `auth.js` : authentification Microsoft. Monté **avant** `express.static`, sinon les pages HTML
  seraient servies par le middleware de fichiers statiques sans passer par le garde.

## 8. Sécurité et accès

### Authentification Microsoft du Hub (depuis le 21/08/2026)

Le Hub est fermé : il faut un compte **@dzconstruct.lu** pour entrer. Le code vit dans `auth.js`.

- **Flux** : OpenID Connect « authorization code », client confidentiel, sur l'app Entra ID
  **« DZ – Hub Rapport Technique (login) »** (single-tenant, créée par CBC). Permissions déléguées
  `openid` / `profile` / `email` / `User.Read`, URI de redirection `…/auth/callback`.
- **Contrôles à l'entrée** : émetteur, audience, tenant, expiration et nonce du jeton d'identité, puis
  domaine de l'adresse. La signature du jeton n'est pas revérifiée car il est récupéré directement
  auprès de Microsoft en HTTPS avec le secret client — OpenID Connect Core §3.1.3.7 l'autorise dans ce
  cas précis (flux code, client confidentiel).
- **Session** : cookie signé HMAC-SHA256, 8 heures, aucun stockage serveur. Le disque du service
  Railway est éphémère et le service redéploie à chaque push : une session en mémoire serait perdue à
  chaque déploiement.
- **Interrupteur** : l'authentification ne s'active que si `MS_TENANT_ID`, `MS_CLIENT_ID`,
  `MS_CLIENT_SECRET` et `SESSION_SECRET` sont toutes présentes dans les variables Railway. En retirer
  une rouvre le Hub — c'est la porte de secours si on se verrouille dehors.
- **Restent ouverts, et c'est voulu** : `/icons/` (PDFShift va chercher les icônes de chapitre PAR URL
  au moment de fabriquer le PDF — les protéger viderait les rapports de leurs icônes),
  `/api/convert/docx` et `/api/reports/upload` (appelés par n8n, n'exposent aucune donnée),
  `/api/health`, et les ressources de la page de connexion.
- **Jeton de service** : l'en-tête `X-Cockpit-Token` (variable `COCKPIT_TOKEN`) ouvre l'accès aux
  appels machine. Utilisé par le nœud n8n `Télécharger rapport pour email`, qui récupère le PDF sur
  `/reports/` pour le joindre à l'email hebdomadaire — sans lui, il ramènerait la page de connexion.
- **Fichiers de rapports** : `/reports/` est protégé. Les emails portent le PDF en pièce jointe, les
  liens ne sont qu'un confort. `RAPPORTS_PUBLICS=true` les rouvre si un partage externe devient
  nécessaire.
- **Accès de secours par code** : la page de connexion propose, sous le bouton Microsoft, un champ
  « code d'accès ». Il ouvre exactement la même session signée. Il existe parce qu'une adresse
  extérieure au tenant DZ — celle de Vincent, en `korr.lu` — est refusée par Microsoft **en amont**,
  avant tout contrôle de notre côté : aucune liste d'exceptions dans le cockpit n'y changerait rien.
  Le code vit dans `ACCES_SECOURS` (et le nom affiché dans `ACCES_SECOURS_NOM`) ; **retirer la
  variable referme la porte** et la fait disparaître de la page. Comparaison à temps constant, et 8
  tentatives par quart d'heure et par IP au maximum. C'est une porte de service, pas un mode d'accès
  normal : un code partagé ne vaut pas un compte nominatif. À retirer le jour où Vincent est invité
  dans le tenant DZ, ou à la passation.
- **Contrôle du secret** : `GET /api/health/microsoft` (route protégée) demande un jeton applicatif à
  Microsoft et répond « ok », « refusé : secret invalide », « refusé : secret expiré », ou le code
  AADSTS renvoyé. Le secret de l'app login a une date d'expiration fixée par CBC : sans ce contrôle,
  la panne se découvre par un utilisateur bloqué devant un message AADSTS, ce qui est arrivé le
  28/08/2026.
- **Déconnexion** : locale (le cookie du Hub est effacé). La session Microsoft du navigateur reste
  ouverte — fermer la session côté Microsoft exigerait d'enregistrer une URI de post-déconnexion dans
  l'app Entra ID.

### Le reste

- **Les secrets vivent dans n8n et dans les variables Railway**, jamais dans le repo GitHub. (Chantier
  qualité en cours : déplacer les derniers secrets en clair des nœuds n8n vers des credentials.)
- **Graph** : permissions applicatives de lecture seule Teams (Chat.Read.All, Files.Read.All,
  Team.ReadBasic.All, Channel.ReadBasic.All) sur l'app « DZ-Teams-Extractor », plus **`Mail.Send`**
  (accordée par CBC le 17/08/2026) pour l'envoi des rapports.
- **Data Tables** : accessibles via les webhooks `dz/api/*`, eux-mêmes publics. Le navigateur ne les
  appelle plus qu'à travers le Hub, désormais fermé — mais les webhooks restent joignables en direct
  si on connaît leur URL. Point à traiter si le sujet devient sensible.

## 9. Fragilités connues et parades

| Fragilité | Détail | Parade |
|---|---|---|
| Se verrouiller hors du Hub | Une erreur de configuration Entra ID (secret expiré, URI de redirection modifiée) rendrait le Hub inaccessible à tout le monde | Retirer une des variables `MS_*` ou `SESSION_SECRET` dans Railway rouvre le Hub immédiatement. Le secret client de l'app login a une date d'expiration fixée par CBC : à renouveler comme celui de l'app Teams |
| Compte assembleur requis dans chaque conversation | La découverte ne voit que les conversations dont `assembleur@dzconstruct.lu` est membre : une conversation créée sans lui est invisible | Règle d'usage à la création (voir `/guide`) ; ou bascule vers des canaux d'équipe Teams (lecture sans compte membre, ~quelques heures d'adaptation) — décision Francis |
| Pièce jointe absente sur les gros rapports | Graph refuse un `sendMail` au-delà de 4 Mo : les semaines très fournies partent avec les liens seuls | Le message le dit explicitement, et le journal `dz_runs` note « email envoyé sans pièce jointe ». Si la pièce jointe devient indispensable partout : session d'envoi en plusieurs morceaux |
| Secret Microsoft expirant | Le client_secret de l'app Graph a une date d'expiration fixée par CBC | Calendrier de renouvellement avec Benoît ; mise à jour ensuite dans les nœuds `Auth Microsoft` |
| Échec Traxxeo silencieux | Si l'auth ou l'API Traxxeo échoue, le chapitre 1 sort vide avec un statut Succès (les nœuds absorbent l'erreur) | Surveiller « Traxxeo : N ligne(s) » dans les stats de la page Debug ; N=0 sur une semaine travaillée = anomalie |
| Comptes personnels | Railway, PDFShift, Gmail de test appartiennent à Vincent | Séquence de passation complète dans `CLAUDE.md`, section « Passation à DZ » |
| Crédits PDFShift | Chaque PDF consomme des crédits payants | Surveiller le solde ; budgéter le backfill GAMMA |
| Disque Postgres n8n | Les exécutions de test avec photos remplissent la base (crash « No space left on device » déjà vécu, volume agrandi à 5 GB) | Poser `EXECUTIONS_DATA_MAX_AGE=168` sur le service n8n (7 jours de rétention) — pas encore fait |
| Run bloqué « En cours » | Si un nœud plante « dur », la ligne `dz_runs` n'est jamais clôturée | Diagnostic via n8n → Executions ; amélioration possible (statut Échec automatique) non prioritaire |
| Plafond Graph sur les photos | `hostedContents` est limité à ~18 requêtes par ~20 s **par application** : au-delà, Graph répond 429. Les nœuds de téléchargement absorbent l'erreur (`onError: continueRegularOutput`), donc une photo perdue disparaît sans bruit | Téléchargement **par lots de 12 avec pause de 15 s** (`Lot images RT` + `Patienter RT`, idem BL&L) ; et surtout **contrôle du compte** : si des photos manquent, le run passe en « Succès partiel » avec « N photo(s) RT non téléchargée(s) ». Ne jamais remettre ces nœuds en téléchargement direct |
| Poids des rapports | Les photos sont inlinées en base64 dans le HTML : sans redimensionnement, une semaine chargée dépasse 25 Mo en Word, au-dessus de la limite des pièces jointes email | Redimensionnement à 900 px / JPEG 78 dans le workflow (`Redimensionner images RT`/`BLL`). Surveiller le poids des fichiers sur la page Rapports quand une semaine est très fournie |
| Pagination Graph | Pièges connus (`$top` dans l'URL uniquement, pas d'autre nœud référencé dans les expressions de pagination) | Documenté dans CLAUDE.md « Pièges connus » — ne pas retoucher ces nœuds sans relire |

## 10. Exploitation courante

- **Suivre un run** : page Debug (auto-refresh 15 s). Statuts : En cours / Succès / Succès partiel / Erreur.
- **Comprendre un échec** : n8n → workflow « DZ — Générer rapport chantier » → Executions → le run en
  erreur montre le nœud fautif et le message exact. L'« Aide au diagnostic » en bas de la page Debug
  couvre les cas classiques (Traxxeo, Graph, PDFShift).
- **Redéployer le Hub** : pousser sur la branche GitHub suivie par Railway (déploiement auto ~30 s), ou
  Railway → service cockpit → Redeploy. Les rapports ne bougent pas (volume).
- **Modifier un workflow** : dans n8n, puis **Publier**. Tester ensuite via une génération manuelle sur
  Gaichel avant de laisser tourner le cron.
- **Sauvegardes** : le code est sur GitHub ; les workflows s'exportent en JSON depuis n8n ; les Data
  Tables s'exportent en CSV ; les rapports se copient depuis le volume. Aucune sauvegarde automatique
  externe à ce jour — à considérer lors de la passation.
- **Ajouter/retirer un chantier, régler le créneau, gérer les destinataires** : tout se fait dans le
  Hub, voir la page `/guide`.

### Activations restantes (une fois, le moment venu)

**Traxxeo — ✅ activé et validé le 15/07/2026** (offre signée, credential « Traxxeo API »,
`traxxeo_actif=true`, test Gaichel 06-12/07 : 37 lignes, chapitre 1 complet). Pour mémoire, les trois
pièges rencontrés à l'activation : l'API n8n refuse d'attacher un credential httpBasicAuth (sélection
à la main dans l'UI) ; l'UI préaffiche un credential non enregistré (re-sélectionner + Save +
republier) ; un credential chiffré avec une ancienne encryptionKey est indéchiffrable (re-saisir les
valeurs). Un échec Traxxeo reste **silencieux** (chapitre 1 vide, statut Succès quand même).
⚠️ Ne pas lancer le backfill GAMMA avant validation BETA : chaque génération interroge l'API.

**Envoi email — ✅ opérationnel via l'API Gmail OAuth2** (testé le 15/07 depuis `vincent@korr.lu`,
mail reçu avec PDF joint). Le nœud `Envoyer rapport par Gmail` (type Gmail, credential « Gmail account »)
remplace l'ancien SMTP. Config OAuth Google Cloud : écran de consentement Interne, ID client OAuth Web,
redirect `https://n8n-production-8929d.up.railway.app/rest/oauth2-credential/callback`. Deux pièges à
l'activation : le credential OAuth se **sélectionne à la main** sur le nœud (le MCP ne l'attache pas),
et l'autorisation « Sign in with Google » doit être **complétée** jusqu'au vert « connected » (sinon
« Unable to sign without access token »). Piège de topologie corrigé : le nœud email **et** la branche
FALSE du IF « Envoi email ? » pointent vers `Journaliser fin` (sinon un run avec email reste « En cours »).

**Bascule vers l'adresse DZ (Microsoft Graph `Mail.Send`)** — pour la prod :
1. n8n → « DZ — Générer rapport chantier » → nœud `Config` : vérifier `mail_from` (l'expéditeur DZ
   choisi avec Francis) puis `mail_actif` → `true` → **publier**.
2. Dans le Hub : activer le toggle « Envoyer par email » des chantiers concernés + cocher les
   destinataires.
3. Tester avec « Générer et envoyer par email » sur Gaichel, vers une seule adresse d'abord.
   Rappel des 6 conditions d'envoi : voir §4 étape 10. Le mode démo n'envoie jamais.

## 11. Ce qui reste ouvert

La roadmap à jour vit dans `CLAUDE.md` (section Roadmap + section « Pour Francis »). En résumé au
13/07 : bascule email vers Graph (avec CBC), authentification Microsoft du Hub (avec CBC), relecture du
guide, décision Francis sur le dépôt final (Lot 4), activation Traxxeo (offre Matthieu), backfill GAMMA
après BETA, manuel PDF final.

## 12. Glossaire express

| Terme | Définition |
|---|---|
| **Workflow** | Un enchaînement d'étapes automatisées dans n8n (lire, transformer, envoyer…) |
| **Webhook** | Une URL qui déclenche un workflow quand on l'appelle |
| **Cron** | Un déclencheur qui se réveille à heure fixe |
| **WBS** | Le code de découpage d'un chantier dans Traxxeo (ex. `22.06 A`) |
| **Graph** | L'API de Microsoft pour lire Teams (et bientôt envoyer les emails) |
| **Data Table** | Une petite table de données intégrée à n8n (notre configuration et notre journal) |
| **Volume** | Le disque persistant attaché au service Railway (nos rapports) |
| **Passthrough** | Principe fondateur : recopier fidèlement, ne jamais reformuler ni inventer |
