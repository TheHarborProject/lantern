# RFC-011 — Démarrage automatique de l’application

Tester `baseUrl`. Si elle répond, réutiliser le serveur. Sinon, si `autoStart`, lancer `startCommand` depuis `workingDirectory`, attendre disponibilité, exécuter, puis arrêter uniquement le processus créé par SnapRun.

Ne jamais arrêter un serveur externe. Gérer stdout/stderr, timeout, signaux et processus orphelins.

Erreurs : `APPLICATION_START_FAILED`, `APPLICATION_UNREACHABLE`.

## Critères d’acceptation
Serveur existant, autostart, commande en échec, timeout, arrêt du processus créé, conservation du serveur externe.

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
