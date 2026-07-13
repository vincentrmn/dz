# Manuel d'utilisation — Rapport Technique DZ Construct

*Génération automatique des rapports techniques hebdomadaires par chantier.*
*Version 2.1 — juillet 2026*

---

## 1. Comment ça marche, en deux mots

Chaque semaine, le système assemble automatiquement, **pour chaque chantier actif**, un rapport organisé **jour par jour** avec trois chapitres :

1. **Activité des équipes** — les heures pointées dans **Traxxeo** : qui a travaillé, sur quelle tâche, avec quel équipement, avec le **total de la journée par personne**.
2. **Illustrations et explications techniques** — les messages et photos postés dans la conversation Teams **RT** du chantier.
3. **Matériel et bons de livraison** — les messages et photos postés dans la conversation Teams **BLL**.

Les textes et les photos sont repris **tels quels**, sans reformulation ni tri : ce que l'équipe écrit dans Teams est ce qui apparaît dans le rapport.

Le rapport est produit en **PDF**, en **Word** et en **aperçu HTML** (consultable dans le navigateur), puis déposé dans le Hub. Si une liste d'emails est renseignée pour le chantier, le rapport part aussi **par email**.

**Le rythme automatique :** tous les **mercredis à 7h00**, le système génère les rapports de la **semaine précédente** (lundi → dimanche) pour tous les chantiers actifs. Vous pouvez aussi générer un rapport à la demande, pour n'importe quelle semaine.

---

## 2. Le Hub (cockpit web)

Adresse : `https://cockpit-production-c3dc.up.railway.app`

Trois pages, accessibles depuis le menu en haut :

| Page | À quoi elle sert |
|---|---|
| **Chantiers** | Configurer les chantiers, lancer une génération, activer/désactiver |
| **Rapports** | Retrouver et télécharger tous les rapports, classés par chantier et par semaine |
| **Debug** | Vérifier que tout va bien : état du système et journal des générations |

---

## 3. Générer un rapport à la demande

1. Page **Chantiers**, choisir la **semaine** dans le sélecteur en haut (par défaut : la semaine dernière).
2. Cliquer sur **« Générer le rapport »** sur la carte du chantier voulu.
3. La génération part en arrière-plan (quelques secondes à 1-2 minutes selon le nombre de photos). Suivre l'avancement sur la page **Debug**.
4. Récupérer le résultat sur la page **Rapports** (PDF, Word, Aperçu).

> **Remarque** : le bouton « Générer » fonctionne aussi sur un chantier **inactif** — pratique pour tester un chantier avant de l'activer. Le run automatique du mercredi, lui, ne traite que les chantiers **actifs**.

### Le bouton « Démo », à quoi ça sert ?

**Démo** génère un rapport avec des **données d'exemple** (équipes, messages et photos fictifs) en passant par toute la vraie chaîne de fabrication (mise en page, PDF, Word, dépôt) — mais **sans toucher** à Teams, Traxxeo ni à la liste d'emails.

C'est utile pour :
- montrer à quelqu'un à quoi ressemble un rapport, sans données réelles ;
- vérifier que la chaîne complète fonctionne (après une modification, par exemple) ;
- former un nouvel utilisateur sans risque.

Le rapport démo est clairement marqué « DÉMONSTRATION — données d'exemple » sur sa page de garde.

---

## 4. Les chantiers

### La fiche chantier

Chaque carte de la page **Chantiers** contient :

| Champ | Contenu | Exemple |
|---|---|---|
| **Interrupteur + badge ACTIF** | Inclus (ou non) dans le run automatique du mercredi | — |
| **Codes WBS Traxxeo** | Les codes analytiques du chantier dans Traxxeo, séparés par `;` | `22.06 A;22.06 B` |
| **ID conversation Teams — BLL** | Identifiant technique de la conversation « bons de livraison » | `19:xxxx@thread.v2` |
| **ID conversation Teams — RT** | Identifiant technique de la conversation « rapport technique » | `19:xxxx@thread.v2` |
| **Envoi par email** | Destinataires du rapport, séparés par `;` (laisser vide = pas d'envoi) | `francis@dzconstruct.lu;fares@dzconstruct.lu` |

Après modification, cliquer sur **« Enregistrer les modifications »** en bas de la carte.

### Ajouter un chantier : la méthode recommandée (automatique)

1. Dans Teams, créer (ou faire créer) les deux conversations de groupe du chantier en incluant le compte **assembleur@dzconstruct.lu**, avec `-BLL-` et `-RT-` dans leur nom.
   Exemple : `CH:23-04 Rue Neuve -BLL- Livraisons` et `CH:23-04 Rue Neuve -RT- Rapport technique`.
2. Sur la page Chantiers, cliquer **« Lancer la découverte »** (sinon, elle tourne seule chaque lundi à 6h30).
3. Le chantier apparaît en **inactif**, avec les IDs de conversations déjà remplis et le code chantier détecté.
4. Vérifier/compléter les **codes WBS** (les mêmes que dans Traxxeo — en cas de doute, les demander au responsable Traxxeo), ajouter les emails si besoin, **Enregistrer**, puis passer l'interrupteur sur **actif**.

### Comment fonctionne « Lancer la découverte » ?

La découverte parcourt **toutes les conversations Teams** du compte assembleur et repère celles dont le nom contient `-BLL-` ou `-RT-`. Elle regroupe les paires appartenant au même chantier (en normalisant les codes : `CH:22-06 B` côté Teams = `22.06 B` côté Traxxeo), ignore celles déjà connues, et crée les nouvelles lignes **en inactif**. Rien n'est jamais activé automatiquement : la validation finale reste humaine — on vérifie la ligne, puis on l'active.

### Ajouter un chantier à la main

Bouton **« + Ajouter un chantier »** → saisir le nom → compléter la carte :
- **WBS** : recopier les codes du chantier tels qu'ils existent dans Traxxeo (plusieurs codes séparés par `;`) ;
- **IDs de conversations** : le plus simple est de laisser vide et de lancer la découverte (si les conversations respectent la convention `-BLL-`/`-RT-`, elles seront associées). Un ID peut aussi être collé à la main si on le connaît.

---

## 5. La page Rapports

Les rapports sont **classés par chantier**, puis par **semaine** (la plus récente en premier), avec la date et l'heure de génération. Un filtre par chantier est disponible en haut.

Pour chaque semaine, trois documents :
- **PDF** — le document de référence à diffuser/classer ;
- **DOCX** — la version Word, modifiable ;
- **Aperçu** — la version consultable directement dans le navigateur.

Chaque rapport mentionne la **date et l'heure de génération** sur sa page de garde et en pied de chaque page.

> Regénérer la même semaine du même chantier **remplace** les documents précédents (pas de doublon).

---

## 6. L'envoi par email

Si le champ **« Envoi par email »** d'un chantier contient des adresses (séparées par `;`), chaque rapport généré pour ce chantier (hors mode démo) est envoyé automatiquement à ces destinataires : liens de téléchargement + le document en pièce jointe.

L'envoi utilise le compte SMTP configuré dans n8n. *(Activation initiale : voir MISE-EN-SERVICE.md — un interrupteur `mail_actif` doit être passé à `true` une fois l'expéditeur validé.)*

---

## 7. La page Debug

### État du système
Quatre voyants : le **cockpit** lui-même, la connexion à **n8n** (le moteur), le **stockage des rapports**, et la version. Tout doit être vert.

### Journal des générations
Chaque ligne = une génération, avec :

| Statut | Signification |
|---|---|
| **EN COURS** | La génération tourne (normal pendant 1-2 minutes) |
| **SUCCÈS** | Tout s'est bien passé |
| **SUCCÈS PARTIEL** | Le rapport existe mais une étape a échoué (le détail dit laquelle — ex : PDF manquant) |
| **ERREUR** | La génération a échoué — voir le détail et l'aide au diagnostic |

La colonne **Détails** donne les statistiques du run (nombre de lignes Traxxeo, messages et photos par conversation) et, en cas de problème, l'étape en cause.

### En cas de problème
Suivre l'« Aide au diagnostic » en bas de la page Debug. Pour aller plus loin : ouvrir n8n → workflow « DZ — Générer rapport chantier » → onglet Executions → le run en erreur montre exactement quel nœud a échoué et pourquoi.

---

## 8. Questions fréquentes

**Le chapitre RT (ou BLL) est vide, c'est normal ?**
Oui si rien n'a été posté dans la conversation cette semaine-là. Le rapport l'indique explicitement (« Aucun élément publié... »). Pour les semaines antérieures à l'usage de Teams, c'est attendu.

**Le chapitre Traxxeo est vide ?**
Vérifier que l'accès API Traxxeo est actif (offre commerciale) et que les codes WBS de la fiche chantier correspondent exactement à ceux de Traxxeo.

**Samedi et dimanche n'apparaissent pas ?**
Les jours de week-end sans aucune donnée sont omis pour alléger le rapport. Dès qu'il y a de l'activité un samedi, il apparaît.

**Puis-je générer une semaine d'il y a plusieurs mois ?**
Oui : choisir la semaine dans le sélecteur et générer. C'est le principe du rattrapage d'historique (backfill).

**Qui reçoit les emails ?**
Uniquement les adresses du champ « Envoi par email » du chantier concerné. Champ vide = personne.

---

## 9. Sous le capot (pour information)

| Brique | Rôle |
|---|---|
| **Hub / cockpit** (Railway, service `cockpit`) | Interface web, stockage des rapports, conversion Word |
| **n8n** (Railway) | Le moteur : 4 workflows (`DZ — Rapport hebdo`, `DZ — Générer rapport chantier`, `DZ — Découverte chantiers`, `DZ — Cockpit API`) |
| **Tables n8n** | `dz_chantiers` (la configuration que vous éditez dans le Hub) et `dz_runs` (le journal de la page Debug) |
| **Microsoft Graph** | Lecture des conversations Teams du compte assembleur |
| **Traxxeo** | Heures pointées (`person_hrd`) |
| **PDFShift** | Conversion HTML → PDF |

Les horaires : rapports le **mercredi 7h00**, découverte le **lundi 6h30**.
