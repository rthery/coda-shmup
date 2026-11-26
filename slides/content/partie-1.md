---
layout: chapter
logos: true
topics: setup, game loop, input, physique arcade, assets, JSON, pooling
---

# Partie 1
## Du template au prototype

<!--
Trois types de slides : commentaire (le code est montré et expliqué dans WebStorm), « Guidé » (je montre, ils recodent en même temps), « Libre » (exercice court et rare, sur ce qu'ils ont déjà vu, avant la slide Solution).
Fil conducteur : on parcourt la branche main commit par commit dans WebStorm (onglet Git, Log),
une slide par commit. Partie 1 = commits 01 à 21.
-->

---

<div class="final-game">
<div>

# Ce qu'on va construire

- Un **shoot'em up 2D** en mode portrait (1080 × 1920) : un vaisseau, des ennemis, un score
- Phaser 3 + TypeScript + Vite, publié automatiquement sur itch.io

<p class="play-link">Jouez-y : <a href="https://surmoi.itch.io/coda-shmup" target="_blank">surmoi.itch.io/coda-shmup</a></p>

</div>
<video src="/video/final.mp4" autoplay loop muted playsinline></video>
</div>

<!--
Lancer le jeu sur itch.io et jouer 30 secondes devant eux. Les élèves peuvent l'ouvrir sur leur téléphone (contrôles tactiles absents dans cette version, clavier uniquement).
-->

---

# Comment on travaille

- On refait le jeu **commit par commit**, tous sur la même base
- Chaque slide = un commit de `main`, que je montre et explique dans l'éditeur

<div class="kinds">
<div><span class="tag live">Guidé</span> je montre le code, vous le recodez en même temps</div>
<div><span class="tag exo">Libre</span> un court exercice seuls, puis la solution</div>
</div>

Pour aller au commit 07 (elle efface vos changements) :

```bash
git go 07
```

<p class="docs">La doc Phaser, à garder ouverte : <a href="https://docs.phaser.io/phaser/getting-started/what-is-phaser" target="_blank">docs.phaser.io</a>, <a href="https://docs.phaser.io/api-documentation/api-documentation" target="_blank">API</a></p>

<!--
Le repo est sur GitHub (rthery/coda-shmup), chaque élève le forke et clone son fork.
git go NN : alias installé une fois (slide « Récupérer le projet », et README). Il fait git clean -fd (fichiers non suivis, pas node_modules) puis git switch -fC cours <hash du NN-ième commit de main> : la même commande à chaque étape, sans « detached HEAD ».
Dans WebStorm : Git > Log, filtrer sur la branche main, double-clic sur un commit pour voir son diff.
Les numéros 01 à 44 des slides = position dans git log --reverse.
-->

---
layout: part
label: Partie 1
sub: Le projet tourne chez vous
---

# Mise en place

---

# Récupérer le projet

- Forkez `rthery/coda-shmup` sur GitHub, puis clonez **votre** fork
- Node.js en version LTS, git, un éditeur (WebStorm ou VS Code)

```bash
git clone git@github.com:<vous>/coda-shmup.git
cd coda-shmup
# une fois : collez la commande git config alias.go du README
git go 02
npm install
npm run dev-nolog
```

<div class="cp"><b>Sur votre machine</b>La page du jeu s'affiche sur localhost:8080.</div>

<!--
Tout le monde le fait en même temps, avec un compte GitHub prêt.
-nolog : sans le ping de télémétrie de log.js (template, dev/prod, version Phaser), voir README_PHASER.md « About log.js ».
-->

---
class: commit-slide
---

<div class="commit" style="margin-bottom: 2px"><b>01</b><code>9f20bdc</code><span>Init project with create-phaser-game</span></div>
<div class="commit"><b>02</b><code>f1fc55b</code><span>Update packages</span></div>

# Le template

- Commit 01 = le template officiel **Vite + TypeScript**, version Minimal : `npm create @phaserjs/game@latest`
- Commit 02 = les dépendances à jour
- On lance avec `npm run dev-nolog` : `npm run dev` exécute aussi `log.js`, qui envoie une requête à Phaser à chaque lancement

<!--
Démo seulement : comment le commit 01 a été généré avec npm create (les élèves l'ont déjà via leur clone). Mise à jour des dépendances : npx npm-check-updates -u.
log.js envoie un ping anonyme à gryzor.co (domaine de Phaser Studio) : dev ou build, version Phaser, nom du package. Voir README_PHASER.md « About log.js ».
Pourquoi -nolog : pas de requête vers un tiers à chaque lancement, et sur Windows npm passe par cmd, où « & » enchaîne les commandes : Vite attend la fin de log.js, dont la requête n'a pas de timeout. Sur un réseau qui bloque ce domaine, npm run dev peut rester bloqué sans message.
Commit 01 : montrer l'arborescence générée (src/game/main.ts, src/game/scenes/Game.ts, vite/).
Commit 02 : seul package.json change, Phaser reste en 3.90. Phaser 4 est une idée de TD (voir COURS.md).
-->

---
class: commit-slide
---

<div class="commit" style="margin-bottom: 2px"><b>03</b><code>09b5d8b</code><span>Rename Game.ts to be more explicit as MainGameScene.ts</span></div>
<div class="commit"><b>04</b><code>730fb55</code><span>Remove src/game subfolder</span></div>

# Ranger avant de coder

- `Game.ts` devient `MainGameScene.ts`
- Plus de `src/game/` : la config vit dans `src/main.ts`

<!--
Commit 03 : renommage avec WebStorm (Refactor > Rename) pour que les imports suivent. La clé de scène passe de 'Game' à 'MainGameScene'.
Commit 04 : src/game/main.ts est supprimé, son contenu est fusionné dans src/main.ts:1-23.
Une scène = une classe qui étend Scene, avec une clé unique. Cycle de vie : init → preload → create → update (flowchart lié dans COURS.md).
-->

---
layout: part
label: Partie 1
sub: Le cœur du jeu, avec des formes simples
---

# Bouger, tirer, détruire

---
class: commit-slide
---

<div class="commit"><b>05</b><code>7e6c1c8</code><span>Demonstrate FPS control and game loop</span></div>
<div class="tag live">Guidé</div>

# La game loop

- Phaser appelle `update(time, delta)` à **chaque frame**
- <span class="warn">`delta` est en millisecondes</span> et varie selon l'écran (60, 120, 144 Hz)
- `fps` dans la config pour forcer une cadence et tester

<p class="docs">Docs : <a href="https://docs.phaser.io/phaser/concepts/scenes" target="_blank">Scenes</a></p>

<!--
MainGameScene.ts:31-34. Lancer le jeu : le texte affiche le temps écoulé et le delta de chaque frame.
Décommenter src/main.ts:16 (fps: { forceSetTimeOut: true, target: 120 }) pour montrer que delta change.
En interne : while (true) { handleInput(); update(); render(); }
D'où la règle pour la suite : toujours multiplier une vitesse par delta.
-->

---
class: commit-slide
---

<div class="commit"><b>06</b><code>8b83a7e</code><span>Update resolution to be portrait FHD</span></div>

# Un jeu en portrait

- Résolution **1080 × 1920**, en pixels de jeu
- `Scale.FIT` adapte le canvas au navigateur en gardant le ratio
- Tout le placement du jeu se fait dans ce repère

<!--
src/main.ts:8-9. Redimensionner la fenêtre du navigateur : le jeu garde son ratio, bandes autour.
Le texte du commit 05 reste placé en (512, 490) : il n'est plus centré, normal.
-->

---
class: commit-slide
---

<div class="commit"><b>07</b><code>042d67c</code><span>Add player game object</span></div>
<div class="tag live">Guidé</div>

# Un premier Game Object

- Le joueur est un **triangle** : pas encore d'image, juste une forme
- Repère : (0, 0) en haut à gauche, **y vers le bas**
- Un point rouge `playerCenter` pour voir où est l'origine

<p class="docs">Docs : <a href="https://docs.phaser.io/phaser/concepts/gameobjects" target="_blank">Game Objects</a></p>

<!--
MainGameScene.ts:19-27. Les chargements du template (bg.png, logo.png) sont retirés de preload.
Piège à montrer : npx tsc --noEmit échoue ici (TS6133, playerCenter est écrit mais jamais lu, noUnusedLocals dans tsconfig.json).
Le jeu tourne quand même : Vite ne vérifie pas les types. L'erreur disparaît au commit 08 (playerCenter est relu dans update).
Debug tool Phaser (lien dans COURS.md, Chrome uniquement) pour inspecter le Game Object.
-->

---
class: commit-slide
---

<div class="commit"><b>08</b><code>83fd8f7</code><span>Add keyboard input for player movement</span></div>
<div class="tag live">Guidé</div>

# Se déplacer

- `createCursorKeys()` : flèches, espace, shift
- Vitesse × `deltaTime` : <span class="warn">0.9&nbsp;px/ms</span>
- `Clamp` garde le vaisseau dans l'écran

<p class="docs">Docs : <a href="https://docs.phaser.io/phaser/concepts/input" target="_blank">Input</a>, <a href="https://docs.phaser.io/api-documentation/class/input-keyboard-keyboardplugin" target="_blank">KeyboardPlugin</a>, <a href="https://docs.phaser.io/api-documentation/function/math#clamp" target="_blank">Math.Clamp</a></p>

<!--
Vitesse × deltaTime : même rendu à 60 ou 144 Hz.
Clavier initialisé dans create, MainGameScene.ts:32-42 (createCursorKeys et addKey('LEFT') en doublon, nettoyé au commit 09).
update : MainGameScene.ts:44-61. playerCenter est resynchronisé en fin d'update : l'erreur tsc du commit 07 disparaît.
Les 3C (Camera, Control, Character) : dans cette partie on remplit Control et Character.
-->

---
class: commit-slide exercise
---

<div class="start">On part du commit <b>08</b> : <code>git go 08</code></div>
<div class="tag exo">Libre</div>

# Tirer

<p class="goal">ESPACE tire des balles vers le haut, max une toutes les 500 ms.</p>

- Une balle = un rectangle placé au-dessus du vaisseau
- Gardez les balles dans un tableau et déplacez-les dans `update` : vitesse × `delta`
- Pour la cadence, comparez le `time` de `update` à l'heure du dernier tir

<p class="docs">Docs : <a href="https://docs.phaser.io/phaser/concepts/gameobjects" target="_blank">Game Objects</a>, <a href="https://docs.phaser.io/phaser/concepts/input" target="_blank">Input</a></p>

<!--
Les élèves codent seuls, environ 15 min, sans regarder la suite.
La solution (commit 09) utilise la physique Arcade, qu'ils n'ont pas vue : c'est le moment de montrer que le moteur fait pour eux ce qu'ils ont écrit à la main, avec une vélocité en px/s et non en px/ms.
Après la solution, tout le monde repart du commit de la solution.
-->

---
class: commit-slide
---

<div class="commit"><b>09</b><code>6509317</code><span>Add keyboard input for player to shoot bullet</span></div>
<div class="tag sol">Solution</div>

# Tirer

- On active la physique **Arcade** dans la config du jeu
- La balle a un body : <span class="warn">vélocité en px/s</span> (−1024), pas en px/ms
- `lastShotTime` limite la cadence : un tir toutes les 500&nbsp;ms

<p class="next">Pour repartir de la solution : <code>git go 09</code></p>

<!--
Config physique : src/main.ts:16-21 (arcade, debug: false). Passer debug à true pour voir les hitbox.
Tir : MainGameScene.ts:52-63.
Deux mondes : le joueur bouge à la main (px/ms × delta), la balle bouge par la physique (px/s, Phaser gère le delta).
Les balles ne sont jamais détruites : ouvrir le debug tool, leur nombre grimpe. Corrigé au commit 10.
-->

---
class: commit-slide
---

<div class="commit"><b>10</b><code>a847366</code><span>Add enemies that player bullet can destroy</span></div>
<div class="tag live">Guidé</div>

# Des ennemis

- Deux **groupes** physiques : balles et ennemis
- `overlap` : un callback à chaque contact
- Un timer : un ennemi toutes les 1.5 s

<p class="docs">Docs : <a href="https://docs.phaser.io/phaser/concepts/physics/arcade" target="_blank">Arcade Physics</a>, <a href="https://docs.phaser.io/phaser/concepts/time" target="_blank">Time</a></p>

<!--
overlap : MainGameScene.ts:42-48. Timer : 50-56. spawnEnemy : 58-75 (cercle rouge, 5 ennemis max, vélocité 256 px/s).
Fin d'update, 108-120 : on détruit balles et ennemis sortis de l'écran.
Question à la classe : combien coûte un add + destroy à chaque tir ? Réponse au commit 21 (pooling).
-->

---
class: commit-slide
---

<div class="commit"><b>11</b><code>90b82cf</code><span>Update enemies to collide with player and to also shoot bullets</span></div>

# Les ennemis ripostent

- Le joueur reçoit un body, touché = `endGame()` qui relance la scène
- Chaque ennemi a **son propre timer** de tir, toutes les 2 à 3 s
- <span class="warn">Bug</span> : un ennemi détruit continue de tirer

<!--
Collisions joueur : MainGameScene.ts:51-60, endGame : 71-75 (scene.restart()).
Timer de tir : 96-102, enemyShoot : 105-113.
Le bug : enemy.destroy() ne supprime pas le timer, qui continue d'appeler enemyShoot sur un objet détruit.
Le montrer en jeu : des balles rouges sortent de nulle part. Corrigé au commit 12.
Le déplacement du joueur passe par son body (MainGameScene.ts:121-129) : il a maintenant un body physique.
-->

---
class: commit-slide
---

<div class="commit"><b>12</b><code>add3d61</code><span>Fix issue with dead enemies shooting</span></div>

# Nettoyer derrière soi

- Une `Map` associe chaque ennemi à son timer
- Ennemi détruit = timer supprimé avec `timer.remove()`
- Même code copié pour l'ennemi sorti de l'écran : ça sent le refactor

<!--
Map déclarée MainGameScene.ts:10, créée :70, remplie :112 (this.enemyShootTimers.set(enemy, timer)).
Même suppression en fin d'update, :170-176.
Règle à retenir : tout ce qu'on crée (timer, listener) doit être détruit avec l'objet. On la retrouvera avec le pooling.
-->

---
class: commit-slide
---

<div class="commit"><b>13</b><code>7b044f8</code><span>Track scoring when defeating enemies</span></div>

# Compter les points

- Un ennemi détruit = +1 point
- <span class="warn">Initialiser dans `create`</span>, pas à la déclaration
- `scene.restart()` réutilise la même instance : le constructeur ne repasse pas

<!--
MainGameScene.ts:8-9, 63-64, 82-83.
Pourquoi : une valeur donnée à la déclaration n'est posée qu'une fois, à la construction. Après un restart, le score repartirait de l'ancienne valeur.
Pour l'instant le score n'est visible que dans la console. Affichage à l'écran au commit 33.
-->

---
layout: part
label: Partie 1
sub: Sprites, JSON, atlas et pooling
---

# Des images et des données

---
class: commit-slide
---

<div class="commit"><b>14</b><code>9d8d43a</code><span>Add background to the level</span></div>

# Un fond qui défile

- Assets **Kenney**, licence CC0 : kenney.nl
- `TileSprite` : une texture répétée, on fait glisser `tilePositionY`
- Parallaxe : fond à 0.1 px/ms, planète à 0.4 px/ms

<!--
preload :27-28, create :38-39, update :142-143.
CC0 = utilisable librement, y compris commercialement. Outil : photopea.com.
Ordre d'affichage : le fond est créé avant le joueur, donc dessiné dessous (et le joueur a setDepth(100)).
-->

---
class: commit-slide
---

<div class="commit"><b>15</b><code>219a1a1</code><span>Add images for player and enemies</span></div>

# Des sprites à la place des formes

- **Atlas** : une image + un fichier qui décrit où est chaque sprite
- On choisit un sprite par son nom de frame
- Origine à 0.5 : la position est le centre du sprite

<!--
preload :29, joueur :42, ennemi :110 (ufoRed.png au lieu du cercle).
Le setCircle(1, -1, -1) du triangle disparaît : le body d'une image prend sa taille par défaut.
Spritesheet = frames de même taille, positions calculables. Atlas = tailles variées, positions décrites dans un fichier.
-->

---
class: commit-slide
---

<div class="commit"><b>16</b><code>f3c186a</code><span>Add static game data for player ships</span></div>
<div class="tag live">Guidé</div>

# Config JSON

- Les valeurs de gameplay sortent du code
- Chargées au `preload`, lues avec `cache.json.get`

<p class="docs">Docs : <a href="https://docs.phaser.io/phaser/concepts/loader" target="_blank">Loader</a></p>

<!--
Chargement :32, lecture :45-46, touches 1/2/3 :57-59, selectPlayerShip :103-109.
movementSpeed remplace playerMovementSpeed dans update (:167, :171).
Type : src/gameData/PlayerShipsData.ts (le JSON est typé). Ce pattern sera réutilisé pour l'évaluation (ennemi configurable).
-->

---
class: commit-slide
---

<div class="commit"><b>17</b><code>db554f0</code><span>Switch to a JSON sprite atlas with only the game sprites</span></div>

# Un atlas sur mesure

- Un PNG par sprite dans `assets-src/sprites`
- `npm run atlas` les packe dans un seul atlas JSON
- Dans le code, la frame porte le nom du fichier sans `.png`
- 39 Ko au lieu des 147 Ko de l'atlas Kenney complet

<!--
MainGameScene.ts:30. Les noms de frame perdent leur extension : 'ufoRed.png' devient 'ufoRed' (ici et dans playerShips.json).
Ajouter un sprite : déposer le PNG dans assets-src/sprites, lancer npm run atlas, utiliser son nom de fichier sans .png.
tools/pack-atlas.mts est du TypeScript que Node 22.18 ou plus récent exécute directement, sans compilation : .mts = module TypeScript, comme .mjs pour JavaScript.
gameSprites.png et gameSprites.json sont générés : on ne les édite pas à la main. Voir assets-src/README.md
(source Kenney « Space Shooter Redux », CC0 ; le fond qui se répète reste hors de l'atlas).
Pour voir ce que contient l'atlas, dans la console du navigateur ou dans create() :
console.log(this.textures.get('sprites').getFrameNames())
L'ancien sheet.png reste dans le repo jusqu'au commit 26.
-->

---
class: commit-slide
---

<div class="commit"><b>18</b><code>3916f4f</code><span>Add enemy shooting animation</span></div>

# Animer le tir ennemi

- `anims.create` : 3 frames de l'atlas à 4 images par seconde
- `Sprite` au lieu d'`Image` : seul un Sprite peut jouer une animation
- La balle part à la fin de l'animation

<p class="note"><span class="warn">Bug</span> : un listener de plus à chaque tir.</p>

<!--
anims.create :91-99, add.sprite :138, enemyShoot :157-172.
Le bug : enemy.on(...) ajoute un listener à chaque tir. Au 3e tir, l'animation finie déclenche 3 callbacks, donc 3 balles empilées.
Le montrer avec arcade.debug à true : les balles rouges se superposent.
Corrigé au commit 22 avec once(...) : le listener se retire après un appel.
-->

---
class: commit-slide exercise
---

<div class="start">On part du commit <b>18</b> : <code>git go 18</code></div>
<div class="tag exo">Libre</div>

# Recommencer avec R

<p class="goal">La touche R relance la partie.</p>

- Une touche s'écoute comme 1, 2, 3 qui changent de vaisseau : `addKey(...).on('down', ...)`
- Relancer la scène courante : `this.scene.restart()`

<p class="docs">Docs : <a href="https://docs.phaser.io/api-documentation/class/input-keyboard-keyboardplugin" target="_blank">KeyboardPlugin</a>, <a href="https://docs.phaser.io/api-documentation/class/scenes-sceneplugin" target="_blank">ScenePlugin</a></p>

<!--
Les élèves codent seuls, environ 5 min, sans regarder la suite.
Exercice court, pour un premier succès en autonomie. La solution tient en une ligne.
Après la solution, tout le monde repart du commit de la solution.
-->

---
class: commit-slide
---

<div class="commit" style="margin-bottom: 2px"><b>19</b><code>98aa13d</code><span>Add keyboard shortcut to restart scene and help with debug</span></div>
<div class="commit"><b>20</b><code>00c4890</code><span>Fix warning about enemy animations init</span></div>
<div class="tag sol">Solution</div>

# R pour recommencer

- R relance la scène : pratique pour tester vite
- Les animations sont **globales** au jeu, pas à la scène
- Au restart, `create` recrée `ufoShoot` : warning, on vérifie avant

<p class="next">Pour repartir de la solution : <code>git go 20</code></p>

<!--
Commit 19 : MainGameScene.ts:60. Appuyer sur R, montrer le warning dans la console (clé d'animation déjà utilisée).
Commit 20 : MainGameScene.ts:92-102.
this.anims pointe vers l'AnimationManager du jeu, partagé par toutes les scènes, alors que this.time ou this.physics sont propres à la scène.
-->

---
class: commit-slide
---

<div class="commit"><b>21</b><code>262ba0b</code><span>Pool player and enemy bullets</span></div>
<div class="tag live">Guidé</div>

# Le pooling des balles

- Créer et détruire des objets en boucle coûte cher
- On **pré-remplit** un groupe de `Bullet`, puis on les réutilise
- `group.get()` rend une balle libre, `disable()` la rend au pool

<p class="docs">Docs : <a href="https://docs.phaser.io/phaser/concepts/gameobjects/group" target="_blank">Group</a></p>

<!--
Nouvelle classe src/entities/Bullet.ts : init() une fois, enable() à chaque tir, disable() pour la rendre au pool, update() la recycle hors écran.
Groupes : MainGameScene.ts:71-83 (classType: Bullet, maxSize: 256, runChildUpdate: true), warmGroupItems :134-149.
Tir joueur :230, tir ennemi :201. Dans l'overlap, bullet.destroy() devient disable() (:95).
Si group.get() rend null (pool plein), on ne tire pas : d'où le if (bullet).
-->

---

# Bilan de la partie 1

- Un mini-shmup **jouable** : bouger, tirer, des ennemis, un score
- Tout vit dans `MainGameScene` (≈ 250 lignes) : ça marche, mais ça ne tiendra pas
- La suite repart du commit 21

<!--
Aperçu de la partie 2 : on repart de ce prototype (commit 21) vers l'architecture du repo final : entités, composants, managers.
-->
