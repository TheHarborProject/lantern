# RFC-001 — Initialisation du projet SnapRun

## Objectif
Créer depuis un dossier vide la base technique de SnapRun, sans logique métier.

## Stack
Node.js 20+, pnpm, TypeScript, Playwright, Zod, Commander ou CAC, Vitest, ESLint, Prettier.

## Résultat attendu
Créer un package `snaprun` exposant le binaire `snaprun`. `pnpm exec snaprun --help` et `npx snaprun --help` doivent fonctionner après build.

Architecture de départ :
```text
src/
├── auth/
├── cli/commands/
├── config/
├── env/
├── errors/
├── output/
├── routes/
├── runner/
├── scanners/
├── schemas/
├── types/
├── utils/
└── index.ts
```

Activer `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.

Le CLI initial affiche aide et version, sans logique métier.

Scripts minimum : `build`, `typecheck`, `lint`, `test`, `format`.

## Critères d’acceptation
- install, typecheck, lint, test, build passent ;
- le binaire fonctionne ;
- aucun `any` applicatif.

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
