# Sprites du jeu

Chaque PNG du dossier `sprites/` devient une frame de l'atlas `public/assets/Spritesheet/gameSprites.png`,
nommée comme le fichier sans son extension : `ufoRed.png` devient la frame `'ufoRed'`.

## Ajouter ou modifier un sprite

1. Déposer le PNG dans `assets-src/sprites/`
2. Lancer `npm run atlas`
3. L'utiliser dans le jeu : `this.add.sprite(x, y, 'sprites', 'monSprite')`

`npm run atlas` lance `tools/pack-atlas.mts`, un script TypeScript que Node 22.18 (ou plus récent) exécute directement.
`gameSprites.png` et `gameSprites.json` sont générés par le script : ne jamais les modifier à la main.

## Voir ce que contient l'atlas

- Ouvrir `gameSprites.png` et `gameSprites.json` côte à côte : pour chaque sprite, `frame` donne sa position et sa taille dans l'image.
- Dans le jeu, lister les frames chargées : `console.log(this.textures.get('sprites').getFrameNames())`

## Origine

Les sprites viennent du pack Kenney « Space Shooter Redux », licence CC0 (domaine public) : https://kenney.nl/assets/space-shooter-redux
`ufoRed-shoot0` et `ufoRed-shoot1` n'en font pas partie : ce sont des variantes de `ufoRed` pour l'animation de tir.

## Ce qui reste hors de l'atlas

Les images répétées, comme le fond `darkPurple`, restent des images à part (`public/assets/Backgrounds/`).
Dans un atlas, le filtrage de la carte graphique lit quelques pixels autour de chaque frame :
une image répétée montrerait des joints entre ses tuiles.

Les vaisseaux et l'ovni ont été tournés de 90° pour regarder vers la droite : dans Phaser, un angle de 0 pointe vers la droite.
