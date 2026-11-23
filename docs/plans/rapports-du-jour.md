# Plan : un rapport par jour en plus du rapport de la semaine, envoyés ensemble le mercredi

Écrit le 23/11/2026 par `/cadrer`, validé par Vincent le JJ/MM/AAAA.
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

Option A : dans le même run, à partir de la même extraction, le générateur produit le document de la semaine
puis un document par jour. `Préparer rapport` rend N+1 éléments. La boucle `Lot documents` (même motif que
`Lot images RT`) les fait passer un par un dans la chaîne existante. Un seul mail joint le tout. Graph n'est lu
qu'une fois, `dz_runs` garde une ligne par chantier, l'orchestrateur ne bouge pas. L'interrupteur
`rapports_jour_actif` (dans `Config`) reste éteint jusqu'à la mise en service : retour arrière immédiat.
Écartée : B, l'orchestrateur rappelle le générateur jour par jour (Graph lu deux fois, cron deux fois plus long,
huit lignes de journal par chantier, deux extractions qui peuvent diverger). Écartée : C, découper le PDF de la
semaine côté Hub (pas de garde journalière, Word à refaire).

## Périmètre

- Générateur, puis `publish_workflow` :
  - `Config` : `rapports_jour_actif` (booléen, false).
  - `Préparer rapport` : la semaine est inchangée. Interrupteur allumé et période de 2 à 7 jours : un document
    par jour de la semaine, soit lundi à vendredi toujours, plus samedi ou dimanche s'il y a une heure Traxxeo
    ou un message RT ou BL&L (même test qu'aujourd'hui). Chaque jour a une garde « Rapport technique
    journalier » et la période `<jour>_<jour>`. Une période d'un jour donne un seul document, à garde
    journalière, sans doublon. Au-delà de 7 jours et en démo : un seul document. Logo base64 : sha256
    vérifié avant et après.
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
- Docs : `docs/BIBLE.md` §4 (interrupteur, coût PDFShift), `public/guide.html` (rapport, page Rapports, mail),
  une ligne de `CLAUDE.md` §1.

## Hors périmètre

- Le rapport de la semaine, l'orchestrateur `5su1DOeswBlCdakw`, le créneau, la page Configuration.
- L'extraction : Traxxeo, lots de 12 avec pause de 15 s, filtre des vidéos.
- L'envoi Graph en plusieurs morceaux. Le Word n'est pas joint. Le mail de test. Couper les jours par chantier.
- La copie `n8n/dz-generer-rapport.workflow.mjs`, les secrets en clair, `EXECUTIONS_DATA_MAX_AGE`, le lot 2 mails.

## Critères vérifiables

| # | Critère | Preuve attendue | État |
|---|---|---|---|
| 1 | Un jour est rattaché à sa semaine, un jour isolé reste seul, le ZIP ignore les jours | `npm test` : tests nommés de `tests/rapports.test.js`, dont `MOIS_RE` sur `…__2026-11-18_2026-11-18.pdf` | échec |
| 2 | Page Rapports : la semaine et son repli, sans scroll horizontal | captures `rapports-jours-1440.png`, `-390.png` (stubs locaux) | échec |
| 3 | Dashboard : une ligne par semaine avec « + N rapports du jour » | captures `dashboard-jours-1440.png`, `-390.png` (stubs locaux) | échec |
| 4 | `Préparer rapport` rend le bon nombre de documents | jsCode en local avec un stub de `$()`, sort 0. Résultats attendus : semaine du 16 au 22/11 avec samedi actif = 1+6 ; un jour = 1 (garde journalière) ; 31 jours = 1 ; démo = 1 ; interrupteur éteint = 1 | échec |
| 5 | Bilan et mail tranchent juste | `Faire le bilan` et `Préparer email Graph` en local avec stubs, sortie 0. Cas : 6 pièces jointes et l'objet « (+ 5 rapports du jour) » ; total encodé au-dessus de 3 Mo, donc 0 pièce jointe et la raison écrite ; un jour sans fichier, donc « Succès partiel » et ce jour cité | échec |
| 6 | Générateur publié, interrupteur éteint | `get_workflow_details` : `Lot documents`, `rapports_jour_actif` = false, même sha256 qu'en local ; `publish_workflow` | échec |
| 7 | Interrupteur éteint : rien ne change | « Générer » (sans envoi) d'une semaine passée : `GET /api/reports` (en-tête `X-Cockpit-Token`) sans nouveau fichier `<jour>_<jour>`, `GET /webhook/dz/api/runs` sans « rapports du jour » | échec |
| 8 | Interrupteur allumé : la semaine et ses jours, une ligne de journal | même génération : `GET /api/reports` montre la semaine et 5 jours (+ week-end actif) en PDF, DOCX et HTML ; `dz_runs` a une seule ligne « Succès » avec « 5 rapports du jour » | échec |
| 9 | Même extraction, même contenu | pour chaque jour, le bloc `<div class="jour">` de l'aperçu du jour et celui de la semaine : `diff` sort 0 | échec |
| 10 | Une période d'un jour ne crée pas de doublon | « Générer » sur un jour : seul le jeu `<jour>_<jour>` est remplacé. Ensuite interrupteur à false et `publish_workflow` | échec |
| 11 | Docs alignées | `grep -c "rapports du jour" docs/BIBLE.md public/guide.html` ≥ 1 chacun ; `grep -c rapports_jour_actif docs/BIBLE.md` ≥ 1 | échec |
| 12 | Mise en service avant le créneau | `/api/health` 200 et Hub déployé ; `rapports_jour_actif` = true dans `get_workflow_details` ; `publish_workflow` | échec |
| 13 | Le cron du mercredi envoie tout | `GET /webhook/dz/api/runs` de ce mercredi : une ligne par chantier actif, « email envoyé à » et « N rapports du jour » | échec |
| 14 | DZ confirme la réception | message de Fares ou Francis citant un mail reçu avec ses rapports du jour, noté au journal | échec |
| 15 | `npm run check` sort 0 | sortie de `check` | échec |

## Lots

1. **Lot 1, Hub** : critères 1, 2, 3, 15. Invisible pour DZ tant qu'aucun rapport du jour n'existe. Passe en
   premier pour que les fichiers de test du lot 2 arrivent déjà rangés sous leur semaine.
2. **Lot 2, générateur derrière l'interrupteur, BIBLE** : critères 4 à 10. La boucle d'abord (le plus incertain),
   les tests locaux avant tout `update_workflow`. Interrupteur allumé seulement pendant les critères 8 à 10, jamais
   pendant le créneau, et éteint en fin de lot.
3. **Lot 3, mise en service** : guide, `CLAUDE.md`, critères 11 et 12 avant le mercredi choisi ; les critères 13
   et 14 sont fermés après. Retour arrière : `rapports_jour_actif` à false puis `publish_workflow`.

## Vérification de bout en bout

Après le lot 2, en prod (pas de staging), Vincent ouvre `/rapports` avec l'accès de secours et filtre sur le
chantier testé : la semaine porte « 5 rapports du jour », et le repli montre lundi à vendredi. Le PDF du mardi
s'ouvre sur « Rapport technique journalier » et reprend la journée du mardi du rapport de la semaine. `/debug` et
`/` n'ont qu'une ligne pour ce run. Le mercredi de la mise en service, `/debug` montre « email envoyé à … » pour
chaque chantier, puis Fares ou Francis confirme la réception.

## Questions ouvertes

- PDFShift : on passe d'environ 45 à environ 250 PDF par mois. Le forfait de Vincent couvre-t-il ce volume, et un
  gros PDF coûte-t-il plus d'un crédit ? À vérifier avant d'allumer l'interrupteur.
- Les mails trop lourds n'envoient que des liens, qui demandent un compte DZ. Il faut qu'un compte DZ se soit
  connecté au Hub avant la mise en service.
- Quel mercredi pour la première livraison ?
- Quand le total dépasse 3 Mo, le plan suit ta réponse à la lettre : rien n'est joint, seulement des liens.
  Variante possible : joindre au moins la semaine.
