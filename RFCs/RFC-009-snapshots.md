# RFC-009 — Captures Playwright

Chromium uniquement en V1. Pour chaque route : résoudre URL, naviguer, attendre stabilité, capturer PNG, respecter `fullPage`, créer dossiers, nom déterministe basé sur l’ID.

Sortie :
```text
snapshots/member/01-member-home.png
snapshots/member/02-member-calendar.png
snapshots/standalone/member-calendar.png
```

Fail-fast par défaut. Rapport final : run, succès, échec éventuel, chemins, durée.

Erreur : `SNAPSHOT_FAILED`.

## Critères d’acceptation
PNG réel, ordre des noms, route dynamique, contexte isolé, rapport, test local hors Internet.

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
