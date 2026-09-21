# Architecture, environnement et outils (extrait verbatim de l'ancien CLAUDE.md, 21/09/2026)

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

