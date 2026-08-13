# RFC-006 — Commande `snaprun scan`

Commandes :
```bash
snaprun scan
snaprun scan --default=enabled
snaprun scan --default=disabled
```
Par défaut : disabled.

Ajouter uniquement les nouvelles routes. Préserver pour les routes existantes : `id`, `enableSnapshot`, `user`, `parameters`, `snapshotPath`, ordre manuel et options supportées.

Ne pas supprimer automatiquement les routes disparues ; les signaler.

Écriture atomique, validation avant écriture, aucun rewrite si rien ne change, modification limitée à `routes`.

Sortie : ajoutées, inchangées, potentiellement obsolètes, fichier modifié.

## Critères d’acceptation
Fusion idempotente, options préservées, ordre préservé, écriture atomique testée.

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
