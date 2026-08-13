# RFC-004 — Modèle des routes dynamiques

## Route statique
```json
{ "id": "member-calendar", "path": "/member/calendar", "enableSnapshot": true, "user": "member" }
```

## Route dynamique
```json
{
  "id": "member-stay",
  "path": "/member/stays/[stayId]",
  "isDynamic": true,
  "parameters": { "stayId": "seed-stay-123" },
  "enableSnapshot": true,
  "user": "member"
}
```

Supporter plusieurs paramètres et `snapshotPath` comme override. Priorité : `snapshotPath`, sinon substitution de `path`.

Validation stricte : paramètres manquants, paramètres inconnus, encodage URL, IDs uniques.

Erreurs : `ROUTE_NOT_FOUND`, `DYNAMIC_PARAMETER_MISSING`, `DYNAMIC_PARAMETER_UNKNOWN`.

## Critères d’acceptation
Tests statique, un paramètre, plusieurs paramètres, encodage, manquant, inconnu, override.

## Règles communes

- Un seul commit pour cette RFC.
- Ne pas implémenter les RFC suivantes par anticipation.
- TypeScript strict.
- Aucun `any`.
- Éviter `as unknown as`.
- Tous les types métier doivent rester dans `src/types/`.
- Les schémas de validation doivent rester dans `src/schemas/`.
- Pas de dépendance circulaire.
- Pas de gros fichiers mélangeant plusieurs responsabilités.
- Ajouter ou mettre à jour les tests du périmètre.
- Exécuter les validations disponibles.
- Fournir les fichiers modifiés, décisions, tests, résultats exacts, limites restantes et un message de commit proposé.

EOP
