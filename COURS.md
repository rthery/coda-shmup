# Utiliser la librairie Phaser pour créer un jeu web

## Slides du cours
Les slides des 3 parties du cours (game loop, scènes, patterns, etc.) sont dans [slides/](slides/), un projet Slidev indépendant du jeu : `npm install` puis `npm run dev` dans `slides/`.

## Setup du projet
Installer NodeJS LTS (via nvm, volta, etc.), git et un éditeur (WebStorm ou VS Code).

1. Forker `rthery/coda-shmup` sur GitHub, puis cloner **votre** fork
2. Installer une fois l'alias `git go` (commande dans le `README.md`)
3. `git go 02`, puis `npm install` et `npm run dev-nolog`

Vous devriez pouvoir voir la page du "jeu" sur <http://localhost:8080> pour valider que tout fonctionne.
On refait ensuite le jeu commit par commit : `git go NN` place la branche `cours` sur le commit numéro NN des slides
(et efface vos changements locaux).

Pour info, le commit 01 a été généré avec le template officiel : `npm create @phaserjs/game@latest` (Web Bundler, Vite,
Minimal, TypeScript), et le commit 02 met les packages à jour avec `npx npm-check-updates -u`.

> Note : les commandes `npm run dev` / `npm run build` du template Phaser exécutent `log.js`, qui envoie un ping **anonyme** (nom du template, dev/prod, version de Phaser) vers `gryzor.co`. Aucune donnée personnelle n'est envoyée (voir `README_PHASER.md`, section « About log.js »). Pour désactiver cet envoi : `npm run dev-nolog` / `npm run build-nolog`.

## Concepts de base des moteurs de jeu
### Game Loop

La game loop est le cycle fondamental qui maintient un jeu en cours d'exécution (Boucle infinie !).

Au sein de la game loop, tous les modules internes du moteur de jeu sont mis à jour et les rendus sont effectués
en conséquence.
Example de game loop :
```
    while (true) {
        handleInput();
        update();
        render();
    }
```
Dans Phaser, la game loop est gérée en interne. Vous définissez juste la logique de mise à jour dans la méthode
`update` de vos scènes.

### Scènes

Les scènes sont un moyen qui vous permettent de diviser votre jeu en différentes parties, comme
des niveaux ou des menus.
Dans Phaser, chaque scène possède ses propres méthodes de cycle de vie :

- `preload` : Chargement des ressources.
- `create` : Initialisation des objets du jeu.
- `update` : Logique de mise à jour.

Plus de détail sur leur ordre ici : <https://docs.phaser.io/phaser/concepts/scenes#flowchart-scene-life-cycle>  

Vous pouvez avoir plusieurs scènes actives à la fois (on a souvent une scène de jeu et une pour l'UI qui vient 
par-dessus par exemple).

Dans le code : les scènes sont `src/scenes/HomeScene.ts`, `MainGameScene.ts`, `MainUIScene.ts`, `GameOverScene.ts`,
enregistrées dans `src/main.ts:36-41`. Plusieurs scènes actives en même temps : `HomeScene` lance la scène UI et
démarre la partie avec `scene.launch` + `scene.start` (`src/scenes/HomeScene.ts:50-56`) ; `MainUIScene` se place
au-dessus avec `scene.bringToTop()` (`src/scenes/MainUIScene.ts:40`).

### Game Objects

Les GameObjects sont les éléments fondamentaux qui composent votre jeu, comme les images (sprite), les textes, et
les groupes. Ils possèdent des propriétés et des méthodes pour interagir avec le jeu via des Components (comme Transform,
qui permet de définir la position d'une Game Object dans l'espace)

- Sprites : Représentent des objets visuels qui peuvent être animés et interagir avec d'autres objets.
- Textes : Affichent du texte à l'écran.
- Groupes : Regroupent plusieurs GameObjects pour les manipuler ensemble.

Ils utilisent fortement l'héritage et la composition (via les Components) pour leur structure.
Ils ne peuvent exister que sur une scène à la fois.

Debug Tool: <https://github.com/Ariorh1337/phaser-debug-tool> (A utiliser sous Chrome)

### Références
- <https://docs.phaser.io/>
- <https://phaser.io/examples/>

## Type du jeu

Shoot'em up (ou shmup) spatial en 2D.
Le joueur contrôlera un vaisseau spatial avec plusieurs vies et devra détruire des ennemis pour marquer des points.
Permet de voir pas mal de problématiques de base dans le développement de jeux vidéo.

## Tirer parti des 3C (Camera, Control, Character)

Les 3C (Camera, Control, Character) sont des éléments fondamentaux dans le développement de jeux vidéo. Ils permettent 
de se focaliser sur les aspects clés du gameplay et de l'expérience utilisateur lors de la conception

### Camera
Permet de définir ce que le joueur voit à l'écran.
On partira sur une vue top, avec défilement vertical et screen shake.

### Contrôles
Les contrôles déterminent comment le joueur interagit avec le jeu. Des contrôles réactifs et intuitifs sont
essentiels pour un gameplay fluide.
On utilisera le clavier pour contrôler le mouvement et tir du personnage.

### Character
Défini l'avatar du joueur, s'il y a lieu.
Notre personnage sera un vaisseau spatial avec des vies et différentes armes/powerups.

## Gestion des ressources du jeu

Utilisation de resources gratuites et libres provenant de <https://kenney.nl/> (licence **CC0**, domaine public :
utilisation libre, y compris commerciale — <https://kenney.nl/support>)
- <https://kenney.nl/assets/space-shooter-redux>
- <https://kenney.nl/assets/space-shooter-extension>
- <https://kenney.nl/assets/ui-pack-sci-fi>
- <https://kenney.nl/assets/planets>

### Graphismes

Optimiser vos performances en assemblant vos images dans des atlas/spritesheets
- **atlas**: regroupe plusieurs images en une seule, qu'importe leur taille. L'image sera associée a un fichier de donnée type JSON, XML
  afin d'indiquer la position/taille de chaque image dans l'atlas
- **spritesheet**: regroupe plusieurs images, souvent d'une même animation, en une seule, et chaque image au sein de la spritesheet
  à la même taille. On peut donc facilement en déduire la position de chaque image dans la spritesheet sans fichier de donnée externe
  comme pour un atlas

Dans le projet, l'atlas du jeu est généré à partir d'un PNG par sprite (voir `assets-src/README.md`) :
1. Déposer le PNG dans `assets-src/sprites/`
2. Lancer `npm run atlas` : `tools/pack-atlas.mts` packe tous les PNG dans `public/assets/Spritesheet/gameSprites.png` + `gameSprites.json`
3. L'utiliser dans le jeu par le nom du fichier sans `.png` : `this.add.sprite(x, y, 'sprites', 'ufoRed')`

`gameSprites.png` et `gameSprites.json` sont générés, ne jamais les modifier à la main. Pour lister les frames chargées :
`console.log(this.textures.get('sprites').getFrameNames())`. Les images répétées (le fond `darkPurple`) restent hors de
l'atlas : le filtrage de la carte graphique ferait apparaître des joints entre les tuiles.

### Données

Utilisation de fichiers JSON pour stocker les données de configuration du jeu, comme les niveaux, les ennemis, les power-ups, etc.
Cela permet de facilement les lire et les éditer, et de les charger dynamiquement dans le jeu.

Exemple dans le code : `public/assets/Data/playerShips.json` est chargé dans `HomeScene.preload` (`src/scenes/HomeScene.ts:38`)
avec `this.load.json`, puis lu via `this.scene.cache.json.get('playerShips')` (`src/entities/Player.ts:59`) et typé dans
`src/gameData/PlayerShipsData.ts`. C'est ce pattern qu'il faut généraliser pour rendre un ennemi configurable via JSON
(cf. évaluation).

### Outils
- Editer des images: <https://www.photopea.com/>
- Créer l'atlas du jeu : `npm run atlas` (basé sur [free-tex-packer-core](https://www.npmjs.com/package/free-tex-packer-core))

## Game Logic et Design Patterns

L'historique git de ce repo montre la progression prototype → architecture (pooling, Entity+Components, managers,
scènes, sauvegarde) : `git log --oneline` puis `git show <commit>` (numéro des slides et hash : 21 `262ba0b` pooling
des balles, 22 `959dbd7` Entity, 23 `7a48be8` pooling des ennemis, 24 `04d27ae` composants, 30 `d9817fb` registry,
31 `4460ded` SaveManager, 32 `095c65d` EntityManager, 33 `ca42290` scène UI).

### Pooling
Le pooling est une technique de gestion des ressources qui consiste à réutiliser des objets au lieu de les 
créer/détruire.
Attention ! Cela vous oblige à gérer correctement l'état de ces objets et de le réinitialiser correctement avant de les réutiliser.

Exemple dans le code : `GroupUtils.populate` pré-remplit et désactive les objets (`src/utils/GroupUtils.ts:5-17`),
les groupes de balles/ennemis sont configurés dans `src/managers/EntityManager.ts:15-22,42-43,56-57`, et chaque objet
pooled a un `enable`/`disable` qui remet l'état à zéro (`src/entities/Bullet.ts:20-49`, `src/entities/Enemy.ts:69-84`
— bien remettre la vie à fond sans émettre d'événement : `heal(max, false)`, `Enemy.ts:75`). Les listeners sont posés
une seule fois dans `init()` (`Enemy.ts:23-41`), pas dans `enable()`, sinon ils s'accumulent à chaque réutilisation.

### Entity/Component
Utilisez une classe, Entity, pour définir les entités de votre jeu, ne pas hésiter à hériter d'une classe du moteur, tel que Sprite
Puis ajoutez des composants pour customiser le comportement et les fonctionnalités disponibles a ces entités, via des classes Components
Par exemple en ajoutant un component pour le mouvement, le tir ou la vie

Utilisez des events pour laisser les components communiquer avec le reste de la logique

Exemple dans le code : `Entity.addComponent` / `getComponent<T>` (`src/entities/Entity.ts:25-41`), les entités
`src/entities/Player.ts`, `Enemy.ts`, et les composants `src/components/` (`Health` avec ses événements
`CHANGE_EVENT`/`DEATH_EVENT`, `Movement`, `Weapon` — le tir est dans `Weapon.shoot`, `src/components/Weapon.ts:22-45`).

### Game State

Le Game State représente toutes les données vivantes de votre jeu : c’est ce qui décrit exactement ce qui se passe à 
un instant donné.
On y retrouve les informations comme la position du joueur, son score, les ennemis présents, leur santé, ou encore 
le niveau actuel.

Le Game State sert aussi de base pour les systèmes de sauvegarde et de chargement : en enregistrant son contenu, 
vous pouvez retrouver la partie plus tard exactement là où elle s’était arrêtée.

Dans le code : le score vit dans le **registry** Phaser (`src/RegistryConstants.ts`, `this.registry.set(...)` dans
`src/scenes/MainGameScene.ts:50`, `registry.inc(...)` dans `src/managers/EntityManager.ts:83,97`) et ses changements
sont notifiés via `registry.events` (écouté dans `src/scenes/MainUIScene.ts:18`). La **persistance** (localStorage)
est gérée par le `SaveManager` (`src/managers/SaveManager.ts`, clé `phaserSaveData`, best score sauvegardé à la mort
du joueur dans `MainGameScene.endGame`, `src/scenes/MainGameScene.ts:55-64`).

### Managers/Services
Centralisez la gestion de certaines fonctionnalités dans des classes dédiées, comme un EntityManager pour gérer les entités.
Ils doivent être facilement accessibles pour le reste de la logique. Le système de plugins de Phaser permet de le faire de
manière idiomatique à cette librairie, en les ayant soit au niveau global du jeu ou au niveau des scènes.
Par contre évitez d'en faire des singletons, cela rend le code plus difficile à tester et à maintenir.

Exemple dans le code : les plugins sont enregistrés dans `src/main.ts:27-34` — `SaveManager` en plugin **global**
(accès via `this.saveManager`) et `EntityManager` en plugin de **scène** (accès via `this.entityManager`,
`src/managers/EntityManager.ts`).

### Références
- <https://gameprogrammingpatterns.com/>

## UI
Dans la majorité des jeux, l'UI, User Interface, est une couche supplémentaire qui vient donner des informations au 
joueur et lui permettre de naviguer dans la Meta du jeu. (Meta: tout ce qui englobe, mais ne concerne directement 
pas le core gameplay)

On essaye généralement que la couche logique n'ait aucune dépendance à celle de l'UI (votre jeu doit pouvoir 
tourner sans l'UI), pour qu'il soit plus maintenable et moins sujet aux bugs.

Exemple dans le code : `src/scenes/MainUIScene.ts` ne fait qu'écouter — le score via les événements du registry
(`MainUIScene.ts:18`) et la vie du joueur via `game.events` + l'événement du composant `Health` (`MainUIScene.ts:17,50-56`,
avec nettoyage des listeners au `SHUTDOWN`, lignes 20-24) — pendant que la logique tourne dans `MainGameScene`.

### Références
- <https://snowb.org/>

## Game Feel/Juice

Le Game Feel (ou Juice) est un concept qui désigne l'ensemble des éléments qui rendent un jeu plus agréable à jouer.
Souvent ce sont des petites choses que les joueurs ne perçoivent pas forcément quand elles sont présentes,
mais qu'ils ressentent quand elles manquent.

- Animation des sprites (spritesheet/tween)
- Animation des UI
- Freeze frame quand une entité est touchée
- Écrans de transition entre les scènes
- Shake de la caméra
- Effets de particules
- Musique et effets sonores

Exemples dans le code : shake de caméra (`src/managers/EntityManager.ts:93,105`), flash blanc quand un ennemi est
touché (`src/entities/Enemy.ts:26`), joueur invulnérable 50 ms après un coup (`src/entities/Player.ts:46-54`),
explosion en tween à la mort (`src/components/Health.ts:50-72`), sons laser (`src/entities/Player.ts:93`,
`src/entities/Enemy.ts:92`), touche R pour redémarrer la scène (`src/scenes/MainGameScene.ts:45`), barre de chargement
au preload (`src/scenes/HomeScene.ts:13-29`).

### Références
- <https://www.youtube.com/watch?v=Fy0aCDmgnxg>
- <https://www.youtube.com/watch?v=AJdEqssNZ-U>
- <https://easings.net/>
- <https://sfxr.me/>

## Publication du jeu

Utilisation de la plateforme [itch.io](https://itch.io/) pour publier le jeu via Github Actions : à chaque push sur
`main`, le jeu est buildé puis déployé.
Un jeton butler doit être généré pour permettre l'upload du jeu depuis Github, attention a bien le saisir via les secrets du repository
(secret `BUTLER_CREDENTIALS` dans Settings > Secrets and variables > Actions, voir `.github/workflows/main.yml`).
Si vous forkez ce repo, changez `ITCH_USER` dans le workflow (valeur en dur : `surmoi`) ; `ITCH_GAME` reprend le nom du repo.

## Features additionnelles

### Processus de développement
- Publier votre projet actuel sur Github
- Créer une feature branch pour chaque feature que vous implémentez (`git switch -c feature/...`), jamais de commit sur `main`
- Faites des [commits atomiques](https://dev.to/samuelfaure/how-atomic-git-commits-dramatically-increased-my-productivity-and-will-increase-yours-too-4a84) sur votre branche : un commit = une idée, comme l'historique de `main`
- Créer une Pull Request (PR) pour chaque feature afin de permettre aux autres de la review, ouverte en draft tant qu'elle n'est pas prête
- Avant chaque PR : `npm run build-nolog` et un playtest manuel, puis relisez votre code et vos commits

### Coder avec un agent IA
Facultatif pendant le TD, avec n'importe quel agent :
- Une branche feature dédiée, jamais `main`, pas de secrets dans les prompts
- D'abord un **tech plan sans code** (approche, fichiers touchés, étapes de commit, vérification, risques, questions) :
  on le relit, on répond aux questions, on le fait corriger, puis seulement « implémente ce plan, une étape à la fois »
- Vérifier que le plan respecte les patterns du cours (Entity/Component, pooling avec reset, JSON typé, UI découplée)
  et réutilise l'existant au lieu de le réinventer
- L'agent peut se vérifier lui-même (build, lancer le jeu, capture, playtest), mais un humain vérifie toujours à la fin
- PR en draft, review humaine avant de merger. Si le code ne va pas, améliorez la doc du repo et les skills de l'agent
  plutôt que le prompt
- Le code généré reste **votre** responsabilité

### Idées de features additionnelles
- Spawn enemies in waves/pattern
- Si vous voulez ajouter des boss/enemies, faites d'abord votre évaluation !
  - Astuce pour un ennemi « visuellement différent » sans modifier l'atlas : `setTint()` (cf. flash blanc quand un ennemi est touché, `src/entities/Enemy.ts:26`)
- Ajouter des power-ups
- Mettre à jour les data pour supporter l'ajout de components et configuration des bullets directement via JSON
- Ajouter un leaderboard local (tips, utiliser 'prompt' en JS pour la saisie texte)
  - Le rendre persistant sur le disque (via localStorage)
  - Le rendre online (si le backend ne vous fait pas peur)
- Ajouter plus de game feel
  - Améliorer les bullets (utilisation d'une image/sprite au lieu de rectangle)
  - Améliorer l'audio (musique, sons...)
- Ajouter plusieurs niveaux, dont le contenu est défini via un json
    - Selection de niveau via un menu, une fois niveau unlocked
- Améliorer le Level Design
- Mettre à jour l'UI pour un design homogène
- Ajouter le support de nouveaux inputs
    - Gamepad
    - Touch input (pour jouer sur mobile)
- Ajouter le local coop pour 2 joueurs
- Reskin des graphismes (si vous avez un petit côté artiste, 
assurez-vous d'avoir les droits d'utilisation et
garder une certaine coherence visuelle)
- Ajouter un tutoriel (expliquer les contrôles, tuto diégétique)
- Ajouter mouvement vertical pour le joueur
- Migrer le jeu vers Phaser 4

Vous vous aussi proposer des features additionnelles, n'hésitez pas à en discuter en amont d'abord

## Réferences
- <https://github.com/rthery/coda-shmup>