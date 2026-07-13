# Hub Rapport Technique — DZ Construct (Phase 2)

Cockpit web de pilotage de la génération des rapports techniques hebdomadaires par chantier.
Fonctionne en tandem avec les workflows n8n (instance Railway `n8n-production-8929d`).

## Ce que fait cette application

- **Dashboard** (`/`) : liste des chantiers (table n8n `dz_chantiers`), activation/désactivation,
  édition des codes WBS et des IDs de conversations Teams, génération à la demande
  (semaine au choix), mode démo, liste et téléchargement des rapports générés.
- **Page debug** (`/debug`) : santé du système, journal des générations (table n8n `dz_runs`),
  aide au diagnostic.
- **Service de conversion Word** (`POST /api/convert/docx`) : HTML → `.docx`, appelé par le
  workflow n8n « DZ — Générer rapport chantier » (Lot 2).
- **Dépôt tampon des rapports** (`POST /api/reports/upload`, `GET /reports/...`) : stockage des
  PDF / Word / aperçus HTML en attendant la décision de Francis sur le dépôt final (Lot 4).

## Variables d'environnement (Railway)

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port HTTP (géré par Railway) |
| `N8N_WEBHOOK_BASE` | `https://n8n-production-8929d.up.railway.app/webhook` | Base des webhooks n8n |
| `DATA_DIR` | `./data` | Répertoire de stockage des rapports — monter un volume Railway dessus |

## Architecture n8n (Phase 2)

| Workflow | Rôle |
|---|---|
| `DZ — Rapport hebdo` | Orchestrateur : cron mercredi 07:00 (semaine N-1) + webhook `dz/generer` ; boucle sur les chantiers actifs |
| `DZ — Générer rapport chantier` | Sous-workflow : Traxxeo + Teams BLL/RT → Fusionner sources → Préparer rapport (HTML) → PDF (PDFShift) + Word (cockpit) → dépôt + journal |
| `DZ — Découverte chantiers` | Scan hebdo des conversations Teams (`-BLL-`/`-RT-`) et des WBS Traxxeo → nouvelles lignes `actif=N` |
| `DZ — Cockpit API` | Webhooks `dz/api/chantiers`, `dz/api/runs` consommés par ce cockpit |

Voir `docs/MISE-EN-SERVICE.md` pour les étapes de branchement des credentials
(Microsoft Graph, Traxxeo, PDFShift) et l'activation des sources.
