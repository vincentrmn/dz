# Plan : un rapport par jour en plus du rapport de la semaine, envoyés ensemble le mercredi

Écrit le 23/11/2026 par `/cadrer`, validé par Vincent le 23/11/2026. Mise en service : mercredi 25/11/2026.
Un plan tient sur une page. Il dit ce qu'on construit, ce qu'on ne construit
pas, et comment on saura que c'est fini. Rien ici n'est du code.

## Contexte

DZ veut recevoir pour chaque chantier, dans le mail du mercredi (créneau `run_hebdo`), le rapport de la
semaine et un rapport par jour. Le générateur `qZG6Q5LnQSrloeXR` lit Traxxeo et Teams une fois.
`Fusionner sources` range tout par jour. `Préparer rapport` fait un seul HTML, sans les samedis ni les
dimanches vides. Tout ce qui suit lit `$("Préparer rapport").first()` en `executeOnce` : dépôt HTML, PDF,
Word. `Préparer email Graph` joint un seul fichier (moins de 3 Mo, sinon des liens, en le disant). `Bilan email`
trace l'envoi dans l'unique ligne `dz_runs`. Hub : les fichiers sont nommés `<chantier>__<période>.<type>`
(`server.js`, upload). `public/rapports.js` et la liste du Dashboard (`public/app.js`) font une ligne par
période. `MOIS_RE` ne met que les mois dans le ZIP. Décisions qui s'appliquent : 30/07 (1 mail = 1 chantier)
et 25/09 (chaque run dit si le mail est parti). Lot 2 du plan mails (« Dernier run », badge orange) : pas
construit, et ce plan n'en dépend pas.

## Décision

Dans le même run, à partir de la même extraction, le générateur produit le document de la semaine puis un
document par jour. `Préparer rapport` rend N+1 éléments. La boucle `Lot documents` (même motif que
`Lot images RT`) les fait passer un par un dans la chaîne existante. Un seul mail joint le tout. Graph n'est lu
qu'une fois, `dz_runs` garde une ligne par chantier, l'orchestrateur ne bouge pas. Pas d'interrupteur (choix de
Vincent) : la mise en service se fait directement, pour le mercredi 25/11. Garde-fou : le générateur n'est
publié que si ses tests locaux passent. S'il n'est pas vérifié en prod mardi soir, on republie la version
`e8bc88ae-bdf7-48ea-a068-a4d106f4ef8d` (active depuis le 25/09), et le mercredi part comme d'habitude.
Écartée : l'orchestrateur rappelle le générateur jour par jour (Graph lu deux fois, cron deux fois plus long,
huit lignes de journal par chantier, deux extractions qui peuvent diverger). Écartée : découper le PDF de la
semaine côté Hub (pas de garde journalière, Word à refaire).

## Périmètre

- Générateur, puis `publish_workflow` :
  - `Préparer rapport` : la semaine est inchangée. Pour une période de 2 à 7 jours, un document par jour de
    la semaine : lundi à vendredi toujours, plus samedi ou dimanche s'il y a une heure Traxxeo ou un message
    RT ou BL&L (même test qu'aujourd'hui). Chaque jour a une garde « Rapport technique journalier » et la
    période `<jour>_<jour>`. Une période d'un jour donne un seul document, à garde journalière, sans doublon.
    Au-delà de 7 jours et en démo : un seul document. Logo base64 : sha256 vérifié avant et après.
  - Boucle `Lot documents` (splitInBatches, un à la fois) → `Déposer aperçu HTML` → `PDF actif ?` → PDF → Word
    → `Noter document` (Code : type, date, URL ou échec) → retour. La sortie « terminé » va vers `Faire le
    bilan`. Les expressions lisent `$('Lot documents').first()`. Plus d'`executeOnce` dans la boucle.
  - `Faire le bilan` : `pdf_url` et `docx_url` restent ceux de la semaine. Le message ajoute « 5 rapports du
    jour », ou « 4 rapports du jour sur 5 · 18/11 : conversion PDF en échec ». Un jour en échec donne
    « Succès partiel ». « Erreur » reste réservé à une semaine sans aucun fichier.
  - Mail : `Lister pièces jointes` (Code, un élément par document, le PDF ou à défaut le Word) se place
    avant `Télécharger rapport pour email`, qui lit `$json.url`. `Préparer email Graph` : l'objet actuel suivi
    de « (+ 5 rapports du jour) », puis une ligne « PDF · Word » par document, et tout jour manquant dit en
    clair. Tout est joint si le total, mesuré **une fois encodé** (ce que Microsoft compte), tient sous 3 Mo et
    que chaque fichier est récupéré. Sinon, rien n'est joint et le mail dit pourquoi. `Envoi email ?`,
    `Bilan email` et `Journaliser fin` ne changent pas.
- Hub : `GET /api/reports` donne à chaque rapport d'un jour un champ `semaine` (la période de 2 à 7 jours du
  même chantier qui le contient, lundi→dimanche en priorité), par une fonction pure exportée et testée.
  `public/rapports.js` : sous la semaine, un repli « 5 rapports du jour » avec une ligne par jour (Aperçu,
  PDF, DOCX). Un jour sans semaine garde sa ligne. `public/app.js` : « + 5 rapports du jour » sur la ligne de
  la semaine. ZIP inchangé.
- Docs : `docs/BIBLE.md` §4 (rapports du jour, coût PDFShift, retour arrière), `public/guide.html` (rapport,
  page Rapports, mail), une ligne de `CLAUDE.md` §1.

## Hors périmètre

- Le rapport de la semaine, l'orchestrateur `5su1DOeswBlCdakw`, le créneau, la page Configuration.
- L'extraction : Traxxeo, lots de 12 avec pause de 15 s, filtre des vidéos.
- L'envoi Graph en plusieurs morceaux. Le Word n'est pas joint. Le mail de test. Couper les jours par chantier.
- Relancer automatiquement un envoi refusé par Microsoft (erreur 504) : le mail a pu partir quand même, une
  relance risquerait un doublon. `Bilan email` le signale, et on renvoie à la main.
- La copie `n8n/dz-generer-rapport.workflow.mjs`, les secrets en clair, `EXECUTIONS_DATA_MAX_AGE`, le lot 2 mails.

## Critères vérifiables

| # | Critère | Preuve attendue | État |
|---|---|---|---|
| 1 | Un jour est rattaché à sa semaine, un jour isolé reste seul, le ZIP ignore les jours | `npm test` : tests nommés de `tests/rapports.test.js`, dont `MOIS_RE` sur `…__2026-11-18_2026-11-18.pdf` | réussi : `npm test` 9/9 ; `tests/rapports.test.js` : « chaque jour est rattaché à sa semaine lundi → dimanche », « un jour isolé reste seul », « la semaine lundi → dimanche passe avant une période libre », « le ZIP ignore les rapports du jour » (`MOIS_RE` faux sur `__2026-11-18_2026-11-18.pdf`, le 01 et le 30 aussi) |
| 2 | Page Rapports : la semaine et son repli, sans scroll horizontal | captures `rapports-jours-1440.png`, `-390.png` (stubs locaux) | échec |
| 3 | Dashboard : une ligne par semaine avec « + N rapports du jour » | captures `dashboard-jours-1440.png`, `-390.png` (stubs locaux) | échec |
| 4 | `Préparer rapport` rend le bon nombre de documents | jsCode en local avec un stub de `$()`, sort 0. Résultats attendus : semaine du 16 au 22/11 avec samedi actif = 1+6 ; un jour = 1 (garde journalière) ; 31 jours = 1 ; démo = 1 | échec |
| 5 | Bilan et mail tranchent juste | `Faire le bilan` et `Préparer email Graph` en local avec stubs, sortie 0. Cas : 6 pièces jointes et l'objet « (+ 5 rapports du jour) » ; total encodé au-dessus de 3 Mo, donc 0 pièce jointe et la raison écrite ; un jour sans fichier, donc « Succès partiel » et ce jour cité | échec |
| 6 | Générateur publié mardi 24/11 au plus tard | `get_workflow_details` : `Lot documents` présent, même sha256 qu'en local ; `publish_workflow` ; nouvelle version notée au journal | échec |
| 7 | Une génération réelle produit la semaine et ses jours, avec une seule ligne de journal | « Générer » (sans envoi) du 16 au 22/11 sur un chantier : `GET /api/reports` (en-tête `X-Cockpit-Token`) montre la semaine et 5 jours (+ week-end actif) en PDF, DOCX et HTML ; `dz_runs` : une seule ligne « Succès » avec « 5 rapports du jour » | échec |
| 8 | Même extraction, même contenu | pour chaque jour, le bloc `<div class="jour">` de l'aperçu du jour et celui de la semaine : `diff` sort 0 | échec |
| 9 | Une période d'un jour ne crée pas de doublon | « Générer » sur un jour : seul le jeu `<jour>_<jour>` est remplacé | échec |
| 10 | Docs alignées | `grep -c "rapports du jour" docs/BIBLE.md public/guide.html` ≥ 1 chacun | échec |
| 11 | Le cron du 25/11 envoie tout | `GET /webhook/dz/api/runs` du 25/11 : une ligne par chantier actif, « email envoyé à » et « N rapports du jour » | échec |
| 12 | DZ confirme la réception | message de Fares ou Francis citant un mail reçu avec ses rapports du jour, noté au journal | échec |
| 13 | `npm run check` sort 0 | sortie de `check` | échec |

## Lots

1. **Lot 1, lundi 23/11 : Hub et docs** (critères 1, 2, 3, 10, 13). Invisible pour DZ tant qu'aucun rapport du
   jour n'existe. Passe en premier pour que les fichiers de test du lot 2 arrivent déjà rangés sous leur semaine.
2. **Lot 2, mardi 24/11 au plus tard : générateur** (critères 4 à 9). La boucle d'abord (le plus incertain), les
   tests locaux avant tout `update_workflow`, les critères 7 à 9 en prod juste après la publication. Tout doit
   être fini avant mercredi 7 h. Sinon, on republie la version `e8bc88ae…`.
3. **Mercredi 25/11 après 7 h** : critères 11 et 12, lecture du journal, sans session de code.

## Vérification de bout en bout

Mardi, après le lot 2, Vincent ouvre `/rapports` (compte DZ ou accès de secours) et filtre sur le chantier testé :
la semaine porte « 5 rapports du jour », et le repli montre lundi à vendredi. Le PDF du mardi s'ouvre sur
« Rapport technique journalier » et reprend la journée du mardi du rapport de la semaine. `/debug` et `/` n'ont
qu'une ligne pour ce run. Mercredi après 7 h, `/debug` montre « email envoyé à … » pour chaque chantier, puis
Fares ou Francis confirme la réception.

## Questions ouvertes

- PDFShift : on passe d'environ 45 à environ 250 PDF par mois. Vincent vérifie, avant mercredi, que son forfait
  couvre ce volume. Si les crédits manquent, c'est le Word qui part à la place du PDF, et le run passe en
  « Succès partiel ».
