# RFC-008 — Runs et ordre d’exécution

Exemple :
```json
{
  "runName": "member",
  "user": "member",
  "order": 1,
  "routes": ["member-home", "member-calendar", "member-stay"]
}
```

`runName` unique. `order` trie les runs ; en cas d’égalité, ordre du fichier. L’ordre du tableau `routes` est l’ordre exact des captures. Les routes sont référencées par ID.

Chaque run crée un contexte Playwright indépendant. Conflit entre user du run et user de route = erreur.

Construire un plan d’exécution typé avant d’ouvrir le navigateur.

Erreurs : `RUN_NOT_FOUND`, `ROUTE_NOT_FOUND`, `USER_CONFLICT`.

## Critères d’acceptation
Tests ordre runs, égalité, ordre routes, route inconnue, conflit user, run public, plan complet.

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
