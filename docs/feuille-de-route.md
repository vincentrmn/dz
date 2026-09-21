# Feuille de route

À faire, prochaine étape, ce qui attend l'humain. Mis à jour en fin de session.

## Prochaine étape
- Lot 1 du plan `docs/plans/gaichel-trois-rapports.md` fait, PR #3 ouverte
  (https://github.com/vincentrmn/dz/pull/3). Reste le lot 2 (découverte : normalisation de la clé
  et lettre collée, guide, BIBLE, CLAUDE.md, communication à Francis) avant le scan du lundi
  28/09 06:30.

## À faire
- [ ] Saisir dans le Dashboard les IDs des conversations Teams `22.06A-…` et `22.06C-…` (RT et
      BL&L) dès que Francis a ajouté `assembleur@dzconstruct.lu` (demande faite le 21/09).
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

## Fait
- 21/09 : lot 1 Gaichel (normalisation WBS publiée, fiches 22.06A/B/C, fiche 1 désactivée, chapitre 1
  de Gaichel rétabli après un mois à 0 ligne).
- 21/09 : plan Gaichel A/B/C validé et fusionné ; workflow korr installé (agents, skills, portiques,
  CI, check, règles, mémoire rangée).
- 02/09 : vidéos Teams écartées à l'extraction. 25/08 : email par Graph allumé sur les chantiers
  actifs. 21/08 : login Microsoft, lots d'images, redimensionnement. 30/07 : archives mensuelles.
