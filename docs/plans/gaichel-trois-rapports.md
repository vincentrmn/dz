# Plan : Gaichel en trois rapports hebdo (22.06A, 22.06B, 22.06C)

Écrit le 21/09/2026 par `/cadrer`, validé par Vincent le <à compléter>.
Un plan tient sur une page. Il dit ce qu'on construit, ce qu'on ne construit
pas, et comment on saura que c'est fini. Rien ici n'est du code.

## Contexte

Francis divise le chantier 22.06 Gaichel en trois parties A, B et C. DZ a créé six conversations
Teams (`22.06A-RT-Gaichel-Maisons`, `22.06A-BL&L-Gaichel-Maisons`, déclinées en B et C) et Traxxeo
a trois projets. Il veut un rapport hebdo par partie, reconnue par la lettre collée au code, et a
demandé à Fares de retirer l'espace dans Traxxeo (`22.06 A` devient `22.06A`), à une date inconnue.

Aujourd'hui une seule fiche `22.06-Gaichel-Maisons` (id 1, wbs `22.06 A;22.06 B`, active, mail vers
`dzconstruct@dzconstruct.lu`) produit un rapport agrégé. Le chapitre 1 est filtré dans le nœud
`Mapper activité Traxxeo` du générateur (`qZG6Q5LnQSrloeXR`) par égalité stricte après `trim()`
entre les codes de la fiche et le WBS renvoyé par Traxxeo (copie datée : `n8n/dz-generer-rapport.workflow.mjs`,
lignes 179 et 203). Un WBS mal orthographié vide le chapitre 1 en silence. Le workflow de
découverte (`49okCW9O85lYsP3r`) ne vit que dans n8n : on ignore s'il crée une fiche `22.06A` ou
rabat sur `22.06`. Deux constats pris en prod le 21/09 sur `GET /webhook/dz/api/chantiers` :
une fiche `22.06A` (id 19, vide, source cockpit) existe déjà en soft-delete ; et aucune fiche A/B/C
n'est apparue malgré le scan du lundi, ce qui est compatible avec un rabattement invisible (la
découverte ne remplit que les IDs manquants, et la fiche 1 a déjà les siens). Le nom de fichier,
la page Rapports et l'email dérivent de la fiche : tout marche déjà par chantier. Le guide
(`public/guide.html`, lignes 95 à 111) documente encore `22.06-BL&L-Gaichel-Maisons` et `22.06 A;22.06 B`.

Décisions applicables (CLAUDE.md) : passthrough strict ; 1 mail = 1 chantier ; `Lancer génération`
reste en `waitForSubWorkflow: true` (trois fiches de plus, environ quatre minutes de plus au run) ;
`publish_workflow` après tout `update_workflow` ; BIBLE et `/guide` alignés ; aucun secret dans le
dépôt. La ligne « Chantier pilote : 22.06-Gaichel-Maisons (ne pas changer) » devient caduque :
Vincent a tranché le 21/09 de désactiver cette fiche en la conservant.

## Décision

Retenue : **trois fiches chantier ordinaires, et une normalisation des codes dans le code n8n,
sans toucher aux données**. Une fonction unique (espaces retirés, majuscules) est appliquée dans
`Mapper activité Traxxeo` aux codes de la fiche et au WBS de chaque ligne Traxxeo, puis comparée
par égalité stricte ; la même normalisation sert de clé dans la découverte pour dériver le code
depuis le nom Teams, de sorte que `22.06A-…`, `22.06 A-…` et `CH:22-06 A` donnent tous `22.06A`,
distinct de `22.06`. Pas de correspondance par préfixe (`22.06` n'absorbe pas `22.06A`). Le chapitre 1
ne se vide plus pendant la transition Traxxeo ni après un oubli.

Écartées : **config seule** (`22.06A;22.06 A` dans chaque fiche) : zéro code mais fragile et
illisible dans le guide, et Vincent a demandé la tolérance. **Normaliser à l'enregistrement dans le
cockpit** : ne couvre pas le côté Traxxeo, qui renvoie `22.06 A` tant que Fares n'a rien changé.
**Notion de sections dans un chantier** : nouveau modèle, nouvelle UI, pour un résultat que trois
fiches donnent déjà.

## Périmètre

- n8n, générateur `qZG6Q5LnQSrloeXR`, nœud `Mapper activité Traxxeo` (version vivante lue au MCP,
  pas la copie du dépôt) : fonction de normalisation appliquée à `wbsList` et au WBS de chaque ligne,
  rien d'autre dans ce nœud. Publication.
- n8n, découverte `49okCW9O85lYsP3r` : lecture d'abord (quel nœud dérive le code, quel nœud fait
  l'upsert, sur quelle clé, que fait-il d'une fiche supprimée de même nom), puis même normalisation
  de la clé ; le nom créé porte la lettre collée (`22.06A Gaichel-Maisons` si la découverte nomme
  « code espace nom » comme `25.07 Ecole-Brouch-E/A`). Publication.
- Données dz_chantiers (cockpit ou Cockpit API) : trois fiches `22.06A`, `22.06B`, `22.06C` avec
  leurs deux conversations, wbs `22.06A` / `22.06B` / `22.06C`, `dzconstruct@dzconstruct.lu`,
  `mail_actif` et `actif` à true ; la fiche id 19 supprimée est réutilisée (restaurée) ou laissée,
  selon ce que la découverte fait d'un doublon supprimé ; fiche 1 passée à `actif=false`, reste intact.
- `public/guide.html`, sections « Bien nommer les conversations Teams » et « Activer un nouveau
  chantier » : lettre collée dans Teams et Traxxeo, exemples `22.06A-BL&L-Gaichel-Maisons` et WBS
  `22.06A`, mention que l'outil tolère l'espace mais que la rigueur est la règle.
- `docs/BIBLE.md` (§4 étape 6, §5 découverte, §9 « Échec Traxxeo silencieux », §12 WBS) et
  `CLAUDE.md` (ligne pilote caduque, acquis « Gaichel = 22.06 A + 22.06 B » remplacé, piège
  « comparaison WBS normalisée »).

## Hors périmètre

- Archives mensuelles A/B/C : janv-juil restent sur la fiche `22.06-Gaichel-Maisons`.
- Toute notion de sections ou de sous-chantiers dans le modèle, l'UI ou le rapport.
- Les autres chantiers à lots Traxxeo : pas de scan Traxxeo pour préremplir les WBS, fiches intactes.
- Canaux Teams, compte assembleur dans chaque conversation, correspondance par préfixe.
- Suppression ou renommage de la fiche 1 ; ses rapports et son historique dz_runs restent.
- `server.js`, `app.js`, parallélisme de `Lancer génération`, envoi email, copie de référence du
  générateur (déjà datée sur d'autres points).

## Critères vérifiables

Chaque critère démarre à « échec » et ne passe à « réussi » qu'avec une preuve. Les `curl` sur
`https://cockpit-production-c3dc.up.railway.app` portent `-H "X-Cockpit-Token: $COCKPIT_TOKEN"`
(valeur lue dans Railway, jamais écrite dans le dépôt). W = semaine cible (voir questions ouvertes).

| # | Critère | Preuve attendue | État |
|---|---|---|---|
| 1 | La normalisation rend égaux `22.06A`, `22.06 A`, `22.06 a`, ` 22.06 A `, et distincts `22.06`/`22.06A` et `22.06A`/`22.06B` | Fonction extraite du jsCode dans le scratchpad, `node -e` sur les huit couples sort 0 | échec |
| 2 | Le nœud vivant `Mapper activité Traxxeo` porte la normalisation, workflow publié, `Lancer génération` toujours en `waitForSubWorkflow: true` | `get_workflow` `qZG6Q5LnQSrloeXR` (jsCode) + réponse `publish_workflow` ; `get_workflow` `5su1DOeswBlCdakw` | échec |
| 3 | Non-régression : fiche 1 (wbs inchangé) régénérée sur W donne le même « Traxxeo : N ligne(s) » avant et après le changement du nœud | Deux lignes `GET /api/runs` fiche 1, période W, même N, statut Succès | échec |
| 4 | Trois fiches distinctes et complètes | `GET /api/chantiers` : noms contenant `22.06A`, `22.06B`, `22.06C`, six IDs de conversation non vides et tous différents, wbs `22.06A`/`22.06B`/`22.06C`, `actif=true`, `mail_actif=true`, emails `dzconstruct@dzconstruct.lu` | échec |
| 5 | Ancienne fiche conservée et inactive | Même appel : fiche 1 `actif=false`, `supprime=false`, wbs et conversations identiques au relevé du début du lot 1 ; `GET /api/reports` liste toujours `22.06-Gaichel-Maisons__*` | échec |
| 6 | Trois rapports distincts sur W, chapitre 1 partitionné sans perte ni doublon | `GET /api/reports` : `.pdf`, `.docx`, `.html` pour les trois fiches sur W ; `GET /api/runs` : trois lignes Succès (ou Succès partiel avec cause photo) ; N_A + N_B = N du critère 3, N_C relevé | échec |
| 7 | Chapitre 1 rempli avec un WBS Traxxeo encore espacé | Tant que Fares n'a rien changé, la ligne dz_runs de A (fiche à `22.06A` sans espace) montre « Traxxeo : N ligne(s) », N > 0 sur une semaine travaillée | échec |
| 8 | La découverte crée une fiche distincte pour un code à lettre, quelle que soit la graphie, et ne touche pas les fiches existantes | Sortie d'exécution du scan relancé (MCP n8n) : aucun doublon, diff vide de `GET /api/chantiers` avant/après ; `node -e` sur la dérivation de clé : `22.06A-BL&L-X`, `22.06 A-RT-X`, `CH:22-06 A` donnent `22.06A`, `22.06-BL&L-X` donne `22.06`, sort 0 | échec |
| 9 | Le guide documente la convention | `grep -c "22.06A-BL&amp;L-Gaichel-Maisons" public/guide.html` ≥ 1 et `grep -c "22.06 A;22.06 B" public/guide.html` = 0 ; captures `guide-teams-1440.png` et `guide-teams-390.png` (servi en local, pas de scroll horizontal) ; après déploiement `curl …/guide` avec le jeton contient `22.06A` | échec |
| 10 | BIBLE et CLAUDE.md alignés | `grep -n "ne pas changer" CLAUDE.md` ne cite plus Gaichel ; `grep -c "22.06A" docs/BIBLE.md` ≥ 1 ; `grep -c "22.06 A + 22.06 B" CLAUDE.md` = 0 | échec |
| 11 | Cockpit sain | `node --check server.js` sort 0 ; `curl -s …/api/health` répond `"cockpit":"ok"` après déploiement | échec |
| 12 | Dashboard lisible avec trois cartes Gaichel plus l'ancienne inactive | Captures `dashboard-gaichel-1440.png` et `dashboard-gaichel-390.png` servies en local avec un stub `/api/chantiers` repris de la sortie réelle du critère 4 | échec |

## Lots

1. **Lot 1, les trois rapports** : critères 1 à 7, 11 (`node --check`), 12. Commence par le plus
   incertain : relevé de `GET /api/chantiers`, puis lecture des deux workflows vivants au MCP n8n
   (dont le sort d'une fiche supprimée de même nom). Ensuite : normalisation dans `Mapper activité
   Traxxeo` + publication ; régénération de la fiche 1 sur W (critère 3) ; six IDs de conversation
   par le scan s'il crée déjà des fiches distinctes, sinon par la sortie d'exécution du scan au MCP
   et création des trois fiches par « Ajouter un chantier » ; WBS, destinataire, activation ;
   désactivation de la fiche 1 ; trois générations sans email ; captures. À finir avant le mercredi
   23/09 7 h, sinon le run hebdo produit encore l'ancien rapport agrégé (acceptable, à dire à Vincent).
2. **Lot 2, découverte et documentation** : critères 8, 9, 10, 11 (déploiement). À publier avant le
   scan du lundi 28/09 06:30 : sinon le scan pourrait recréer des doublons inactifs des fiches du lot 1.

## Vérification de bout en bout

Francis ou Fares, avec un compte `@dzconstruct.lu`, ouvre le Dashboard et voit trois cartes
`22.06A`, `22.06B`, `22.06C` actives et la carte `22.06-Gaichel-Maisons` inactive. Sur la page
Rapports, trois rapports Gaichel pour la même semaine : au chapitre 1 les seules personnes pointées
sur la partie, aux chapitres 2 et 3 les seules photos de ses deux conversations. Le mercredi
suivant, `dzconstruct@dzconstruct.lu` reçoit trois mails Gaichel au lieu d'un. Vincent, avec
l'accès de secours, peut refaire une génération à la demande ; la validation métier reste celle de DZ.

## Questions ouvertes

- Nom des trois fiches : celui que produit la découverte (vraisemblablement `22.06A Gaichel-Maisons`,
  comme `25.07 Ecole-Brouch-E/A`), qui fixe le nom des fichiers et l'objet des mails, ou le style du
  pilote `22.06A-Gaichel-Maisons` ? Par défaut : ce que produit la découverte.
- Semaine cible W et bascule : les nouvelles conversations viennent d'être créées. Par défaut
  W = semaine du 14 au 20/09, générée sur les quatre fiches avant désactivation de la fiche 1.
- Anciennes conversations `22.06-RT-…` et `22.06-BL&L-…` : ce qui y sera posté après la
  désactivation n'apparaîtra dans aucun rapport. Vincent le dit-il à Francis (archiver ou renommer
  côté DZ) ? Le plan ne touche pas Teams.
- Réponse à Francis sur la consigne Traxxeo : la rigueur « lettre collée » devient la règle, mais
  l'outil tolère l'espace ; Fares peut donc modifier Traxxeo quand il veut, sans coupure.
