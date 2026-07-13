# Mise en service — Rapport Technique DZ Construct (Phase 2)

État au 13/07/2026 : chaîne complète **opérationnelle en production** — Teams (Graph) et PDFShift
branchés, rapport réel généré et déposé. Le manuel d'utilisation est dans `docs/MANUEL.md`.

## Ce qui tourne (testé en réel)

- **Cockpit** `https://cockpit-production-c3dc.up.railway.app` : chantiers, page Rapports (classement
  par chantier), page Debug, conversion Word, dépôt des rapports.
- **Workflows n8n publiés** :
  - `DZ — Rapport hebdo` — webhook `dz/generer` + **cron mercredi 07:00** (semaine N-1, chantiers actifs) ;
  - `DZ — Générer rapport chantier` — Traxxeo + Teams BLL/RT → HTML (logo, icônes, totaux journée)
    → PDF (PDFShift) + Word (cockpit) → dépôt → email (optionnel) → journal `dz_runs` ;
  - `DZ — Découverte chantiers` — **cron lundi 06:30** + bouton du cockpit, Graph branché ;
  - `DZ — Cockpit API` — endpoints du cockpit.
- **Microsoft Graph** : token applicatif (app « DZ-Teams-Extractor », tenant DZ géré par CBC),
  repris du POC — nœuds `Auth Microsoft`. Les secrets vivent dans n8n uniquement, jamais dans ce repo.
- **PDFShift** : clé du POC en place, `pdfshift_actif = true` (sandbox désactivé = crédits payants).
- **IDs conversations Gaichel** : préremplis depuis le POC.
- **Mapping Traxxeo** : calé sur les champs réels du POC (`wbs_ref_number`, `date_day`,
  `user_comment` avec le cas « Calculated », `declared_vehicle_name`, `work_duration`)
  + `from_date`/`to_date` automatiques. En attente d'activation (voir ci-dessous).

## Restes à faire

### 1. Volume Railway (2 min) — sinon les rapports disparaissent à chaque déploiement

Le stockage des rapports est sur le disque du conteneur, effacé à chaque redéploiement du cockpit.

Dans Railway (`railway.com`) → projet **dz** :
1. Sur le canvas du projet, **clic droit sur le service `cockpit`** → **Attach Volume**
   *(autre chemin : bouton « + Create » en haut à droite → Volume → choisir le service `cockpit`)*.
2. **Mount path** : `/app/data` → confirmer. Railway redéploie le service tout seul.
3. Vérifier ensuite : page Debug du cockpit → « Stockage rapports » doit rester vert,
   et les rapports survivent désormais aux déploiements.

### 2. Traxxeo — le jour où l'offre est signée (2 min)

1. n8n → workflow **DZ — Générer rapport chantier** → nœud **`Auth Traxxeo`** →
   sélectionner le credential Basic Auth existant du POC (« Unnamed credential »).
2. Nœud **`Config`** → `traxxeo_actif` → `true` → sauvegarder → **publier**.
3. Tester : cockpit → Gaichel → « Générer le rapport » sur une semaine pointée →
   le chapitre 1 doit se remplir.

⚠️ Ne pas lancer le backfill GAMMA (toute l'année) avant validation de l'offre : chaque
génération interroge l'API Traxxeo.

### 3. Envoi par email — pour l'activer (5 min)

La mécanique est en place (destinataires par chantier dans le cockpit, pièce jointe + liens).
Elle est **désactivée par défaut** pour éviter tout envoi accidentel.

1. n8n → **DZ — Générer rapport chantier** → nœud **`Config`** :
   - `mail_from` : vérifier/adapter l'expéditeur (doit correspondre au compte SMTP utilisé) ;
   - `mail_actif` → `true`.
2. Le nœud **`Envoyer rapport par email`** utilise le credential **« SMTP account »** existant —
   pour la passation à DZ, le remplacer par un SMTP DZ (voir plus bas).
3. Renseigner le champ « Envoi par email » des chantiers concernés dans le cockpit, puis publier.

Le mode démo n'envoie jamais d'email.

## Passation à DZ Construct (quand le moment viendra)

Objectif : que plus rien ne dépende des comptes personnels de Vincent. Dans l'ordre :

1. **Comptes à créer côté DZ** : un compte Railway (avec facturation DZ), un compte PDFShift
   (la clé actuelle est celle du POC), et une boîte d'envoi SMTP DZ (ex. `rapports@dzconstruct.lu`
   via l'Exchange géré par CBC).
2. **Railway** : transférer les projets `dz` (cockpit) et l'instance n8n vers le workspace DZ
   (Railway : Project → Settings → Transfer project), ou redéployer proprement chez DZ —
   le cockpit se redéploie depuis GitHub en quelques minutes, n8n s'exporte/importe.
3. **GitHub** : transférer le repo `vincentrmn/dz` à une organisation DZ
   (Settings → Danger Zone → Transfer ownership) et rebrancher le service Railway dessus.
4. **n8n** : les 4 workflows s'exportent en JSON (menu ⋯ → Download) et se réimportent tels quels ;
   recréer les credentials chez DZ (Graph : l'app « DZ-Teams-Extractor » est déjà dans le tenant DZ,
   il suffit de reporter client_id/secret ; Traxxeo : identifiants du contrat DZ ; SMTP DZ ;
   nouvelle clé PDFShift) et re-renseigner les nœuds `Auth Microsoft` / `Auth Traxxeo` / PDF / email.
5. **Rien d'autre à migrer** : la configuration des chantiers et le journal vivent dans les
   Data Tables n8n (exportables), les rapports dans le volume du cockpit.

Point d'attention : le secret de l'app Microsoft expire (durée définie par CBC à la création) —
prévoir son renouvellement dans le tenant (CBC/Benoît Herbays) et sa mise à jour dans les
nœuds `Auth Microsoft`.

## Identifiants techniques

| Élément | ID |
|---|---|
| Workflow générateur | `qZG6Q5LnQSrloeXR` |
| Workflow orchestrateur | `5su1DOeswBlCdakw` |
| Workflow API cockpit | `FCZLzT8cabm3s3GE` |
| Workflow découverte | `49okCW9O85lYsP3r` |
| Data table chantiers | `6LXQADAq7StJE6TN` (colonnes : nom, wbs, conversation_bll, conversation_rt, emails, mail_actif, actif, source, notes, supprime) |
| Data table runs | `9HVj9380Vw6DulOr` |
| Service Railway cockpit | `9521b395-17d6-4acf-ac50-f46a315a2dcd` (projet `dz`, branche `claude/adoring-bardeen-35fld7`) |

Drapeaux du nœud `Config` (workflow générateur) : `graph_actif=true`, `pdfshift_actif=true`,
`traxxeo_actif=false` (offre en attente), `mail_actif=false` (à activer volontairement).

Depuis le 13/07 au soir, le générateur reçoit aussi une entrée booléenne **`envoyer`** :
le cron hebdo la passe à `true` (envoi automatique), une génération manuelle à `false`
sauf si le cockpit demande explicitement « Générer et envoyer par email » (bouton scindé).
La suppression d'un chantier est un **soft-delete** (colonne `supprime` de dz_chantiers) :
la ligne est conservée, masquée du Dashboard, ignorée par le run hebdo et par le scan de
découverte, et restaurable depuis le bloc « Chantiers supprimés » du Dashboard.

## Questions ouvertes

- **Pour Francis** : pourquoi les conversations RT ne sont-elles pas alimentées par les équipes ?
  (test du 13/07 sur la semaine 06-12/07 : 0 message RT sur les 11 chantiers qui ont une
  conversation RT, alors que les BL&L sont actives — 57 messages, 61 photos au total).
  Et 3 chantiers n'ont pas de conversation RT du tout : 26.06 Maison-OMS, 26.07 MaisonFluhe,
  99.02 Chantiers-Divers.
- **Pour Francis** (Lot 4) : dépôt final des rapports — tampon secrétariat ou SharePoint chantier ?

## Lots suivants

- **Lot 4** (dépôt SharePoint/OneDrive) : en attente de la décision de Francis — le dépôt
  tampon du cockpit fait l'intérim (`GET /reports/...`).
- **Lot 6** (BETA Walter, fin juillet) : choisir une semaine avec activité RT ; idéalement Traxxeo actif.
- **Lot 7** (GAMMA backfill 2026) : après offre Traxxeo — boucler sur les semaines via
  `POST /webhook/dz/generer` avec `date_debut`/`date_fin` (je fournirai le script au moment voulu).
- Après merge de la branche vers `main` : rebrancher le service Railway `cockpit` sur `main`
  (Settings du service) et supprimer l'ancien service `dz` vide.
  ⚠️ Depuis le 13/07 au soir, la branche de travail à jour est **`claude/roadmap-deployment-t1m07g`**
  (elle contient tout `claude/adoring-bardeen-35fld7` + guide `/guide`, soft-delete, bouton scindé,
  favicon) : c'est elle qu'il faut merger vers `main` — ou rebrancher le service Railway dessus.
