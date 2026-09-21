---
paths:
  - "server.js"
  - "auth.js"
  - "public/**"
  - "tests/**"
---

# Cockpit (Hub Rapport Technique) : règles et pièges vérifiés

Contexte : `docs/contexte/architecture.md`, texte d'origine des pièges dans `docs/contexte/pieges.md`.
Tests ciblés : `tests/word.test.js` (chaque défaut vu en prod donne un test).

## Règles absolues
- `auth.js` est monté AVANT `express.static` : sinon les pages HTML sont servies par le middleware
  statique et échappent au garde.
- Ne jamais protéger `/icons/` : PDFShift va chercher les icônes de chapitre par URL pendant la
  fabrication du PDF ; les fermer viderait les rapports de leurs icônes, en silence.
- Tout ce qui doit survivre à un déploiement va sur le volume `/app/data` ; le disque du service
  est éphémère et le service redéploie à chaque push sur `main`.
- Ne jamais transcrire du base64 à la main (corruption systématique) : les icônes sont des fichiers
  de `public/icons/`, inlinés par code pour le docx.
- Ne jamais recopier un secret depuis une capture d'écran ; demander la valeur en texte et la
  valider avant de la poser (`GET /api/health/microsoft` fait ce contrôle en prod).
- Les variables Railway de l'authentification (`MS_*`, `SESSION_SECRET`, `APP_URL`, `AUTH_DOMAINE`,
  `COCKPIT_TOKEN`, `ACCES_SECOURS`, `ACCES_SECOURS_NOM`) se posent avec le MCP Railway ; chaque
  écriture redéploie. Retirer une variable `MS_*` rouvre le Hub (porte de secours).
- L'UI est en français, épurée, palette DZ (`--rouge:#ff110b`, `--gris:#8a8a81`) ; toute évolution
  d'UI se vérifie par capture avant d'être annoncée.
- `server.js` n'écoute que lancé directement (`require.main === module`) : les tests le chargent
  avec `DATA_DIR` temporaire et n'ouvrent aucun port.

## Pièges vérifiés
- Word via `html-to-docx` : la lib ignore `<style>`, les classes et les attributs `width=`/`height=`
  des images. `htmlPourWord()` réécrit tout en styles EN LIGNE ; les dimensions d'images vont dans
  `style="width:…"` (icônes 14 px, photos 330 px, logo 220 px). Sinon les icônes sortent à 96 px.
- Saut de page Word entre les jours : seul un `<div class="page-break"></div>` inséré devant chaque
  `<div class="jour">` est traduit en saut de page. Ne jamais poser `page-break-after` en style sur
  le `div.jour` lui-même : la lib remplace le nœud entier par le saut et la journée disparaît.
- « Mode de compatibilité » Word : `forcerWordModerne()` injecte `compatibilityMode=15` dans
  `word/settings.xml` ; en cas d'échec il rend le docx d'origine, fonctionnel.
- Le footer courant du PDF est fait par PDFShift (`footer` = `{ source, height }`), avec les
  placeholders littéraux `{{page}}`/`{{total}}` posés dans la donnée du nœud n8n, pas dans une
  expression. Le Word garde son propre pied (nom de fichier + `pageNumber:true`).
- Depuis l'environnement de dev distant, Chromium ne sort pas sur Internet : pour vérifier l'UI,
  servir `public/` en local avec des stubs `/api/*` et capturer sur `127.0.0.1`. `curl` sur la prod
  fonctionne. Vérifier un déploiement en pollant un marqueur dans les assets (~30 s après le push).
- Suppression d'un chantier = soft-delete (`supprime=true, actif=false`), restaurable depuis le bloc
  « Chantiers supprimés » ; rapports et historique conservés.
- Archives : `GET /api/archives.zip` ne prend que les rapports MENSUELS non vides (seuil 92 000
  octets sur le PDF) ; `?format=pdf` pour les PDF seuls. Dépendance `archiver`.
