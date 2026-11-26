# Sprites du jeu

Chaque PNG du dossier `sprites/` devient une frame de l'atlas `public/assets/Spritesheet/gameSprites.png`,
nommée comme le fichier sans son extension : `ufoRed.png` devient la frame `'ufoRed'`.

## Ajouter ou modifier un sprite

1. Déposer le PNG dans `assets-src/sprites/`
2. Lancer `npm run atlas`
3. L'utiliser dans le jeu : `this.add.sprite(x, y, 'sprites', 'monSprite')`

`npm run atlas` lance `tools/pack-atlas.mts`, un script TypeScript que Node 24 (ou plus récent) exécute directement.
`gameSprites.png` et `gameSprites.json` sont générés par le script : ne jamais les modifier à la main.

## Voir ce que contient l'atlas

- Ouvrir `gameSprites.png` et `gameSprites.json` côte à côte : pour chaque sprite, `frame` donne sa position et sa taille dans l'image.
- Dans le jeu, lister les frames chargées : `console.log(this.textures.get('sprites').getFrameNames())`

## Origine

Les sprites viennent du pack Kenney « Space Shooter Redux », licence CC0 (domaine public) : https://kenney.nl/assets/space-shooter-redux
`ufoRed-shoot0` et `ufoRed-shoot1` n'en font pas partie : ce sont des variantes de `ufoRed` pour l'animation de tir.
`playerTurret` est assemblé à partir de `turretBase_small` et `gun07` (dossier `Parts` du pack), recolorés dans les gris du vaisseau, avec un dôme dans ses bleus.
`playerTurretTwin` reprend `playerTurret` avec deux canons.
`fireNeutral` et `fireNeutralBoost` sont `fire11` et `fire15` passés en gris : le jeu les teinte selon le niveau des propulseurs.
`ui_shield_cell` est `shield_silver`, `ui_icon_weapon` est `powerupRed_bolt` (dossier `Power-ups`).
`ui_icon_ship` est `powerupBlue` avec l'icône `playerLife3_blue` en blanc dessus.
`pickup_bomb` est `powerupRed_star`, `pickup_magnet` est `powerupYellow_star`, `pickup_repair` est `pill_green` (dossier `Power-ups`).
`playerShip1_orange` (tourné vers la droite comme `playerShip3_blue`) et `playerLife1_orange` sont le vaisseau du joueur 2.
`playerTurret_orange` et `playerTurretTwin_orange` reprennent les tourelles avec le dôme dans l'orange de ce vaisseau.

Les sprites `ui_*` viennent du pack Kenney « UI Pack - Sci-Fi », licence CC0 : https://kenney.nl/assets/ui-pack-sci-fi
Ce sont les versions `Double` du pack, renommées. Les panneaux sont découpés en 9 (`nineslice`) par `src/utils/UiUtils.ts`.

## Sons et musique

Les sons sont dans `public/assets/Sounds/`, chargés et joués par `src/audio/Sfx.ts` : un nom par événement du jeu, avec ses variantes `<nom>_0.ogg`, `<nom>_1.ogg`…
Ils viennent des packs Kenney « Sci-fi Sounds », « Impact Sounds » et « Interface Sounds » (licence CC0), et des sons bonus de « Space Shooter Remastered » (`shield_up`, `shield_down`, `game_over`, `sfx_laser2`).
`launch_0` est `thrusterFire_000` coupé à 1,2 s avec un fondu.

La musique `music_space_battle.ogg` est « Space Battle » de MintoDog, licence CC0 : https://opengameart.org/content/space-battle

## Ce qui reste hors de l'atlas

Les images répétées, comme le fond `darkPurple`, restent des images à part (`public/assets/Backgrounds/`).
Dans un atlas, le filtrage de la carte graphique lit quelques pixels autour de chaque frame :
une image répétée montrerait des joints entre ses tuiles.

Les vaisseaux et l'ovni ont été tournés de 90° pour regarder vers la droite : dans Phaser, un angle de 0 pointe vers la droite.
