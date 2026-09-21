# Microsoft Graph / Teams : acquis (extrait verbatim de l'ancien CLAUDE.md, 21/09/2026)

## Microsoft Graph / Teams — acquis

- Convention de nommage **réelle** des conversations : `-BL&L-` (et non `-BLL-`) et `-RT-` dans le sujet du groupe.
- Pagination messages : `?$top=50` **dans l'URL** (jamais en queryParameters : erreur 400 « $top specified more than once ») ; condition de fin `{{ !$response.body["@odata.nextLink"] }}` — ne référencer **aucun autre nœud** dans les expressions de pagination (échec silencieux).
- Images de messages : `chats/{id}/messages/{msgId}/hostedContents/{hcId}/$value`.
- **Throttling `hostedContents` (mesuré le 21/08)** : Graph plafonne à **~18 requêtes par ~20 s par
  application** et renvoie **429** au-delà ; le quota se recharge tout seul en cours de run. Ralentir le
  débit ne suffit pas (testé à 4/300 ms, 1/500 ms et 1/1500 ms : toujours ~30 photos récupérées sur 66).
  Seule parade efficace : **lots de 12 + pause de 15 s** entre les lots (`splitInBatches` + `Wait`).
  Débit soutenable observé ≈ 0,6 photo/s ; compter ~2 min pour 100 photos.
- 15 chantiers découverts par scan ; 3 sans conversation RT (26.06 Maison-OMS, 26.07 MaisonFluhe, 99.02 Chantiers-Divers) ; la semaine testée, RT vide partout → **question posée à Francis** (pourquoi les RT ne sont pas alimentés) — pas un bug.

