# RFC-012 — Documentation, intégration et packaging

Compléter tests unitaires et ajouter tests d’intégration sans Internet : fixture Next App Router, scan réel, mise à jour config temporaire, application locale capturée.

Créer `examples/snapshot.config.json` avec users member/admin, route publique, route dynamique, deux runs ordonnés.

README complet : installation, config, secrets, scan, `--default=enabled`, `--runName`, `--route`, `--user`, `--partial`, dynamiques, ordre, captures, autostart, erreurs, limites.

Valider :
```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm pack
```
Tester manuellement les commandes principales.

Ne pas implémenter viewports multiples, thèmes, plusieurs navigateurs, IA, PDF, vidéo, comparaison visuelle, dashboard, cloud, crawl intelligent ou plugins complexes.

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
