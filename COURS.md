# Utiliser la librairie Phaser pour créer un jeu web

## GameDev Presentation
<https://chk.me/kieIT8n>

## Setup du projet
Installer NodeJS LTS (via nvm, volta, etc.)

```npm create @phaserjs/game@latest```
1. Nommer le projet
2. Web Bundler
3. vite
4. Minimal
5. TypeScript

Mettre à jour les packages  
Principalement pour vite et TS
1. ```npx npm-check-updates -u```

Ouvrir le projet dans votre IDE
1. ```npm install```
2. ```npm run dev```

Vous devriez pouvoir voir la page du "jeu" dans votre browser pour valider que tout fonctionne

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
démarre la partie avec `scene.launch` + `scene.start` (`src/scenes/HomeScene.ts:49-52`) ; `MainUIScene` se place
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

### Données

Utilisation de fichiers JSON pour stocker les données de configuration du jeu, comme les niveaux, les ennemis, les power-ups, etc.
Cela permet de facilement les lires et éditer, et de les charger dynamiquement dans le jeu.

Exemple dans le code : `public/assets/Data/playerShips.json` est chargé dans `HomeScene.preload` (`src/scenes/HomeScene.ts:38`)
avec `this.load.json`, puis lu via `this.scene.cache.json.get('playerShips')` (`src/entities/Player.ts:57`) et typé dans
`src/gameData/PlayerShipsData.ts`. C'est ce pattern qu'il faut généraliser pour rendre un ennemi configurable via JSON
(cf. évaluation).

### Outils
- Editer des images: <https://www.photopea.com/>
- Créer des atlas/spritesheets: <https://free-tex-packer.com/app/>

## Game Logic et Design Patterns

L'historique git de ce repo montre la progression prototype → architecture (pooling, Entity+Components, managers,
scènes, sauvegarde) : `git log --oneline` puis `git show <commit>` (ex. `656f1ec` pooling, `37fe043` Entity,
`b037885` composants, `26935b2` EntityManager, `af68a37` registry, `e5118de` SaveManager, `ae68120` scène UI).

### Pooling
Le pooling est une technique de gestion des ressources qui consiste à réutiliser des objets au lieu de les 
créer/détruire.
Attention ! Cela vous oblige à gérer correctement l'état de ces objets et de le réinitialiser correctement avant de les réutiliser.

Exemple dans le code : `GroupUtils.populate` pré-remplit et désactive les objets (`src/utils/GroupUtils.ts:5-18`),
les groupes de balles/ennemis sont configurés dans `src/managers/EntityManager.ts:15-22,42-43,56-57`, et chaque objet
pooled a un `enable`/`disable` qui remet l'état à zéro (`src/entities/Bullet.ts:20-49`, `src/entities/Enemy.ts:49-83`
— bien remettre la vie à fond sans émettre d'événement : `heal(max, false)`, `Enemy.ts:73`).

### Entity/Component
Utilisez une classe, Entity, pour définir les entités de votre jeu, ne pas hésiter à hériter d'une classe du moteur, tel que Sprite
Puis ajoutez des composants pour customiser le comportement et les fonctionnalités disponibles a ces entités, via des classes Components
Par exemple en ajoutant un component pour le mouvement, le tir ou la vie

Utilisez des events pour laisser les components communiquer avec le reste de la logique

Exemple dans le code : `Entity.addComponent` / `getComponent<T>` (`src/entities/Entity.ts:25-45`), les entités
`src/entities/Player.ts`, `Enemy.ts`, et les composants `src/components/` (`Health` avec ses événements
`CHANGE_EVENT`/`DEATH_EVENT`, `Movement`, `Weapon` — le tir est dans `Weapon.shoot`, `src/components/Weapon.ts:22-46`).

### Game State

Le Game State représente toutes les données vivantes de votre jeu : c’est ce qui décrit exactement ce qui se passe à 
un instant donné.
On y retrouve les informations comme la position du joueur, son score, les ennemis présents, leur santé, ou encore 
le niveau actuel.

Le Game State sert aussi de base pour les systèmes de sauvegarde et de chargement : en enregistrant son contenu, 
vous pouvez retrouver la partie plus tard exactement là où elle s’était arrêtée.

Dans le code : le score vit dans le **registry** Phaser (`src/RegistryConstants.ts`, `this.registry.set(...)` dans
`src/scenes/MainGameScene.ts:46`, `registry.inc(...)` dans `src/managers/EntityManager.ts:83,97`) et ses changements
sont notifiés via `registry.events` (écouté dans `src/scenes/MainUIScene.ts:18`). La **persistance** (localStorage)
est gérée par le `SaveManager` (`src/managers/SaveManager.ts`, clé `phaserSaveData`, best score sauvegardé à la mort
du joueur dans `src/scenes/MainGameScene.ts:51-61`).

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
(`MainUIScene.ts:18`) et la vie du joueur via `game.events` + l'événement du composant `Health` (`MainUIScene.ts:17,50-57`,
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
touché (`src/entities/Enemy.ts:55`), explosion en tween à la mort (`src/components/Health.ts:52-71`), sons laser
(`src/entities/Player.ts:91`, `src/entities/Enemy.ts:90`), touche R pour redémarrer la scène
(`src/scenes/MainGameScene.ts:41`), barre de chargement au preload (`src/scenes/HomeScene.ts:13-28`).

### Références
- <https://www.youtube.com/watch?v=Fy0aCDmgnxg>
- <https://www.youtube.com/watch?v=AJdEqssNZ-U>
- <https://easings.net/>
- <https://sfxr.me/>

## Publication du jeu

Utilisation de la plateforme [itch.io](https://itch.io/) pour publier le jeu via Github Actions.
Un jeton butler doit être généré pour permettre l'upload du jeu depuis Github, attention a bien le saisir via les secrets du repository
(secret `BUTLER_CREDENTIALS`, voir `.github/workflows/main.yml`). Si vous forkez ce repo, pensez aussi à personnaliser
`ITCH_USER` / `ITCH_GAME` dans le workflow (valeur en dur : `surmoi`).

## Features additionnelles

### Processus de développement
- Publier votre projet actuel sur Github
- Créer une feature branch pour chaque feature que vous implémentez
- Faites des [commits atomiques](https://dev.to/samuelfaure/how-atomic-git-commits-dramatically-increased-my-productivity-and-will-increase-yours-too-4a84) sur votre branche
- Créer une Pull Request (PR) pour chaque feature afin de permettre aux autres de la review
- Pensez à bien relire votre code et vos commits avant de la soumettre

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
  - Explosion des vaisseaux
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
- Migrer le jeu vers Phaser 4 (sorti en avril 2026)

Vous vous aussi proposer des features additionnelles, n'hésitez pas à en discuter en amont d'abord

## Réferences
- <https://github.com/rthery/coda-shmup>