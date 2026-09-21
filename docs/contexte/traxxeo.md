# Traxxeo : acquis (extrait verbatim de l'ancien CLAUDE.md, 21/09/2026)

## Données Traxxeo — acquis

- OAuth2 sur `https://ords.traxxeo.com/oauth/token` (Basic Auth, `grant_type=client_credentials`, form-urlencoded) ; données via `https://ords.traxxeo.com/api/v2/person_hrd` avec `all_data=Y` et `from_date`/`to_date` en `DD/MM/YYYY`.
- Gaichel = WBS `22.06 A` + `22.06 B` (pas de nœud parent `22.06` : filtrer côté code).
- Garder uniquement `work_code_name.trim() === 'Heure travail'` ; exclure « Jour férié », « Congé », « Heure trajet ».
- Dates reçues en `DD/MM/YYYY` → convertir en `YYYY-MM-DD`.
- `user_comment` rempli à ~70 % en prod (`'Calculated'` = vide) ; `declared_vehicle_name` = équipement ; `work_duration` = heures de la ligne. **Ne jamais utiliser « Heures déclarées visibles »** (total journée) comme heures de ligne.
- Doc publique `rest.traxxeo.com` = coquille vide ; la vraie doc est `wiki-api.traxxeo.com`.
- **Inventaire des champs prod (15/07, 508 lignes person_hrd inspectées)** — les champs demandés par Francis existent :
  - Catégorie employeur : `company_name` (`DZ CONSTRUCT`/`ARHIS`/`KENOB`/`IMPULSE`), `person_category_name` (`DZC`/`Arhis`/…/`Étudiants`), `employee_contract_type_name` (`Worker`/`Interim`).
  - Qualification : `qualification_name` (~72 % rempli) — `Coffreur B1/B2/B3/BD`, `Maçon B1-B3`, `Manoeuvre A2`, `Grutier F2`, `Chef d'équipe G1`…
  - Activité (liste finie, distincte de `user_comment`) : `activity_code` + `activity_name` (~90 %, 17 codes : `6-C` Coffrage, `6-B` Bettonage, `4-D` Dallage…) + famille `parent_activity_name` (10 valeurs : `GO BETON & FER COFFRAGE`…).
  - Code personne : `person_erp_id`/`person_identifier` **null même en prod** ; mais `company_nr` est en réalité un **matricule par personne** (086, 165…, ~70 valeurs distinctes) et `person_erp_company_code` = `10`+matricule — ⚠️ à confirmer avec Matthieu que c'est le matricule paie ; ne PAS utiliser `company_nr` comme catégorie société.
  - ⚠️ **Espaces de fin** dans tous les libellés Traxxeo (`"DZC "`, `"Chef de chantier "`) : toujours `trim()`.
  - Autres `work_code_name` vus : `Absence`, `Accident de travail`, `Maladie`, `Heure trajet` — le filtre `'Heure travail'` les exclut correctement.

