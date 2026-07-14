# La Bible — Rapport Technique DZ Construct

*Référence technique complète de l'outil : architecture, technologies, workflows, données, fragilités, exploitation.*
*Version au 13/07/2026. Public : Vincent, un successeur technique, ou un lecteur curieux chez DZ/CBC.*

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
| Heures | API Traxxeo (ORDS, OAuth2 client_credentials) | Endpoint `person_hrd` : lignes de pointage par personne/jour/WBS | Contrat DZ–Traxxeo, accès API payant (Matthieu) — **inactif en attendant l'offre** |
| HTML → PDF | PDFShift (service SaaS) | Convertit le HTML du rapport en PDF fidèle | Clé du POC (compte Vincent), crédits payants |
| HTML → Word | Librairie `html-to-docx` dans le Hub | Endpoint `POST /api/convert/docx`, icônes inlinées en base64 avant conversion | Aucun compte, tourne dans le Hub |
| Email | Nœud SMTP n8n (bloqué) → bascule prévue Microsoft Graph `Mail.Send` | Envoi du rapport (liens + PDF joint) aux destinataires du chantier | Voir « Fragilités » |
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
3. **Lancement en parallèle.** Pour chaque chantier sélectionné, l'orchestrateur lance le sous-workflow
   `DZ — Générer rapport chantier` sans attendre la fin (chaque chantier vit sa vie).
4. **Journal « En cours ».** Le sous-workflow écrit immédiatement une ligne dans `dz_runs`
   (chantier, période, statut « En cours ») — c'est ce qu'affiche la page Debug.
5. **Lecture Teams.** Authentification Graph (token applicatif), puis lecture **paginée** des messages
   des deux conversations (BL&L et RT) sur la période, téléchargement des images hébergées
   (`hostedContents`) et compression.
6. **Lecture Traxxeo** *(quand `traxxeo_actif=true`)*. Token OAuth2, puis `person_hrd` sur la période,
   filtré sur les WBS du chantier et sur `work_code_name = 'Heure travail'` (on exclut congés, trajets,
   jours fériés). Calcul des totaux par personne et par jour.
7. **Assemblage.** Le nœud `Fusionner sources` regroupe tout par jour ; `Préparer rapport` génère le
   HTML final (logo, page de garde, icônes de chapitres servies par le Hub, tableaux d'heures, photos).
8. **Conversions et dépôt.** Le HTML part chez PDFShift (→ PDF) et vers le Hub (`/api/convert/docx`,
   → Word). Les trois fichiers (aperçu HTML, PDF, Word) sont déposés sur le Hub via
   `POST /api/reports/upload` et stockés sur le **volume Railway `/app/data`** (persistant).
   Régénérer la même période **remplace** les fichiers (pas de doublon).
9. **Bilan.** Statut final calculé : Succès / Succès partiel (une conversion a échoué) / Erreur.
10. **Email éventuel.** Six conditions cumulatives : interrupteur général `mail_actif` (nœud Config)
    + toggle email du chantier + destinataires non vides + pas en mode démo + fichier produit
    + `envoyer=true` (cron hebdo ou demande explicite du Hub).
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
- Pages : `/` (Dashboard), `/rapports`, `/configuration`, `/guide`, `/debug`.

## 8. Sécurité et accès

- **Le Hub est public** pour l'instant (pas de login) : ne pas diffuser l'URL. L'authentification
  Microsoft (Entra ID, comptes DZ uniquement, liste d'utilisateurs assignés) est la priorité n°3 de la
  roadmap ; l'app registration sera créée par CBC.
- **Les secrets vivent dans n8n**, jamais dans le repo GitHub. (Chantier qualité en cours : déplacer
  les derniers secrets en clair des nœuds vers des credentials n8n.)
- **Graph** : permissions applicatives de lecture seule Teams (Chat.Read.All, Files.Read.All,
  Team.ReadBasic.All, Channel.ReadBasic.All) sur l'app « DZ-Teams-Extractor » ; `Mail.Send` en cours
  d'ajout pour l'envoi d'emails.
- **Data Tables** : accessibles via les webhooks `dz/api/*`, eux-mêmes publics — même remarque que pour
  le Hub, l'authentification à venir fermera l'ensemble.

## 9. Fragilités connues et parades

| Fragilité | Détail | Parade |
|---|---|---|
| Compte assembleur requis dans chaque conversation | La découverte ne voit que les conversations dont `assembleur@dzconstruct.lu` est membre : une conversation créée sans lui est invisible | Règle d'usage à la création (voir `/guide`) ; ou bascule vers des canaux d'équipe Teams (lecture sans compte membre, ~quelques heures d'adaptation) — décision Francis |
| Envoi SMTP bloqué | Railway bloque le SMTP sortant : timeout systématique, quelle que soit la config Gmail | Bascule vers Microsoft Graph `Mail.Send` (HTTPS, OAuth2, expéditeur DZ) — demande faite à CBC |
| Secret Microsoft expirant | Le client_secret de l'app Graph a une date d'expiration fixée par CBC | Calendrier de renouvellement avec Benoît ; mise à jour ensuite dans les nœuds `Auth Microsoft` |
| Traxxeo inactif | Accès API payant, offre en attente : chapitre 1 vide | Signature de l'offre, puis 2 minutes d'activation (voir §10 « Activations restantes ») |
| Comptes personnels | Railway, PDFShift, Gmail de test appartiennent à Vincent | Séquence de passation complète dans `CLAUDE.md`, section « Passation à DZ » |
| Crédits PDFShift | Chaque PDF consomme des crédits payants | Surveiller le solde ; budgéter le backfill GAMMA |
| Disque Postgres n8n | Les exécutions de test avec photos remplissent la base (crash « No space left on device » déjà vécu, volume agrandi à 5 GB) | Poser `EXECUTIONS_DATA_MAX_AGE=168` sur le service n8n (7 jours de rétention) — pas encore fait |
| Run bloqué « En cours » | Si un nœud plante « dur », la ligne `dz_runs` n'est jamais clôturée | Diagnostic via n8n → Executions ; amélioration possible (statut Échec automatique) non prioritaire |
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

**Traxxeo, le jour où l'offre est signée (2 min)** :
1. n8n → workflow « DZ — Générer rapport chantier » → nœud `Auth Traxxeo` → sélectionner le
   credential Basic Auth existant du POC.
2. Nœud `Config` → `traxxeo_actif` → `true` → sauvegarder → **publier**.
3. Tester : Hub → Gaichel → « Générer le rapport » sur une semaine pointée → le chapitre 1 doit se
   remplir. ⚠️ Ne pas lancer le backfill GAMMA avant validation : chaque génération interroge l'API.

**Envoi email (après la bascule Microsoft Graph `Mail.Send`)** :
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
