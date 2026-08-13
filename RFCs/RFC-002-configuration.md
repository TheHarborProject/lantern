# RFC-002 — Chargement et validation de configuration

## Objectif
Charger et valider un fichier SnapRun avec Zod.

## Détection
Ordre : `snaprun.config.json`, `snapshot.config.json`, `settings.json`. `--config` est prioritaire.

## Structure minimale
```json
{
  "project": {
    "root": ".",
    "workingDirectory": ".",
    "baseUrl": "http://localhost:3000",
    "startCommand": "pnpm dev",
    "autoStart": true
  },
  "output": { "directory": "./snapshots", "fullPage": true },
  "auth": {
    "loginRoute": "/sign-in",
    "selectors": {
      "email": "input[name='email']",
      "password": "input[name='password']",
      "submit": "button[type='submit']"
    },
    "users": {}
  },
  "routes": [],
  "runs": []
}
```

`root` est relatif au fichier de config ; `workingDirectory` est relatif à `root`; absent, il vaut `root`.

Erreurs : `CONFIG_NOT_FOUND`, `CONFIG_INVALID`. Pas de stack brute hors `--debug`.

## Critères d’acceptation
Tests sur détection, chemin explicite, chemins relatifs/absolus, JSON invalide, structure invalide.

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
