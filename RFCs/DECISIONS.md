# DECISIONS.md

Ce document recense les décisions d'architecture validées.

## Règles

- Une décision est ajoutée uniquement après validation humaine.
- Chaque décision reçoit un identifiant unique.
- Une décision ne doit jamais être modifiée silencieusement.
- Si une décision doit évoluer, créer une nouvelle entrée indiquant qu'elle remplace la précédente.

---

## Modèle

### DEC-001 — Titre

**Date :**

**Statut :** Proposed | Accepted | Superseded

**Contexte**

...

**Décision**

...

**Conséquences**

...

**RFC concernées**

- RFC-00X

---

## Décisions

### DEC-001 — Répertoire `src/domain/` pour la logique pure partagée entre couches

**Date :** 2026-08-03

**Statut :** Accepted

**Contexte**

RFC-004 a introduit `extractPathParameterNames` et `computeParameterDiscrepancies`,
deux fonctions pures nécessaires à la fois à la validation Zod
(`src/schemas/route.ts`), à la validation métier (`src/routes/validate-route-parameters.ts`)
et à la résolution d'URL (`src/routes/resolve-route-path.ts`). Les placer dans
`src/routes/` faisait dépendre un schéma de validation (`schemas/`) d'un module
de la couche d'exécution métier (`routes/`), un sens de dépendance discutable
même en l'absence de cycle réel.

**Décision**

Créer un répertoire neutre `src/domain/` (non prévu dans l'arborescence initiale
de RFC-001) pour la logique de domaine pure, partagée sans appartenir à une
couche d'exécution précise. Premier contenu : `src/domain/routes/` (extraction
et comparaison des paramètres dynamiques d'une route).

**Conséquences**

- `schemas/route.ts`, `routes/validate-route-parameters.ts` et
  `routes/resolve-route-path.ts` dépendent tous de `domain/routes/*`, jamais
  l'inverse.
- Les futures fonctions pures de domaine partagées entre plusieurs couches
  devraient suivre le même emplacement plutôt que d'être rattachées à une
  couche d'exécution particulière.

**RFC concernées**

- RFC-004

---

### DEC-002 — Abandon de `next-list`, scanner Next.js natif et swappable

**Date :** 2026-08-03

**Statut :** Accepted

**Contexte**

RFC-005 imposait initialement `next-list` comme « moteur principal » de
détection des pages, encapsulé dans un adaptateur. Vérification faite du
package npm publié sous ce nom (seule version existante) : ce n'est pas une
bibliothèque mais un script CLI à effets de bord immédiats dès son
`require()` (`console.clear()`, lecture forcée de `process.cwd()`,
`process.exit(1)` si aucun dossier `app` trouvé, aucune sortie structurée),
sans support Pages Router ni des segments catch-all/catch-all optionnel, et
sans dédoublonnage/tri. Aucune version alternative de ce package n'existe.
L'encapsuler proprement dans un adaptateur était impossible sans contourner
ses effets de bord ou réimplémenter nous-mêmes la quasi-totalité des critères
d'acceptation de la RFC.

**Décision**

Remplacer `next-list` par un scanner natif (`src/scanners/`), architecturé
derrière une interface minimale (`RouteScanner.scan(projectRoot)`) pour
rester remplaçable si un moteur officiel apparaît plus tard (ex. un futur
package `next-list` mature, ou un manifeste officiel Next.js) : le reste de
SnapRun ne dépend que de `NextjsRouteScanner` (façade stable), qui délègue à
un moteur interne — `FilesystemRouteScanner` aujourd'hui.

**Conséquences**

- RFC-005 est amendée en conséquence (voir l'en-tête de
  `RFC-005-scanner-nextjs.md`).
- Aucune dépendance `next-list` n'est ajoutée au projet.
- Remplacer le moteur de scan à l'avenir ne touche que le point de câblage
  interne à `NextjsRouteScanner`, jamais les appelants.

**RFC concernées**

- RFC-005

---
