# RFC-007 — Authentification Playwright

## Objectif
Connexion générique par formulaire, indépendante de Better Auth ou NextAuth.

Configuration : route de login, sélecteurs email/password/submit, stratégie de succès par URL et/ou sélecteur, utilisateurs.

Créer une abstraction légère `AuthAdapter` et `FormAuthAdapter`. Connexion une fois par run lorsque possible. Nouveau contexte par run. Aucun secret loggé.

Erreurs : `USER_NOT_FOUND`, `AUTHENTICATION_FAILED`.

## Critères d’acceptation
Succès par URL, succès par sélecteur, échec, utilisateur absent, secret absent, session réutilisée dans le run.

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
