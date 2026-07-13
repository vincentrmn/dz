# Mise en service — Rapport Technique DZ Construct (Phase 2)

État au 13/07/2026 : toute la chaîne est construite, publiée et testée en mode démo.
Il reste **4 branchements manuels** (impossibles à faire par API) avant la BETA réelle.

## 1. Domaine public du cockpit (2 min) — bloquant

Le service Railway `cockpit` (projet `dz`) est déployé et fonctionnel, mais sans domaine public.

1. Railway → projet **dz** → service **cockpit** → Settings → Networking → **Generate Domain**.
2. Copier l'URL obtenue (ex : `https://cockpit-production-xxxx.up.railway.app`).
3. Dans n8n, ouvrir **DZ — Générer rapport chantier** → nœud **Config** → remplacer la valeur
   de `cockpit_url` (actuellement `https://COCKPIT-URL-A-DEFINIR.up.railway.app`) → sauvegarder → publier.

Optionnel mais recommandé : ajouter un **volume** Railway monté sur `/app/data` au service
cockpit pour que les rapports survivent aux redéploiements.

Le service Railway `dz` d'origine (qui suit la branche `main`) peut être supprimé ou gardé :
`cockpit` suit la branche `claude/adoring-bardeen-35fld7` ; après merge vers `main`,
rebrancher `cockpit` sur `main` dans ses Settings.

## 2. Récupérer les acquis du POC (5 min) — fortement recommandé

Le workflow **« POC DZ rapport technique »** n'est pas accessible par MCP (toggle désactivé),
je n'ai donc pas pu réutiliser : les **IDs des conversations Teams** BLL/RT de Gaichel, les
**noms exacts des champs Traxxeo** (WBS, date) dans `person_hrd`, ni la clé PDFShift.

→ Dans n8n, liste des workflows → carte « POC DZ rapport technique » → menu ⋯ →
**activer l'accès MCP** (ou m'envoyer l'export JSON). Je recale alors les parseurs,
les IDs de conversations et le mapping Traxxeo en quelques minutes.

En attendant, « Mapper activité Traxxeo » teste plusieurs noms de champs candidats
(`wbs`, `wbs_code`, `project_code`…) — ça fonctionnera probablement tel quel, mais à valider.

## 3. Credentials n8n (une fois chacun)

| Credential à créer | Type n8n | Paramètres | Puis |
|---|---|---|---|
| **Microsoft Graph DZ** | OAuth2 API (générique) | Grant type : Client Credentials · Access Token URL : `https://login.microsoftonline.com/<TENANT>/oauth2/v2.0/token` · Scope : `https://graph.microsoft.com/.default` · Authentication : Body | à sélectionner sur les nœuds Teams des workflows « Générer rapport chantier » et « Découverte chantiers », puis `graph_actif = true` dans leurs nœuds Config |
| **Traxxeo API** ⚠️ après signature de l'offre | OAuth2 API (générique) | Grant type : Client Credentials · Access Token URL : `https://ords.traxxeo.com/oauth/token` · Authentication : Header (= Basic) | nœud « Lire activité Traxxeo », puis `traxxeo_actif = true` |
| **PDFShift** | Basic Auth | user `api`, mot de passe = clé API PDFShift | nœud « Convertir en PDF », puis `pdfshift_actif = true` |

Les drapeaux `graph_actif` / `traxxeo_actif` / `pdfshift_actif` vivent dans le nœud **Config**
de « DZ — Générer rapport chantier » (et `graph_actif` dans « Config découverte »).
Tant qu'un drapeau est à `false`, la source est proprement ignorée — le rapport sort quand même
avec ce qui est disponible (aperçu HTML + Word toujours générés).

## 4. IDs des conversations Teams de Gaichel

Deux options :
- automatique : une fois Graph branché, bouton **« Lancer la découverte »** du cockpit
  (les conversations `-BLL-` / `-RT-` remontent préremplies) ;
- manuelle : coller les IDs (`19:…@thread.v2`) du POC dans la carte Gaichel du cockpit.

## Ce qui tourne déjà (testé)

- Cockpit : dashboard chantiers, page Debug, conversion Word, dépôt des rapports.
- Workflows n8n publiés : `DZ — Rapport hebdo` (webhook + cron mercredi 07:00, semaine N-1),
  `DZ — Générer rapport chantier`, `DZ — Cockpit API`, `DZ — Découverte chantiers` (cron lundi 06:30).
- Data Tables n8n : `dz_chantiers` (config, Gaichel préremplie), `dz_runs` (journal Debug).
- Mode **Démo** de bout en bout (rapport complet avec données d'exemple).

## Identifiants techniques

| Élément | ID |
|---|---|
| Workflow générateur | `qZG6Q5LnQSrloeXR` |
| Workflow orchestrateur | `5su1DOeswBlCdakw` |
| Workflow API cockpit | `FCZLzT8cabm3s3GE` |
| Workflow découverte | `49okCW9O85lYsP3r` |
| Data table chantiers | `6LXQADAq7StJE6TN` |
| Data table runs | `9HVj9380Vw6DulOr` |
| Service Railway cockpit | `9521b395-17d6-4acf-ac50-f46a315a2dcd` (projet `dz`) |

## Reste à faire (lots suivants)

- **Lot 4** (dépôt SharePoint/OneDrive) : en attente de la décision de Francis — le dépôt
  tampon actuel du cockpit fait l'intérim.
- **Lot 6** (BETA Walter, fin juillet) : brancher Graph + PDFShift, générer une vraie semaine Gaichel.
- **Lot 7** (GAMMA backfill 2026) : après offre Traxxeo signée — boucler sur les semaines via
  `POST /webhook/dz/generer` avec `date_debut`/`date_fin`.
- Config chantiers dans Excel/SharePoint (Lot 3 d'origine) : la table n8n + cockpit couvre le
  besoin sans interface Excel ; si Francis exige le fichier SharePoint, on remplace le loader.
