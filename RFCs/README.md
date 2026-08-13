# SnapRun — RFC Index

Les RFC constituent la spécification officielle de SnapRun.

Chaque RFC représente un incrément fonctionnel cohérent et correspond à **un commit Git unique**.

---

# Règles de développement

- Une RFC = un commit.
- Les RFC doivent être exécutées strictement dans l'ordre.
- Ne jamais anticiper une RFC suivante.
- Ne pas modifier le périmètre d'une RFC sans justification.
- Toute décision d'architecture non prévue dans une RFC doit être explicitement expliquée dans le compte rendu.
- Les validations demandées par la RFC sont obligatoires avant de considérer le travail terminé.
- Aucun `TODO`, code mort ou fonctionnalité incomplète sans justification explicite.

---

# Règle d'arrêt

Si une RFC ne peut pas être implémentée proprement à cause d'un problème dans une RFC précédente :

- arrêter immédiatement l'implémentation ;
- expliquer précisément le problème ;
- proposer une ou plusieurs solutions ;
- attendre une validation humaine.

Ne jamais contourner silencieusement un problème d'architecture.

---

# Modifications hors périmètre

Les modifications hors périmètre sont interdites, sauf si elles sont nécessaires pour :

- corriger un bug introduit par la RFC courante ;
- améliorer une API déjà créée sans modifier son comportement ;
- résoudre un problème de compilation ou de typage.

Toute modification hors périmètre doit être explicitement mentionnée dans le compte rendu.

---

# Architecture

Toujours privilégier :

- la simplicité ;
- une responsabilité par module ;
- des API explicites ;
- des types forts ;
- des fonctions courtes ;
- une faible dépendance entre modules.

Éviter :

- les fichiers mélangeant plusieurs responsabilités ;
- les classes "manager", "helper" ou "utils" faisant tout ;
- les dépendances circulaires ;
- les constantes magiques ;
- les effets de bord cachés.

---

# Compatibilité

Une RFC ne doit jamais casser le comportement validé d'une RFC précédente.

Si une évolution nécessite une rupture de compatibilité :

- arrêter l'implémentation ;
- expliquer pourquoi ;
- attendre une validation humaine.

---

# Definition of Done

Une RFC est considérée comme terminée uniquement si :

- le périmètre est entièrement implémenté ;
- `pnpm typecheck` passe ;
- `pnpm lint` passe ;
- `pnpm test` passe ;
- `pnpm build` passe (si applicable) ;
- les nouveaux tests sont présents ;
- le README est mis à jour si nécessaire ;
- un résumé des modifications est fourni ;
- un message de commit est proposé.

---

# Workflow avec Claude

1. Lire uniquement la RFC courante.
2. Ne pas commencer la RFC suivante.
3. Implémenter uniquement le périmètre demandé.
4. Exécuter les validations.
5. Produire un compte rendu.
6. Attendre la validation humaine avant de continuer.

---

# Compte rendu attendu

1. Résumé des changements.
2. Décisions d'architecture.
3. Fichiers créés.
4. Fichiers modifiés.
5. Tests ajoutés.
6. Résultat de typecheck, lint, test, build.
7. Limites restantes.
8. Message de commit proposé.

---

La priorité est la qualité de l'architecture, pas la vitesse d'implémentation. Si une RFC révèle un défaut dans une RFC précédente, s'arrêter et le signaler plutôt que de le contourner silencieusement.
