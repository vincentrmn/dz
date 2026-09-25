# Plan : chaque run dit si le mail est parti, et les rapports du 14→20/09 sont renvoyés

Écrit le 25/09/2026 par `/cadrer`, validé par Vincent le 25/09/2026.
Un plan tient sur une page. Il dit ce qu'on construit, ce qu'on ne construit
pas, et comment on saura que c'est fini. Rien ici n'est du code.

## Contexte

DZ dit ne pas recevoir les rapports du mercredi. Le run cron du 23/09 a produit 11 rapports « Succès »
au message vide (dz_runs 319 à 329). Six chantiers actifs n'ont aucun destinataire : 26.01, 26.02,
26.04, 26.05, 26.06 et 26.07. Fluhe (26.07) a en plus `mail_actif` à false. L'IF « Envoi email ? » du
générateur `qZG6Q5LnQSrloeXR` les a donc écartés sans laisser de trace. Les cinq autres (Gaichel A, B
et C, Frisange-École, Brouch) sont partis de `dzconstruct@dzconstruct.lu` vers la même adresse. Graph
n'a rendu aucune erreur, mais rien ne prouve que les mails sont arrivés, et n8n ne garde pas les
exécutions. `Journaliser fin` ne note que les échecs. Côté cockpit, Debug affiche `message` et
`stats` (`public/debug.js:69`, proxy `server.js:87`). La carte chantier (`public/app.js:158-349`)
ne montre aucun run. `badgeStatut()` (`public/debug.js:37`) affiche « Succès partiel » en vert.
Décisions : le 30/07, 1 mail = 1 chantier vers `dzconstruct@dzconstruct.lu` (inchangée).

## Décision

On garde l'envoi tel quel et on rend visible chaque mail qui ne part pas. Un nœud Code `Bilan email`
est ajouté juste avant `Journaliser fin`, et les deux branches de l'IF passent par lui. Il écrit en
tête de `message` soit « email envoyé à <adresses> », soit « email NON envoyé : <raison> ». Raisons
possibles : pas de destinataire, toggle chantier coupé, interrupteur général coupé, génération sans
envoi demandé, aucun fichier produit, erreur Microsoft <code>. Si l'envoi était demandé (cron ou
« Générer et envoyer ») et que le mail n'est pas parti, le statut passe à « Succès partiel ». La
carte du Dashboard lit ce segment dans le dernier run du chantier, via `/api/runs`, qui existe déjà.
Écartés : une colonne `email` dans `dz_runs` (change le schéma pour un seul affichage). Écartés par
Vincent : l'alerte rouge sur la carte, le récapitulatif envoyé à Vincent, Vincent en copie cachée.

## Périmètre

- `dz_chantiers` : `emails = dzconstruct@dzconstruct.lu` sur les six fiches vides ; Fluhe (26.07)
  repasse `mail_actif` à true.
- Générateur : ajout de `Bilan email` (raison du non-envoi retrouvée à partir des six conditions,
  code d'erreur Graph, note « sans pièce jointe » reprise) ; `Journaliser fin` écrit le message et le
  statut qu'il produit ; puis `publish_workflow`.
- Découverte `49okCW9O85lYsP3r` : une nouvelle fiche reçoit `dzconstruct@dzconstruct.lu`. Le
  jsCode est testé en local avec un stub, puis publié.
- Bouton « Ajouter un chantier » (`public/app.js:448`) : même destinataire par défaut.
- `public/debug.js` : « Succès partiel » passe en orange (classe `.badge.encours` existante).
- `public/app.js` : la carte chantier affiche une ligne « Dernier run » avec la date, le statut et
  le segment email, en rapprochant chaque run de sa fiche par le nom (`r.chantier === c.nom`).
- `docs/BIBLE.md` et `public/guide.html` : section email et page Debug. On y précise que « envoyé »
  veut dire « accepté par Microsoft ».
- Rattrapage : « Générer et envoyer » sur chaque chantier actif pour la semaine du 14 au 20/09, un
  seul à la fois. On attend le statut final dans Debug avant de lancer le suivant.

## Hors périmètre

- Le contenu du rapport, l'objet et le corps du mail, la règle des 3 Mo pour la pièce jointe.
- La recherche dans la boîte `dzconstruct@` par Fares ou Francis. Si elle ne trouve rien alors
  que Graph a accepté l'envoi, Vincent demande à CBC un suivi des messages (hors code).
- La copie `n8n/dz-generer-rapport.workflow.mjs`, la conservation des exécutions n8n.

## Critères vérifiables

| # | Critère | Preuve attendue | État |
|---|---|---|---|
| 1 | Aucune fiche active sans destinataire | `GET /webhook/dz/api/chantiers` : 0 fiche `actif` à `emails` vide | échec |
| 2 | Générateur modifié et publié | `publish_workflow` sur `qZG6Q5LnQSrloeXR` ; `get_workflow_details` montre `Bilan email` → `Journaliser fin` | échec |
| 3 | Une génération simple note le non-envoi sans dégrader le statut | `GET /webhook/dz/api/runs` : « email NON envoyé : génération sans envoi demandé », statut « Succès » | échec |
| 4 | Un envoi demandé mais impossible est une anomalie | « Générer et envoyer » sur une fiche au toggle coupé : « email NON envoyé : toggle chantier coupé », « Succès partiel » | échec |
| 5 | Rattrapage 14→20/09 | `GET /webhook/dz/api/runs` : une ligne « email envoyé à dzconstruct@dzconstruct.lu » par chantier actif | échec |
| 6 | DZ confirme la réception | message de Fares ou Francis citant les objets reçus, noté au journal | échec |
| 7 | Debug : « Succès partiel » en orange, ligne email lisible | captures `debug-email-1440.png`, `debug-email-390.png` (stubs locaux) | échec |
| 8 | Carte chantier : ligne « Dernier run » (envoyé, NON envoyé, aucun run) | captures `dashboard-dernier-run-1440.png`, `-390.png`, sans scroll horizontal | échec |
| 9 | La découverte et « Ajouter un chantier » posent le destinataire par défaut | jsCode exécuté en local avec stub + `publish_workflow` sur `49okCW9O85lYsP3r` ; fiche test créée au cockpit (stub local) avec `emails = dzconstruct@dzconstruct.lu` | échec |
| 10 | Docs alignées | `grep -c "email NON envoyé" docs/BIBLE.md public/guide.html` ≥ 1 chacun | échec |
| 11 | Le cron du 30/09 note un envoi par chantier actif | `GET /webhook/dz/api/runs` du 30/09 : autant de « email envoyé à » que de chantiers actifs | échec |
| 12 | `npm run check` sort 0 | sortie de `check` | échec |

## Lots

1. **Lot 1, urgence (n8n et données, pas de déploiement du cockpit)** : critères 1 à 6. On commence
   par `Bilan email`, puis les adresses, puis le rattrapage. Le critère 6 se ferme dès que DZ répond.
2. **Lot 2, visibilité et prévention** : critères 7 à 12 (le 11 se ferme le 30/09).

## Vérification de bout en bout

Vincent ouvre `/debug` avec l'accès de secours. Il y voit les lignes du 14→20/09 marquées « email
envoyé à dzconstruct@dzconstruct.lu », et le badge orange laissé par le test du critère 4. Sur `/`,
chaque carte active porte sa ligne « Dernier run ». Le 30/09 après 7 h, il refait la même lecture
sur le run cron, et Fares ou Francis confirme la réception.

## Questions ouvertes

Aucune. Tranché par Vincent le 25/09 : Fluhe rallumé ; l'anomalie vaut pour tout envoi demandé
(cron et « Générer et envoyer ») ; « Ajouter un chantier » reçoit le même destinataire par
défaut ; suivi des messages chez CBC si la recherche de Fares ne trouve rien.
