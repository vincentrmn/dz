# Session « construire, lot 2 » : Gaichel en trois rapports (21/09/2026)

Suite de `docs/journal/2026-09-21-construire-gaichel-lot-1.md` et de
`docs/plans/gaichel-trois-rapports.md`, lot 2 (critères 8, 9, 10, 11 volet local, puis le texte à
Francis).

## Ce qui a été décidé
- Aucune décision nouvelle : les décisions du 21/09 dans `docs/decisions.md` (lettre collée,
  tolérance à l'espace) couvrent déjà ce lot.
- Deux choix d'implémentation, consignés ici plutôt que dans les décisions :
  - la clé d'identité d'une fiche dans la découverte est le code tiré de son **nom** d'abord, et
    seulement à défaut celui de son **WBS** ; avec l'ordre inverse (WBS d'abord), la fiche 1
    (wbs `22.06 A;22.06 B`) aurait capté le code `22.06A` avant la fiche 19, qui le porte dans son
    nom.
  - le nom créé par la découverte garde son format « code-nom » existant (`22.06D-Gaichel-Maisons`)
    avec la lettre collée : pas de changement de la convention de séparateur, seulement de la
    reconnaissance de la lettre.

## Ce qui a été fait
- Lecture au MCP n8n du workflow `DZ — Découverte chantiers` (`49okCW9O85lYsP3r`) : le nœud
  `Rapprocher découvertes` ne reconnaissait la lettre qu'après un espace (`(\s+[A-Z])?`), donc
  `22.06A-…` était rabattu sur `22.06` ; le nœud aval `Enregistrer découvertes` est un upsert Data
  Table rapproché sur `wbs` qui n'écrit que `nom`, `wbs`, `conversation_bll`, `conversation_rt`,
  `actif`, `source`, `notes` ; une fiche supprimée de même code bloque toute recréation
  (`continue`), comportement conservé sans y toucher.
- Nouveau jsCode écrit et testé en local avant tout changement en prod (`.verif/rapprocher-decouvertes.js`,
  `.verif/test-decouverte.js` : 18 cas avec les fiches réelles de prod et des conversations
  synthétiques, exit 0 ; l'ancien code donnait `22.06` pour `22.06A-BL&L-X`).
- `update_workflow` (jsCode + note du canevas) puis `publish_workflow` →
  `activeVersionId 6844d6fd…` ; relecture `get_workflow_details` : brouillon = version active, jsCode
  identique (sha256 `9ab9d055…`).
- Scan relancé en production (exécution 9769, Succès, Graph actif, 46 conversations en page 1 dont
  les deux `22.06B-…`) : 0 ligne en sortie de `Rapprocher découvertes`, `GET /webhook/dz/api/chantiers`
  avant/après : 18 fiches, 0 différence.
- `public/guide.html` : exemples `22.06A-BL&L-Gaichel-Maisons` / `22.06A-RT-…`, nouveau paragraphe
  « chantier divisé en parties » (lettre collée dans Teams et Traxxeo, tolérance à l'espace et à la
  minuscule, `22.06` distinct de `22.06A`), étape 3 de l'activation avec l'exemple `22.06A` ; plus de
  `22.06 A;22.06 B`.
- `docs/BIBLE.md` : §4 étape 6 (comparaison normalisée dans `Mapper activité Traxxeo`), §5
  (découverte, lettre collée, rattachement par le nom puis le WBS), §9 (« Échec Traxxeo silencieux »
  enrichi du cas Gaichel resté à 0 ligne un mois), §12 (WBS `22.06A`).
- `CLAUDE.md` §8 : dix chantiers actifs, Gaichel en trois fiches, codes à lettre collée, reste à
  faire ; 123 lignes.
- Texte de communication à Francis rédigé pour Vincent (hors dépôt, transmis dans le compte rendu de
  fin de lot) : lettre collée obligatoire dans Teams et Traxxeo, tolérance de l'outil à l'espace,
  trois mails Gaichel désormais le mercredi au lieu d'un, besoin d'ajouter le compte
  `assembleur@dzconstruct.lu` aux conversations `22.06A-…` et `22.06C-…`, anciennes conversations
  `22.06-RT-…`/`22.06-BL&L-…` déjà renommées en B, donc rien à archiver.
- Relecteur : 0 bloquant, 6 mineurs (3 corrigés : compte des chantiers actifs, mention « en PR »,
  compte des cas de test ; 3 notés pour la PR : priorité d'une fiche supprimée sur une vivante de
  même code, comportement préexistant conservé ; colonnes écrites par l'upsert aval ; noms de nœuds
  vérifiés dans `get_workflow_details`). Vérificateur : PASS sur les critères 8, 9, 10, 11.
- Quatre commits sur la branche `claude/relaxed-babbage-k746kj`, PR à ouvrir vers `main` (numéro non
  connu au moment de ce journal).

## Ce qui a été vérifié (et comment)
- Critères 8 à 11 : preuves détaillées dans la colonne « État » de
  `docs/plans/gaichel-trois-rapports.md` (lignes 96 à 99), reprises ci-dessus sans être redupliquées
  ici.
- `npm run check` sort 0 après les modifications du guide, de la BIBLE et de CLAUDE.md
  (`.verif/check.log`).
- Captures `.verif/guide-teams-1440.png` (1440 px, sans défilement horizontal) et
  `.verif/guide-teams-390.png` (la section Teams modifiée tient dans 390 px), servies en local.

## Ce qui n'a pas pu être vérifié
- Le chemin « compléter une fiche existante » de `Rapprocher découvertes` (fiches 19 et 21 quand le
  compte assembleur sera ajouté aux conversations A et C) n'a traversé le nœud d'écriture qu'en test
  local (`.verif/test-decouverte.js`), pas en production : le scan réel du 21/09 n'a rien trouvé de
  nouveau à écrire, faute de conversations A/C visibles par le compte assembleur. Le premier scan
  utile sera celui du lundi 28/09 06:30, ou un clic sur « Scan des nouveaux chantiers ».
- Volet « après déploiement » des critères 9 et 11 (`curl …/guide` avec jeton contient `22.06A`,
  `/api/health`) : à faire par `/livrer` après fusion de la PR.
- À 390 px, la page `/guide` déborde à 833 px (nav du header 528 px, tableau des contacts 659 px),
  identique sur `origin/main` : préexistant, hors périmètre de ce lot, déjà constaté sur le Dashboard
  au lot 1.
- Le rendu en session connectée (login Microsoft) : impossible à tester depuis ici.

## Leçons durables (reportées dans les règles ou les skills)
- `.claude/rules/n8n.md` (section « Pièges vérifiés ») : dans `Rapprocher découvertes`, le code
  chantier est dérivé du nom Teams par une regex ; une lettre de partie n'est reconnue que si la
  regex l'accepte collée ET espacée (`\s*([A-Z])?` avec un lookahead qui refuse une lettre suivie
  d'une autre lettre, sinon `22.06 Gaichel` donnerait `22.06G`) ; symptôme de l'ancien code
  (`(\s+[A-Z])?`) : `22.06A-…` rabattu en silence sur `22.06`, aucune fiche A/C créée malgré des
  semaines de scans. Tester le jsCode en local avec un stub de `$()` et les fiches réelles avant
  `update_workflow`.

## Prochaine étape
`/livrer <PR>` (déploiement auto, smoke : `/api/health`, `curl …/guide` avec jeton contient
`22.06A`), puis saisie des IDs de conversation A et C dans le Dashboard dès que Francis a ajouté le
compte assembleur ; le run du mercredi 23/09 partira avec trois mails Gaichel.
