# Utiliser la librairie Phaser pour créer un jeu web

## GameDev Presentation
https://chk.me/kieIT8n

## Setup du projet
Installer NodeJS LTS (via nvm, volta, etc.)

```npm create @phaserjs/game@latest```
1. Nommer le projet
2. Web Bundler
3. vite
4. Minimal
5. TypeScript

Ouvrir le projet dans votre IDE
1. ```npm install```
2. ```npm run dev```

## Concepts de base des moteurs de jeu
### Game Loop

La game loop est le cycle fondamental qui maintient un jeu en cours d'exécution (Boucle infinie !).

Au sein de la game loop, tous les modules internes du moteur de jeu sont mis à jour et les rendus sont effectués
en conséquence.
Example de game loop:

    while (true) {
        handleInput();
        update();
        render();
    }

Dans Phaser, la game loop est gérée automatiquement. Vous définissez la logique de mise à jour dans la méthode
`update` de vos scènes.

### Scènes

Les scènes sont des unités de gestion qui vous permettent de diviser votre jeu en différentes parties, comme
des niveaux ou des menus.
Dans Phaser, chaque scène possède ses propres méthodes de cycle de vie :

- preload : Chargement des ressources.
- create : Initialisation des objets du jeu.
- update : Logique de mise à jour.

Les scènes facilitent l'organisation et la gestion des différentes parties de votre jeu.
Vous pouvez avoir plusieurs scènes actives à la fois.

### Game Objects

Les GameObjects sont les éléments fondamentaux qui composent votre jeu, comme les images (sprite), les textes, et
les groupes. Ils possèdent des propriétés et des méthodes pour interagir avec le jeu via des Components (comme Transform,
qui permet de définir la position d'une Game Object dans l'espace)

- Sprites : Représentent des objets visuels qui peuvent être animés et interagir avec d'autres objets.
- Textes : Affichent du texte à l'écran.
- Groupes : Regroupent plusieurs GameObjects pour les manipuler ensemble.

Ils utilisent fortement l'héritage et la composition (via les Components) pour leur structure.
Ils ne peuvent exister que sur une scène à la fois.

Debug Tool: https://github.com/Ariorh1337/phaser-debug-tool

### Références
- https://docs.phaser.io/
- https://phaser.io/examples/

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

Utilisation de resources gratuites et libres provenant de https://kenney.nl/
- https://kenney.nl/assets/space-shooter-redux
- https://kenney.nl/assets/space-shooter-extension
- https://kenney.nl/assets/ui-pack-sci-fi

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

### Outils
- Editer des images: https://www.photopea.com/
- Créer des atlas/spritesheets: https://free-tex-packer.com/app/

## Game Logic et Design Patterns

### Pooling
Le pooling est une technique de gestion des ressources qui consiste à réutiliser des objets au lieu de les 
créer/détruire.
Attention ! Cela vous oblige à gérer correctement l'état de ces objets et de le réinitialiser correctement avant de les réutiliser.

### Entity/Component
Utilisez une classe, Entity, pour définir les entités de votre jeu, ne pas hésiter à hériter d'une classe du moteur, tel que Sprite
Puis ajoutez des composants pour customiser le comportement et les fonctionnalités disponibles a ces entités, via des classes Components
Par exemple en ajoutant un component pour le mouvement, le tir ou la vie

Utilisez des events pour laisser les components communiquer avec le reste de la logique

### Managers/Services
Centralisez la gestion de certaines fonctionnalités dans des classes dédiées, comme un EntityManager pour gérer les entités.
Ils doivent être facilement accessible pour le reste de la logique, Phaser les injecte sur la scene par exemple.
Par contre évitez d'en faire des singletons, cela rend le code plus difficile à tester et à maintenir.

### Références
- https://gameprogrammingpatterns.com/

## Game Feel/Juice

Le Game Feel (ou Juice) est un concept qui désigne l'ensemble des éléments qui rendent un jeu plus agréable à jouer.
Souvent ce sont des petites choses que les joueurs ne perçoivent pas forcément quand elles sont présentes
mais qu'ils ressentent quand elles manquent.

- Animation des sprites (spritesheet/tween)
- Animation des UI
- Freeze frame quand une entité est touchée
- Écrans de transition entre les scènes
- Shake de la caméra
- Effets de particules
- Musique et effets sonores

### Références
- https://www.youtube.com/watch?v=Fy0aCDmgnxg

## Publication du jeu

Utilisation de la plateforme [itch.io](https://itch.io/) pour publier le jeu via Github Actions.
Une clé API doit être générée pour permettre l'upload du jeu depuis Github, attention a bien la saisir via les secrets du repository.

## Features additionnelles

### Processus de développement
Publier votre projet actuel sur Github
Créer une feature branch pour chaque feature que vous implémentez
Créer une Pull Request (PR) pour chaque feature afin de permettre aux autres de la review
Pensez à bien faire des commits atomiques et relire votre code avant de la soumettre

### Evaluation
Proposer une PR a l'évaluation, substantielle en termes de contenu et de qualité

### Idées de features additionnelles
- Ajouter plusieurs niveaux, dont le contenu est défini via un json
  - Selection de niveau via un menu, une fois niveau unlocked
- Ajouter des ennemis plus complexes dans leurs tirs et mouvements
  - Boss
  - Ennemis qui se déplacent en groupe/vague
- Ajouter le support de nouveaux inputs
  - Gamepad
  - Touch input
- Ajouter le local coop pour 2 joueurs
- Ajouter des power-ups
- Ajouter un leaderboard local (tips, utiliser 'prompt' en JS pour la saisie texte)
  - Le rendre persistant sur le disque (via localStorage)
  - Le rendre online (si le backend ne vous fait pas peur)
- Ajouter plus de game feel
  - Explosion des vaisseaux
  - Améliorer les bullets (utilisation d'une image/sprite au lieu de rectangle)
  - Améliorer l'audio (musique, sons...)
- Mettre à jour l'UI pour un design homogène
- Reskin des graphismes (si vous avez un petit côté artiste, 
assurez-vous d'avoir les droits d'utilisation et
garder une certaine coherence visuelle)
- Ajouter un tutoriel (expliquer les contrôles, tuto diégétique)
- Ajouter mouvement vertical pour le joueur

Vous vous aussi proposer des features additionnelles, n'hésitez pas à en discuter en amont d'abord

## Réferences
- https://github.com/rthery/coda-shmup