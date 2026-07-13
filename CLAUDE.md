# CLAUDE.md — Rapport Technique DZ Construct — Phase 2 (mise en production)

## Contexte

POC validé (rapport « ALPHA » présenté à Walter et aux collègues de DZ Construct, accueil positif). On passe en Phase 2 : industrialisation du rapport hebdomadaire par chantier. Client : DZ Construct (Luxembourg), interlocuteur : Francis. Chantier pilote : **22.06-Gaichel-Maisons** (ne pas changer).

Le rapport hebdo est généré **le mercredi de la semaine suivante**, organisé **par jour**, avec **3 chapitres par jour** :
1. Activité des équipes (Traxxeo)
2. Illustrations et explications techniques (Teams, conversation RT)
3. Matériel et bons de livraison (Teams, conversation BLL)

## État actuel (fin POC)

Workflow n8n fonctionnel de bout en bout :
- Microsoft Graph API lit les 2 conversations de groupe Teams (compte `assembleur@dzconstruct.lu`) : pipelines BLL et RT en parallèle (parseurs, extraction URLs, téléchargement images, compression, assembleurs).
- Traxxeo intégré : OAuth2 sur `https://ords.traxxeo.com/oauth/token` (Basic Auth, `grant_type=client_credentials`, form-urlencoded), données via `https://ords.traxxeo.com/api/v2/person_hrd` avec `all_data=Y`.
- `Fusionner sources` fusionne les 3 sources par date ; `Préparer rapport` génère le HTML complet (images base64 inline, logo DZ) ; PDFShift convertit en PDF (sandbox désactivé).
- Pas de couche IA de reformulation : passthrough strict des textes et photos (décision actée).

## Environnement & outils

- **n8n v2.16.0** self-hosted sur Railway. Un serveur MCP n8n est disponible (`https://n8n-production-8929d.up.railway.app/mcp-server/http`) — l'utiliser pour inspecter/modifier les workflows quand c'est possible ; sinon travailler sur exports JSON du workflow fournis par Vincent.
- **PDFShift** pour HTML→PDF.
- **Microsoft Graph** : permissions actives Chat.Read.All, Files.Read.All, Team.ReadBasic.All, Channel.ReadBasic.All. Tenant géré par CBC Informatique (Benoît Herbays).
- **Traxxeo** : contact vendeur = Matthieu. ⚠️ L'accès API est désormais **payant** (fin des 3 semaines offertes) : ne rien lancer de massif (backfill GAMMA) avant confirmation de l'offre commerciale.

## Données Traxxeo — acquis

- Gaichel = WBS `22.06 A` + `22.06 B` (pas de nœud parent `22.06` : filtrer côté code).
- Garder uniquement `work_code_name.trim() === 'Heure travail'` ; exclure « Jour férié », « Congé », « Heure trajet ».
- Dates reçues en `DD/MM/YYYY` → convertir en `YYYY-MM-DD`.
- `user_comment` rempli à ~39 % sur Gaichel avec `all_data=Y` (= « Tâche » dans le rapport).
- `declared_vehicle_name` = équipement utilisé (déjà disponible).
- `work_duration` = heures de la ligne. **Ne jamais utiliser « Heures déclarées visibles »** (total journée) comme heures de ligne.

## Pièges connus (ne pas re-découvrir)

- n8n stocke le binaire en références filesystem : utiliser `getBinaryDataBuffer()`, jamais lire `.data` directement.
- Éviter le nœud Merge pour des branches de tailles différentes : utiliser `$('NomDuNœud').all()` dans un nœud Code.
- `Préparer rapport` lit `$('Fusionner sources')` directement, pas `$input`.
- PDFShift : body en mode « Using Fields Below », jamais `JSON.stringify` en mode JSON (erreur 400 « Rogue field »).
- CSS `running()` (logo répété par page) ne marche pas sous PDFShift : logo première page uniquement.
- Normaliser les clés de date avec `.substring(0, 10)` (contamination inter-jours sinon).
- Doc publique `rest.traxxeo.com` = coquille vide ; la vraie doc est `wiki-api.traxxeo.com`.

## Conventions de travail

- Communication en **français**, registre informel, explications simples sans jargon.
- **Une action à la fois, confirmation avant de continuer.** Jamais de batch d'étapes sans accord explicite.
- Les nœuds n8n sont référencés par leur **nom exact français** (accents et casse) : `Fusionner sources`, `Préparer rapport`, `Lire messages BLL`, `Lire activité Traxxeo`, `Mapper activité Traxxeo`…
- Ne pas rouvrir de décisions closes. Pas d'analyse non sollicitée.
- Vincent n'est pas développeur pur : donner des instructions opérationnelles précises (quel nœud, quel champ, quel code à coller).
- **Jamais de secrets dans le repo ni dans les fichiers** (tokens, client_secret, tenant ID). Les credentials vivent dans n8n.

## Périmètre Phase 2 — lots (dans l'ordre)

### Lot 1 — Champs Traxxeo complémentaires
Enrichir le chapitre « Activité des équipes » :
- Personne-Nom (`person_name`) — déjà fait.
- Commentaires (`user_comment`) — déjà fait.
- Heures (`work_duration`) — déjà fait ; **ajouter le TOTAL journée par personne** sous les heures.
- Équipement (`declared_vehicle_name`) — à ajouter au template.
- À **vérifier auprès de Traxxeo/Matthieu** avant de coder (les champs sont vides ou absents dans `person_hrd` actuel) :
  - Personne-Code (`person_erp_id` / `person_identifier` sont null sur l'échantillon)
  - Personne-Catégorie DZC vs intérim (piste : `company_nr` par ligne + table de correspondance)
  - Personne-Qualif (coffreur, manœuvre, B1, B2…) — champ non identifié
  - Activité issue d'une liste finie (coffrage, ferraillage, sécurité, DfMA…) — champ non identifié

### Lot 2 — Génération Word (.docx) en plus du PDF
Même contenu que le PDF. Piste : conversion HTML→docx (lib côté n8n Code node ou service), ou génération docx native. Choisir la voie la plus robuste et maintenable.

### Lot 3 — Cockpit léger (configuration chantiers + découverte auto)
La configuration des chantiers vit dans un **fichier Excel sur le SharePoint DZ** (ou une liste SharePoint — trancher selon la facilité côté Graph API), lu par n8n. Colonnes : `nom chantier | codes WBS Traxxeo | ID conversation BLL | ID conversation RT | actif O/N`.
- Le run hebdo génère les rapports de **tous les chantiers actifs** (boucle sur les lignes actif=O).
- **Workflow « Découverte chantiers »** (hebdo) : scanne les conversations Teams accessibles au compte assembleur (motifs `-BLL-` / `-RT-` dans le nom) et les WBS apparaissant dans Traxxeo ; toute nouveauté est pré-remplie dans le fichier avec `actif=N`. Fares n'a qu'à passer la ligne à `O` (procédure d'une page à rédiger).
- Attention à l'hétérogénéité des codes (`CH:22-06 B` côté Teams vs `22.06 B` côté Traxxeo) : normaliser avant rapprochement, et laisser le rapprochement final à validation humaine (c'est pour ça que les lignes découvertes arrivent en actif=N).

### Lot 4 — Dépôt des rapports
Deux options (décision Francis en attente) :
- (a) répertoire tampon géré par le secrétariat
- (b) dépôt direct dans les répertoires ad hoc
Les deux passent par Graph API → SharePoint/OneDrive. Implémenter après décision.

### Lot 5 — Déclenchement
- BETA : déclenchement manuel/à la demande (webhook n8n).
- Production : cron **mercredi matin** sur la semaine N-1 (lundi→dimanche précédents).

### Lot 6 — BETA Gaichel
Rapport BETA complet (lots 1-2 intégrés) à montrer à Walter **dernière semaine de juillet**.

### Lot 7 — GAMMA (backfill)
Après validation BETA + offre Traxxeo signée : génération des rapports hebdo **depuis début 2026** pour classement pendant les congés d'août. Attention volumétrie (PDFShift, historique Teams : les semaines antérieures à l'usage de Teams auront peu/pas de photos — c'est attendu, ne pas « corriger »).

### Hors périmètre (garder au chaud)
- Bascule conversation Teams → canal : faisable (~mêmes endpoints Graph, quelques heures), uniquement si DZ fait évoluer son usage de Teams. Ne pas anticiper.
- **Cockpit web** (« Hub Rapport Technique » V1) : liste des rapports, génération à la demande, toggles — chiffré à part (~3 j), à proposer après la rentrée si le besoin se confirme. Le Lot 3 en couvre l'essentiel fonctionnel sans interface.

## Contrainte budget

Enveloppe facturée : **1 à 2 jours** (choix assumé de Vincent, service à Francis). L'effort réel estimé est supérieur (~20-30h) : privilégier systématiquement la solution la plus simple qui remplit le besoin, réutiliser l'existant, ne rien construire de spéculatif.

## Définition of done Phase 2

- Rapport hebdo Gaichel généré automatiquement le mercredi, PDF + Word, chapitres complets avec champs enrichis et totaux journée.
- Nouveau chantier activable par configuration (procédure Fares rédigée).
- Rapports déposés selon l'option retenue par Francis.
- Backfill GAMMA depuis janvier 2026 classé.
