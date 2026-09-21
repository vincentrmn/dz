# Pièges connus, texte d'origine (extrait verbatim de l'ancien CLAUDE.md, 21/09/2026)

Les règles courtes sont dans `.claude/rules/` ; ce fichier garde le texte complet.

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
- Une **vidéo** postée dans Teams arrive par le même `hostedContents` qu'une photo, et casse le
  redimensionnement (GraphicsMagick n'a pas de décodeur vidéo). Elle est écartée à l'extraction sur
  la vue `…/views/video` — ne pas supprimer ce filtre, sinon retour du « Succès partiel » perpétuel.
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
- **Ne jamais recopier un secret depuis une capture d'écran.** Le 21/08, le client_secret de l'app
  login a été transcrit depuis une image : un `I` majuscule lu à la place d'un `l` minuscule. Personne
  ne s'en est aperçu avant que Francis et Fares tombent sur `AADSTS7000215: Invalid client secret`
  une semaine plus tard. Toujours demander la valeur **en texte**, et la **valider avant de la poser** :
  requête `client_credentials` sur `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
  (un jeton renvoyé = secret bon ; `AADSTS7000215` = secret refusé). En prod, `GET /api/health/microsoft`
  fait ce contrôle (route protégée).
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

