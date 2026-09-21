# Session « état du projet avant le workflow korr » (02/09/2026, rangé le 21/09/2026)

Ce fichier reprend, tel quel, la partie récit de l'ancien `CLAUDE.md` (321 lignes) rangée le 21/09/2026
à l'installation du workflow korr. Rien n'y est réécrit ; l'état « du moment » y est daté du 02/09/2026.

# CLAUDE.md — Rapport Technique DZ Construct — Phase 2 (en production)

## Point de situation — 30/07/2026 (à lire en premier)

**Ce qui tourne en prod (validé en réel) :** rapport hebdo complet — Traxxeo **actif**, 3 chapitres, champs enrichis (qualif · catégorie · matricule ; activité + commentaire), **total du jour**, footer (nom de fichier gauche + `x/y` droite, remonté du bord), **PDF + Word propres** (Word sans « mode de compatibilité »). Cockpit : Dashboard, `/guide`, `/rapports`, `/configuration`, `/debug`, soft-delete, bouton scindé, favicon dz, nouvelle adresse DZ en pied. **Archives mensuelles janv→juil générées** (dossier ZIP unique : `GET /api/archives.zip`).

**Email :** basculé sur **Microsoft Graph `sendMail`** depuis `dzconstruct@dzconstruct.lu` (25/08). Le nœud Gmail (`vincent@korr.lu`) reste débranché comme repli. Éprouvé par deux envois réels le 25/08. **Envoi allumé le 25/08** vers `dzconstruct@dzconstruct.lu` sur les 4 chantiers actifs (1 mail = 1 chantier) : le premier envoi automatique part au run du mercredi.

**Correctif du 21/08 — photos Teams manquantes (résolu, validé en prod) :** des photos postées dans
Teams n'apparaissaient pas dans le rapport, en silence. Cause : les nœuds `Télécharger images RT`/`BLL`
téléchargeaient les `hostedContents` d'affilée et **Microsoft Graph répondait 429** au-delà d'environ
18 requêtes par ~20 s ; comme ces nœuds sont en `onError: continueRegularOutput`, les photos perdues
disparaissaient et le run restait « Succès ». Corrigé par un **téléchargement par lots de 12 avec pause
de 15 s** (nouveaux nœuds `Lot images RT` + `Patienter RT`, et jumeaux BL&L) et par un **contrôle du
compte** (`nbImagesAttendues` vs `nbImages` dans `Assembler RT`/`BLL` → « Succès partiel » + « N photo(s)
RT non téléchargée(s) » dans le journal). Mesuré sur 25.07 Ecole-Brouch : semaine 22→28/06 passée de
30 à **66/66 photos** ; quinzaine 15→30/06 de 28 à **106 photos RT + 26 BL&L**, sans perte.
**Correctif du 02/09 — vidéos Teams comptées comme photos (résolu, testé en prod) :** cinq rapports
du batch d'archives restaient bloqués en « Succès partiel » avec exactement le même compte sur deux
passes indépendantes. Diagnostic : deux causes distinctes, aucune réparable par un nouvel essai.
(1) **Des vidéos** — postées dans Teams, elles passent par le même canal `hostedContents` que les
photos, se téléchargent très bien (`video/mp4`, 1,4 à 2 Mo), puis `Redimensionner images` les refuse
(`gm identify: No decode delegate for this image format`). Comptées comme photos attendues, elles
faisaient basculer le rapport à chaque run, indéfiniment. (2) **Des contenus supprimés côté Teams** —
Graph répond **404 NotFound** : il n'y a plus rien à récupérer. Corrigé pour (1) en écartant les
vidéos **à l'extraction** (`Extraire images RT`/`BLL`) : l'identifiant du contenu, encodé en base64,
décode en `…/views/imgo` pour une photo et `…/views/video` pour une vidéo. Elles ne sont plus comptées,
plus téléchargées (quota Graph économisé), et sont **signalées dans le journal** (« N vidéo(s) RT non
reprise(s) dans le rapport ») sans dégrader le statut. ⚠️ Le filtre est volontairement **étroit** : une
vue inconnue ou un identifiant illisible reste traité comme une photo, pour ne jamais perdre une photo
par excès de zèle. Testé en prod sur les 3 cas vidéo (tous passés en « Succès ») et en non-régression
sur un rapport de 110 photos : **PDF et Word identiques à l'octet près** avant/après.

**Deux suites traitées dans la foulée (21/08) :**
- **Poids des rapports** : récupérer toutes les photos faisait passer le Word au-delà de 25 Mo (limite
  des pièces jointes email). Les photos étaient inlinées à leur résolution d'origine (~211 Ko,
  1500×2000 px) alors que le rapport les affiche en 84 mm. Ajout des nœuds **`Redimensionner images RT`
  / `BLL`** (Edit Image, 900 px sur le grand côté, JPEG 78) → **59 Ko par photo, 3,6× plus léger, 272 dpi
  à l'impression** (le besoin réel est 150–200) : aucune perte visible. Mesuré sur 20 photos réelles ;
  alternatives écartées : 1200 px (2× seulement, on reste près de la limite) et 800 px (5×, marge plus
  courte que nécessaire).
- **Run hebdo en parallèle** : le quota Graph étant compté **par application**, 4 chantiers simultanés
  se le volaient. `Lancer génération` (workflow `DZ — Rapport hebdo`) est passé en
  **`waitForSubWorkflow: true`** → chantiers traités **un par un**, ~5 min pour les 4 actifs
  (linéaire ensuite : ~15 min si les 14 sont activés). **Ne jamais repasser en parallèle.**

**Côté Microsoft Graph : rien à demander à CBC.** Le 429 sur `hostedContents` est une limite de service
Microsoft, identique pour toute application, non réglable par tenant ; la réponse officielle est le
backoff, ce qui est en place. Écartés : le `$batch` Graph (chaque requête interne compte quand même dans
le quota) et une 2ᵉ app registration (contournement sale, complique la passation). À savoir : le quota
est **par application**, donc le futur `Mail.Send` partagera celui de `DZ-Teams-Extractor` — sans
conséquence (4 mails ne pèsent rien). Le seul levier structurel restant, **si un jour les régénérations
ou les archives deviennent pénibles** : mettre en cache les photos sur le volume du cockpit (indexées par
identifiant de photo) pour ne plus les retélécharger. ⚠️ Ça n'aide **pas** le run hebdo, dont les photos
sont neuves par définition. Non fait, non prioritaire.

**3 chantiers ouverts, pour la prochaine session :**

1. ✅ **Authentification Microsoft — FAITE le 21/08.** CBC (Adrien Olivieri, 17/08) a accordé
   `Mail.Send` sur `DZ-Teams-Extractor` et créé l'app **« DZ – Hub Rapport Technique (login) »**.
   Le login OIDC est codé (`auth.js`), déployé et allumé : le Hub n'accepte plus que les comptes
   `@dzconstruct.lu`. Détail complet dans `docs/BIBLE.md` §8. **Reste à faire par Vincent : le premier
   vrai login avec un compte DZ** (je ne peux pas le tester, il faut des identifiants Microsoft).
   ⚠️ Porte de secours si ça se verrouille : retirer une variable `MS_*` dans Railway rouvre le Hub.
   ⚠️ Le secret client de l'app login **expire** (date fixée par CBC) — à renouveler comme celui de
   l'app Teams. Et il a circulé par mail en clair : à régénérer une fois la config validée.
   **Incident du 28/08, résolu :** le secret posé le 21/08 était faux (transcrit depuis une capture
   d'écran, `I` majuscule au lieu de `l` minuscule). Francis et Fares ont eu `AADSTS7000215` en
   essayant de se connecter. Corrigé le 28/08 avec la valeur en texte, validée auprès de Microsoft
   avant d'être posée. `GET /api/health/microsoft` contrôle désormais ce secret et répond « ok »,
   « refusé : secret invalide », « refusé : secret expiré » ou le code AADSTS.
2. ✅ **Bascule email vers Graph — FAITE et ÉPROUVÉE le 25/08.** Deux envois réels vers
   `v.romano57@gmail.com` depuis `dzconstruct@dzconstruct.lu` : un rapport léger (pièce jointe
   incluse, journal propre) et le rapport Brouch de 4,9 Mo (liens seuls, journal : « email envoyé
   sans pièce jointe : il pèse 4,9 Mo… »). Graph a répondu 202 dans les deux cas.
   Le nœud Gmail est remplacé par `Préparer email Graph` (Code) + `Envoyer rapport par Graph` (HTTP
   vers `users/dzconstruct@dzconstruct.lu/sendMail`). `Mail.Send` vérifié présent dans un vrai jeton
   Graph. Le nœud Gmail reste sur le canvas, désactivé et débranché, comme repli.
   ⚠️ **Graph plafonne `sendMail` à 4 Mo** : le rapport est joint sous 3 Mo, sinon le message bascule
   sur les liens seuls **en le disant**. 2 rapports hebdo sur 32 sont concernés.
   ✅ **Envoi allumé le 25/08** : les 4 chantiers actifs (Gaichel, Bettembourg, Frisange-Ecole,
   Ecole-Brouch) ont `dzconstruct@dzconstruct.lu` en destinataire unique et `mail_actif` à true —
   **1 mail = 1 chantier**, comme décidé avec Francis. Le premier envoi automatique part au run du
   mercredi. Les 10 chantiers inactifs n'envoient rien.
   Pour tout couper : passer `mail_actif` à false sur les chantiers, ou l'interrupteur général
   `mail_actif` du nœud `Config`.
   *Reste optionnel côté CBC : la restriction `New-ApplicationAccessPolicy` sur la boîte
   `dzconstruct@dzconstruct.lu`. Adrien craignait qu'elle bride toute l'app — elle ne gouverne que les
   ressources Exchange (Mail, Calendars, Contacts) et n'a aucun effet sur Teams : on peut la poser sur
   `DZ-Teams-Extractor` sans risque, et une app dédiée au mail.send est inutile.*
3. **Bugs remontés par Francis** — Vincent apportera la liste dans la nouvelle session, à traiter.

**Décisions actées avec Francis (30/07) :** archives = 1 gros dossier **mensuel** janv→juil (✅ fait) ; envoi hebdo → **`dzconstruct@dzconstruct.lu`** (1 mail/chantier) ; auth = **tout `@dzconstruct.lu`** ; nouvelle adresse DZ = **195 Z.A.E. Wolser F, L-4026 Bettembourg** (✅ dans les pieds de page). **PDFShift** est passé en **forfait payant** (le gratuit 50/mois ne suffit pas : ~56 PDF/mois en régime hebdo).

**⚠️ Environnement :** le conteneur peut être **recloné** entre sessions (working dir revenu à l'état initial constaté le 30/07) — le vrai état est sur le remote GitHub : au démarrage, `git fetch origin main` puis `git checkout -B main origin/main` (tout est fusionné sur `main` depuis le 21/08). Le **MCP n8n peut demander une ré-autorisation** (OAuth) en début de session.

## État des lots Phase 2

| Lot | État |
|---|---|
| 1 — Champs Traxxeo enrichis | ✅ **Terminé le 15/07, validé en réel.** Les 8 champs de Francis sont dans le rapport : sous-ligne Personne « qualification · catégorie · mat. NNN », cellule Tâche « activité (FR seul, découpe sur " / ") + commentaire libre en sous-ligne ». Reste : confirmer avec Matthieu que `company_nr` = matricule paie |
| 2 — Word (.docx) | ✅ Fait (html-to-docx via cockpit) |
| 3 — Cockpit config + découverte auto | ✅ Fait (Data Tables + scan Teams ; Excel SharePoint abandonné au profit des Data Tables n8n) |
| 4 — Dépôt des rapports | ✅ **Tranché par Francis (30/07)** : les rapports hebdo partent par **email à `dzconstruct@dzconstruct.lu`** (1/chantier), DZ classe ensuite. Pas de dépôt SharePoint direct pour l'instant. Reste : bascule email Graph (attente CBC). |
| 5 — Déclenchement | ✅ Fait (webhook à la demande + cron hebdo configurable) |
| 6 — BETA Gaichel (démo Walter) | **Prêt** (hors envoi email DZ — bascule Graph en attente CBC) |
| 7 — GAMMA (backfill) | ✅ **Fait le 30/07** : archives **mensuelles** janv→juil (ZIP `/api/archives.zip`). *(Format mensuel décidé avec Francis, pas hebdo.)* |

## Roadmap

Fait le 13/07 au soir (session « déploiement roadmap ») :

- ✅ **« Comment ça marche ? »** — page `/guide` intégrée au cockpit (chaîne de bout en bout, contenu du rapport, nommage Teams `-BL&L-`/`-RT-` avec exemples, activation d'un chantier pas à pas, rôle de chaque page, run du mercredi, envoi email, suppression/restauration, contacts Vincent/Benoît/Matthieu). Première version complète rédigée en autonomie : **à faire relire par Vincent**, le contenu s'ajuste dans `public/guide.html`.
- ✅ **Soft-delete des chantiers** — colonne `supprime` dans dz_chantiers ; suppression cockpit = marquage (`supprime=true, actif=false`) ; restauration en un clic (bloc « Chantiers supprimés » du Dashboard) ; run hebdo et scan de découverte ignorent ces lignes. Testé en réel (chantier `00.00-Test-SoftDelete`, id 18, laissé en supprimé comme exemple).
- ✅ **Générer + envoyer en une action** — bouton scindé sur la carte chantier ; drapeau `envoyer` propagé webhook → orchestrateur → générateur (6e condition du IF « Envoi email ? »).
- ✅ **Favicon** — `public/favicon.png` : le « dz » rouge seul.

Reste, par priorité (détail dans « Point de situation » en tête) :

1. **Authentification Microsoft** + **bascule email vers Graph `Mail.Send`** (boîte `dzconstruct@dzconstruct.lu`) — **en attente des credentials CBC** (2 apps, cf. Point de situation). Une fois reçus : coder le login OIDC dans le cockpit, protéger les pages, et remplacer le nœud Gmail par un appel Graph `sendMail` (from = `dzconstruct@dzconstruct.lu`).
2. **Bugs Francis** — à traiter dès que Vincent apporte la liste.
3. **Config envoi hebdo** : mettre `dzconstruct@dzconstruct.lu` en destinataire sur les chantiers actifs + `mail_actif` (à faire au moment d'allumer l'envoi auto, après la bascule Graph).
4. **Relecture du guide `/guide`** par Vincent (et Francis ?), puis en tirer un **manuel PDF** si demandé.
5. *(Qualité, non bloquant)* Remplacer les secrets en clair des nœuds n8n (client_secret Graph dans les 2 `Auth Microsoft`, clé PDFShift dans `Convertir en PDF`) par des credentials n8n — à la main dans l'UI. Et poser `EXECUTIONS_DATA_MAX_AGE=168` (ou `EXECUTIONS_DATA_PRUNE`) sur le service n8n Railway (les archives du 30/07 ont été passées en **lots surveillés** sans toucher à la config, pour ne pas redémarrer n8n — mais le réglage reste souhaitable en production).

**Fait récemment (au-delà du 13/07) :** Traxxeo actif + champs enrichis (15/07) ; email Gmail OAuth2 + fix topologie `Journaliser fin` (15/07) ; retouches rapport suite retours Francis (Word lisible, total du jour, footer nom+`x/y` agrandi/remonté, mode compatibilité Word levé) ; nouvelle adresse DZ ; contacts du guide complétés (CBC `support@cbc.lu`, Traxxeo helpdesk via Fares `dzconstruct@dzconstruct.lu`) ; **archives GAMMA mensuelles janv→juil générées + endpoint `/api/archives.zip`** (30/07).

### Hors périmètre (garder au chaud)
- Bascule conversation Teams → canal : faisable (~mêmes endpoints Graph, quelques heures), uniquement si DZ fait évoluer son usage de Teams. Ne pas anticiper.

