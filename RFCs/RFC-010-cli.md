# RFC-010 — CLI complète

Supporter :
```bash
snaprun
snaprun scan
snaprun scan --default=enabled
snaprun --config ./snapshot.config.json
snaprun --runName member
snaprun --runName member --partial
snaprun --route /calendar --user member
snaprun --runName member --route /member/calendar
```

Sans option : tous les runs. `--runName` : un run. `--route` : une route. `--user` : contexte hors run.

En V1, `--partial` signifie : seulement les routes explicitement référencées et activées. Si le mode normal est identique, le documenter clairement.

Conflits explicites. Ajouter `--debug` pour stack et détails.

## Critères d’acceptation
Parsing, aide, codes de sortie, conflits, combinaisons principales testés.

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
