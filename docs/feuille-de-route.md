# Feuille de route

À faire, prochaine étape, ce qui attend l'humain. Mis à jour en fin de session.

## Prochaine étape
- Plan Gaichel terminé (PR #3 et #5 livrées le 21/09). Le 22/09, après un premier message posté par
  DZ dans les conversations `22.06A-…` et `22.06C-…` (Teams ne les crée côté serveur qu'à ce
  moment-là), le scan 10006 a complété les fiches A et C : six conversations distinctes sur A/B/C.
  Le run du mercredi 23/09 7 h produira trois rapports Gaichel complets. Prochaine étape : les bugs
  remontés par Francis (liste à venir) et la vérification connectée du Dashboard et de `/guide`.

## À faire
- [ ] Nouvelle fiche `26.05-Logements-Leudelange` (id 22) créée inactive par le scan du 22/09 :
      DZ vérifie le nom et le WBS, puis l'active si le chantier doit avoir son rapport.
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
- 22/09 : conversations A et C rattachées par le scan 10006 après le premier message posté par DZ
  (cause du blocage : une conversation Teams sans message n'existe pas encore pour Graph) ; plan
  Gaichel terminé de bout en bout ; fiche `26.05-Logements-Leudelange` découverte, inactive.
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
