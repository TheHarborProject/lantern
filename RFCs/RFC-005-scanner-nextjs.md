# RFC-005 — Scanner Next.js natif

> Amendée le 2026-08-03, avec validation humaine : la version initiale imposait
> `next-list` comme « moteur principal ». Vérification faite, le package npm
> `next-list` (seule version publiée sous ce nom) n'est pas une bibliothèque :
> c'est un script CLI à effets de bord immédiats (`console.clear()`,
> `process.exit(1)`, lecture forcée de `process.cwd()`, aucun export, aucune
> sortie structurée), sans support Pages Router ni des segments catch-all. Il
> est donc inutilisable comme dépendance encapsulée dans un adaptateur. Cette
> RFC est réécrite pour spécifier un scanner natif, avec une architecture
> remplaçable si un moteur officiel (next-list mature, manifeste Next.js
> officiel, etc.) apparaît plus tard. Voir DEC-002 dans `DECISIONS.md`.

## Objectif
Détecter les pages d'un projet Next.js. SnapRun est spécifique à Next.js.

## Architecture

Interface interne légère, sans architecture multi-framework :

```ts
interface RouteScanner {
  scan(projectRoot: string): Promise<DiscoveredRoute[]>;
}
```

```text
src/scanners/
├── scanner.ts                    # interface RouteScanner
├── filesystem-route-scanner.ts   # FilesystemRouteScanner implements RouteScanner (moteur du jour)
└── nextjs-route-scanner.ts       # NextjsRouteScanner implements RouteScanner (façade stable)
```

`NextjsRouteScanner` est le point d'entrée unique utilisé par le reste de
SnapRun ; il délègue à un moteur interne (`FilesystemRouteScanner`
aujourd'hui). Remplacer le moteur (ex. un futur `NextListRouteScanner` ou
`NextManifestRouteScanner`) ne doit toucher que ce point de câblage, jamais
les appelants.

## Détection

S'appuyer sur les conventions officielles Next.js plutôt que sur un scan
naïf du système de fichiers :

- Racines cherchées, avec fallback isolé : `app/`, `src/app/` (App Router) ;
  `pages/`, `src/pages/` (Pages Router). App Router et Pages Router peuvent
  coexister (migration incrémentale) : les deux sont scannés si présents.
- App Router : fichier reconnu `page.{tsx,ts,jsx,js}` ; fichiers exclus
  `layout`, `loading`, `error`, `template`, `default`, `route`, `not-found`,
  `global-error` (quelle que soit l'extension) ; dossiers `(group)` retirés
  de l'URL mais toujours parcourus ; dossiers `@slot` (routes parallèles) et
  dossiers préfixés `_` ignorés (non parcourus).
- Pages Router : tout fichier `{tsx,ts,jsx,js}` hors `_app`, `_document`,
  `_error`, `_middleware` ; `index` correspond au chemin du dossier parent ;
  dossier racine `api/` entièrement exclu (routes API).
- Segments dynamiques reconnus : `[id]`, `[...slug]`, `[[...slug]]`. Leur
  détection (classification statique/dynamique/catch-all/catch-all
  optionnel) est isolée dans une fonction pure dédiée, préparant une
  résolution plus complète sans l'implémenter prématurément.
- Déduplication par chemin final (App Router prioritaire en cas de
  collision avec Pages Router) et tri déterministe (alphabétique) en sortie.
- Routes interceptantes App Router (`(.)`, `(..)`, `(..)(..)`, `(...)`,
  toujours accolées au nom du segment intercepté, ex. `(.)photo`) :
  détectées explicitement et **exclues entièrement du scan** (dossier non
  parcouru). Leur URL canonique dépend du nombre de niveaux remontés par
  rapport à la position du dossier dans l'arborescence, ce qui n'est pas
  résolu en V1 — les exclure est le seul moyen sûr d'éviter de produire un
  segment d'URL inexistant (`(.)photo`, `(..)modal`, etc.) dans la sortie du
  scanner. Support complet non prévu par cette RFC.

## Critères d'acceptation
Fixtures App Router, Pages Router, groupes, dynamiques, API exclues,
fallback (`app`/`src/app`, `pages`/`src/pages`), sortie stable (dédupliquée
et triée de façon déterministe).

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
