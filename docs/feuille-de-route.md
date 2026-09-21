# Feuille de route

À faire, prochaine étape, ce qui attend l'humain. Mis à jour en fin de session.

## Prochaine étape
- PR #3 (lot 1) livrée le 21/09 (merge `9321b28`, déploiement Railway SUCCESS, smoke en ligne PASS).
  PR #5 (lot 2) livrée le 21/09 (merge `17def40`, déploiement Railway `39b2c671` SUCCESS, smoke en
  ligne PASS) : plan Gaichel terminé côté outil. Prochaine étape : trancher avec Francis si les
  conversations `22.06A-…` et `22.06C-…` sont des conversations de groupe (à recréer, le compte
  assembleur n'y étant vu dans aucune) ou des canaux d'une équipe Teams (l'outil ne lit que les
  conversations de groupe aujourd'hui, décision à prendre pour y ajouter le support) ; voir le
  constat du 21/09 dans `docs/journal/2026-09-21-construire-gaichel-lot-2.md`. Ensuite seulement,
  saisir leurs IDs dans le Dashboard.

## À faire
- [ ] Envoyer à Francis le texte préparé le 21/09 (lettre collée, tolérance à l'espace, trois mails
      Gaichel le mercredi, ajout du compte assembleur aux conversations `22.06A-…`/`22.06C-…`, anciennes
      conversations `22.06-RT-…`/`22.06-BL&L-…` déjà renommées en B, rien à archiver) et, avec ce
      texte, la question du constat du 21/09 : où Francis voit-il ces conversations (onglet
      « Conversation » ou une équipe Teams) ? Le scan 9769 ne trouve, pour le compte assembleur,
      aucune conversation de groupe `22.06A-…` ni `22.06C-…`.
- [ ] Saisir dans le Dashboard les IDs des conversations Teams `22.06A-…` et `22.06C-…` (RT et
      BL&L) une fois le cas groupe/canaux tranché avec Francis.
- [ ] Vérifier après la première saisie de ces IDs que le scan de découverte suivant (lundi 28/09
      06:30, ou manuel) complète les fiches 19 et 21 sans créer de doublon.
- [ ] Bugs remontés par Francis : Vincent apporte la liste, à traiter.
- [ ] Premier vrai login avec un compte DZ (Vincent ne peut pas le tester) ; puis régénérer le
      secret client de l'app login (il a circulé en clair) et noter sa date d'expiration.
- [ ] Relecture du guide `/guide` par Vincent (et Francis), manuel PDF si demandé.
- [ ] Qualité, non bloquant : credentials n8n à la place des secrets en clair dans `Auth Microsoft`
      ×2 et `Convertir en PDF` ; `EXECUTIONS_DATA_MAX_AGE=168` sur le service n8n Railway.
- [ ] Confirmer avec Matthieu (Traxxeo) que `company_nr` est bien le matricule paie.
- [ ] Optionnel côté CBC : `New-ApplicationAccessPolicy` sur `dzconstruct@dzconstruct.lu`.
- [ ] Questions ouvertes à Francis : conversations RT non alimentées ; compte assembleur dans chaque
      conversation (ou canaux d'équipe Teams).

## Ce qui attend Vincent (workflow korr, 21/09)
- [ ] Protéger `main` sur GitHub : Settings, Branches, « Require status checks to pass », choisir `check`.
- [ ] Décider d'un staging Railway pour le cockpit (aujourd'hui : un seul service, déploiement
      direct de `main`).
- [ ] Vérifier en session connectée (login Microsoft) le Dashboard (quatre cartes Gaichel : trois
      actives A/B/C, une inactive) et la page Rapports (rapports A/B/C du 14→20/09) sur la prod.
- [ ] Vérifier en session connectée (ou avec le jeton donné en chat) que `/guide` en ligne contient
      bien les exemples `22.06A-…` (non testé depuis ici, le MCP Railway masque les variables).

## Fait
- 21/09 : lot 2 Gaichel livré (PR #5, `17def40`, déploiement Railway `39b2c671` SUCCESS, smoke en
  ligne PASS) : découverte n8n corrigée pour la lettre collée, guide, BIBLE, CLAUDE.md, texte à
  Francis rédigé. Reste ouvert : le compte assembleur n'est vu dans aucune conversation de groupe
  `22.06A-…`/`22.06C-…` d'après le scan 9769, malgré ce que dit Francis ; hypothèse de canaux Teams.
- 21/09 : lot 1 Gaichel livré (PR #3, normalisation WBS publiée, fiches 22.06A/B/C, fiche 1
  désactivée, chapitre 1 de Gaichel rétabli après un mois à 0 ligne).
- 21/09 : plan Gaichel A/B/C validé et fusionné ; workflow korr installé (agents, skills, portiques,
  CI, check, règles, mémoire rangée).
- 02/09 : vidéos Teams écartées à l'extraction. 25/08 : email par Graph allumé sur les chantiers
  actifs. 21/08 : login Microsoft, lots d'images, redimensionnement. 30/07 : archives mensuelles.
