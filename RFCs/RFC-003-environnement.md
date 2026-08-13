# RFC-003 — Variables d’environnement

## Objectif
Résoudre les valeurs littérales et `${VARIABLE}`.

## Priorité
1. valeur littérale ; 2. `process.env` ; 3. `.env.local` ; 4. `.env`.

Les fichiers sont cherchés depuis `workingDirectory`. Supporter plusieurs interpolations par chaîne. Ne jamais exécuter de code ni logger de secret.

Erreur : `ENV_VARIABLE_MISSING`, avec le nom de variable uniquement.

## Critères d’acceptation
Tests de priorité, interpolation multiple, valeur littérale, variable absente, absence de fuite de secrets.

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
