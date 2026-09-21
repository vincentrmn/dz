---
paths:
  - "n8n/**"
  - "scripts/**"
---

# Workflows n8n, Graph, Traxxeo, PDFShift : règles et pièges vérifiés

À lire aussi avant toute modification d'un workflow vivant par le MCP n8n (les workflows ne sont
pas dans le dépôt : `n8n/dz-generer-rapport.workflow.mjs` est une copie de référence datée).
Contexte : `docs/contexte/traxxeo.md`, `docs/contexte/microsoft-graph-teams.md`,
`docs/contexte/pieges.md` (texte d'origine).

## Règles absolues
- Après chaque `update_workflow` : `publish_workflow`, sinon la modification n'est pas active.
- Passthrough strict des textes et photos : ne jamais inventer ni reformuler du contenu.
- `Lancer génération` (DZ — Rapport hebdo) reste en `waitForSubWorkflow: true` : les chantiers sont
  traités un par un parce que le quota Graph est compté par application. Ne jamais repasser en parallèle.
- Ne jamais supprimer le filtre des vidéos à l'extraction (`Extraire images RT`/`BLL`, vue
  `…/views/video`) : sinon retour du « Succès partiel » perpétuel.
- Ne jamais remettre les téléchargements d'images en direct : lots de 12 + pause de 15 s
  (`Lot images RT` + `Patienter RT`, jumeaux BL&L), et contrôle `nbImagesAttendues` vs `nbImages`.
- Nœuds référencés par leur nom exact français (`Fusionner sources`, `Préparer rapport`, `Config`…).
- Traxxeo : garder uniquement `work_code_name.trim() === 'Heure travail'` ; `work_duration` = heures
  de la ligne, jamais « Heures déclarées visibles » ; dates `DD/MM/YYYY` → `YYYY-MM-DD` ; `trim()`
  sur tous les libellés (espaces de fin) ; `company_nr` n'est pas une catégorie société.
- Pas de secrets dans le dépôt : les credentials vivent dans n8n.

## Pièges vérifiés
- Binaire n8n = références filesystem : `getBinaryDataBuffer()`, jamais `.data` directement.
- Après un nœud Code, `$('Node').item` casse : utiliser `$('Node').first().json`. `Préparer rapport`
  lit `$('Fusionner sources')` directement, pas `$input`.
- Éviter le nœud Merge pour des branches de tailles différentes : `$('Nœud').all()` dans un Code.
- Le MCP n8n refuse d'attacher un credential httpBasicAuth ou OAuth2 : laisser le nœud sans
  credential et le faire sélectionner à la main dans l'UI (puis Save + republier).
- Expressions dans les params bruts : chaînes préfixées `=`. Clés de date normalisées avec
  `.substring(0, 10)`. Semaine lundi→dimanche par calcul ISO (règle du 4 janvier).
- `retryOnFail` est inopérant sur un nœud en `onError: continueRegularOutput` ; pour réessayer, une
  vraie boucle `splitInBatches` + `Wait`.
- Un HTTP en `responseFormat: file` conserve le json d'entrée, sauf sur les items en échec : ne
  jamais compter les photos sur les items de sortie seuls.
- Graph `hostedContents` : ~18 requêtes par ~20 s par application, 429 au-delà ; ralentir ne
  suffit pas, seuls les lots + pause marchent (~0,6 photo/s, ~2 min pour 100 photos).
- Pagination Graph : `?$top=50` dans l'URL (jamais en queryParameters) ; fin sur
  `{{ !$response.body["@odata.nextLink"] }}` sans référencer d'autre nœud (échec silencieux).
- L'échec Traxxeo est silencieux (chapitre 1 vide, statut Succès) : surveiller « Traxxeo : N ligne(s) »
  dans le journal ; un WBS mal orthographié dans la fiche vide aussi le chapitre 1.
- PDFShift : body en « Using Fields Below », jamais `JSON.stringify` en mode JSON (« Rogue field ») ;
  `sandbox=false` en prod ; `running()` CSS ne marche pas (logo première page seulement).
- Pour pousser le jsCode de `Préparer rapport` (gros logo base64) : vérifier le sha256 avant/après.
- Les exécutions de test avec photos remplissent le Postgres n8n (« No space left on device » déjà
  vécu) : `EXECUTIONS_DATA_MAX_AGE=168` reste à poser sur le service n8n.
