# Conventions, questions à Francis, passation, budget (extrait verbatim de l'ancien CLAUDE.md, 21/09/2026)

## Conventions de travail

- Communication en **français**, registre informel, explications simples sans jargon.
- **Une action à la fois, confirmation avant de continuer.** Jamais de batch d'étapes sans accord explicite.
- Nœuds n8n référencés par leur **nom exact français** (accents et casse) : `Fusionner sources`, `Préparer rapport`, `Lire messages BLL`, `Config`…
- Ne pas rouvrir de décisions closes. Pas d'analyse non sollicitée.
- Vincent n'est pas développeur pur : instructions opérationnelles précises (quel nœud, quel champ, quel code à coller) ; pour Railway/Gmail, guider écran par écran.
- **Jamais de secrets dans le repo ni dans les fichiers** (tokens, client_secret, tenant ID). Les credentials vivent dans n8n.
- L'UI du cockpit est en français, épurée, palette DZ (`--rouge:#ff110b`, `--gris:#8a8a81`) ; toute évolution d'UI se vérifie par capture d'écran avant d'annoncer que c'est fait.
- Tenir `docs/BIBLE.md` et la page `/guide` alignés avec l'outil.

## Pour Francis — questions & points fragiles

À dérouler avec Francis (démo BETA fin juillet ou avant). Les réponses conditionnent la fin de la Phase 2.

### Questions — réponses reçues le 30/07 ✅, et ce qui reste ouvert
1. ✅ **Dépôt des rapports (Lot 4)** → **email à `dzconstruct@dzconstruct.lu`** (1/chantier), DZ classe ensuite. Pas de SharePoint direct.
2. ✅ **Adresse expéditrice** → **`dzconstruct@dzconstruct.lu`** (émetteur = destinataire), via Microsoft Graph `Mail.Send`.
5. ✅ **Accès à l'outil** → **tout compte `@dzconstruct.lu`** (auth Microsoft single-tenant).
3. ⏳ **Conversations RT non alimentées** (encore ouvert) : semaine testée = 0 message RT sur les 11 chantiers équipés (BL&L actives). Les équipes savent-elles qu'elles doivent poster les explications techniques dans la conversation RT ? 3 chantiers sans conversation RT du tout (26.06 Maison-OMS, 26.07 MaisonFluhe, 99.02 Chantiers-Divers) — à créer ?
4. ⏳ **Compte assembleur dans chaque conversation** (encore ouvert) : la découverte ne voit que les conversations dont `assembleur@dzconstruct.lu` est membre. Options : (a) règle « toujours inclure assembleur@ à la création » (simple mais fragile) ; (b) basculer vers des **canaux d'équipe Teams** → lecture sans compte invité (~quelques heures). À trancher selon l'usage Teams de DZ.

### Points fragiles à connaître (état au 13/07)
- ✅ **Cockpit fermé** (21/08) : login Microsoft, comptes `@dzconstruct.lu` uniquement. L'URL peut être diffusée. Les fichiers de rapports (`/reports/`) sont protégés eux aussi ; n8n y accède avec un jeton de service (`X-Cockpit-Token`). Si un partage externe devient nécessaire, `RAPPORTS_PUBLICS=true` dans Railway les rouvre.
- **Emails** : bascule sur **Microsoft Graph `sendMail`** depuis `dzconstruct@dzconstruct.lu` (25/08). Le nœud Gmail reste débranché comme repli. ⚠️ Limite Graph de 4 Mo : au-delà, le rapport part sans pièce jointe, avec mention dans le message et dans le journal.
- **Secret Microsoft qui expire** : le client_secret de l'app « DZ-Teams-Extractor » a une date d'expiration fixée par CBC — à renouveler avant échéance sinon plus de lecture Teams (et prévenir Vincent pour la mise à jour dans n8n).
- **Comptes personnels de Vincent** : Railway, PDFShift et le Gmail de test sont sur ses comptes — la passation vers des comptes DZ est décrite dans la section « Passation à DZ » ci-dessous.
- **PDFShift** : ✅ **forfait payant** (le gratuit 50/mois ne suffit pas au régime hebdo ~56 PDF/mois). Chaque PDF = 1 crédit ; surveiller le solde. Option future si on veut supprimer ce coût/ce tiers : auto-héberger la conversion HTML→PDF (Chromium) dans le cockpit — non fait, à ne considérer que si la confidentialité des données RH devient un sujet chez DZ.

## Passation à DZ (séquence technique)

Objectif : plus rien ne dépend des comptes personnels de Vincent. À dérouler dans cet ordre, le moment venu :

1. **Comptes à créer côté DZ** (préalable) : un compte **Railway** avec facturation DZ ; un compte **PDFShift** — le Microsoft est déjà chez DZ (tenant CBC), et la boîte d'envoi retenue est **`dzconstruct@dzconstruct.lu`** (existe déjà).
2. **GitHub** : transférer le repo `vincentrmn/dz` vers une organisation DZ (Settings → Danger Zone → Transfer ownership). Les URLs de clone changent, rien d'autre.
3. **Railway — cockpit** : transférer le projet `dz` vers le workspace DZ (Project → Settings → Transfer project) — le **volume `/app/data` suit le projet** (les rapports sont conservés). Rebrancher ensuite le service sur le repo GitHub transféré (Settings du service → Source) et vérifier la variable `N8N_WEBHOOK_BASE`.
4. **Railway — n8n** : transférer le projet `pacific-endurance` (n8n + Postgres, le volume suit aussi). Alternative propre si le transfert coince : réinstaller n8n chez DZ et réimporter (voir 5).
5. **n8n — export/réimport** (seulement si nouvelle instance) : exporter les 4 workflows en JSON (menu ⋯ → Download) et les Data Tables en CSV ; réimporter ; **republier** chaque workflow ; reporter l'URL de la nouvelle instance dans `N8N_WEBHOOK_BASE` du cockpit.
6. **Credentials à recréer dans n8n côté DZ** : Microsoft Graph (l'app « DZ-Teams-Extractor » est déjà dans le tenant DZ : reporter client_id/secret, CBC peut générer un nouveau secret) ; Traxxeo (identifiants du contrat DZ) ; PDFShift (clé du nouveau compte, à poser dans `Convertir en PDF`) ; envoi email (Graph `Mail.Send` une fois la bascule faite). Renseigner les nœuds `Auth Microsoft` ×2, `Auth Traxxeo`, `Convertir en PDF`.
7. **Accès humains** : ajouter le(s) admin(s) DZ sur Railway, n8n (compte owner), GitHub ; retirer les accès de Vincent à la fin.
8. **Validation post-passation** : une génération manuelle Gaichel (Succès dans Debug, PDF + Word téléchargeables) ; attendre un mercredi (cron OK) ; un envoi email test ; un scan de découverte. Ensuite seulement, fermer les anciens comptes.

Points d'attention : le **secret Microsoft expire** (date fixée par CBC — calendrier de renouvellement) ; les rapports du volume et l'historique dz_runs survivent au transfert de projet Railway mais **pas** à une recréation de service (copier `/app/data` avant si besoin) ; après bascule GitHub, vérifier que l'auto-deploy pointe sur la bonne branche.

## Contrainte budget

Enveloppe facturée : **1 à 2 jours** (choix assumé de Vincent, service à Francis). L'effort réel est supérieur : privilégier systématiquement la solution la plus simple qui remplit le besoin, réutiliser l'existant, ne rien construire de spéculatif.

## Définition of done Phase 2

- Rapport hebdo Gaichel généré automatiquement le mercredi, PDF + Word, chapitres complets avec champs Traxxeo enrichis et totaux journée. ✅ *(Validé en réel le 15/07.)*
- Nouveau chantier activable par configuration (procédure Fares = « Comment ça marche ? »).
- Rapports déposés selon l'option retenue par Francis. *(Reste : décision + implémentation.)*
- Envoi email opérationnel. ✅ *(Gmail OAuth2 validé le 15/07 ; bascule Graph/boîte DZ pour la prod.)*
- Backfill GAMMA depuis janvier 2026 classé. *(Après offre Traxxeo.)*
