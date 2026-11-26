# Tech Plan

Objectif : ajouter un ennemi qui descend en sinusoide, qui tire en spread shot et qu'on peut regler avec un json.

## Fichiers

- `Enemy.ts` : j'ai mis des trucs en protected et ajouté `createWeapon()`, `move()` et `restoreDefaultTint()` pour pouvoir faire un ennemi qui en herite. Le ralentissement quand il prend un coup regarde `tintFill` maintenant, avant c'etait `isTinted` et du coup mon ennemi bleu etait tout le temps ralenti.
- `SinusoidalEnemy.ts` : herite de Enemy, teinté en bleu (0x4cc9f0), utilise SpreadWeapon.
- `Weapon.ts` : j'ai sorti la creation de la balle dans `spawnBullet(source, angleOffset)`.
- `SpreadWeapon.ts` : herite de Weapon, tire plusieurs balles en eventail. Si l'angle fait 360 je divise par le nb de balles sinon la premiere et la derniere sont au meme endroit.
- `EntityManager.ts` : un deuxieme pool pour le nouvel ennemi, spawnEnemy prend le groupe en param et les collisions sont dans une fonction pour pas copier coller.
- `sinusoidalEnemy.json` + `SinusoidalEnemyData.ts` : la config + le type, chargé dans HomeScene.

## Mouvement

Pas de Math.sin, je fais comme un ressort : plus l'ennemi est loin de son point de spawn plus il est ramené vers le centre.

```
acceleration = -frequency * frequency * offsetX
velocityX += acceleration * dt
offsetX += velocityX * dt
```

Au spawn offsetX = 0 et velocityX = amplitude * frequency, comme ca il va pile a amplitude pixels de chaque coté. C'est remis a 0 dans enable() pour le pool.

## JSON

- spawnRateMs : temps entre 2 spawn
- frequency : vitesse de la vague (0.003 ~ un aller retour toutes les 2s)
- amplitude : largeur de la vague en px
- bulletCount / spreadAngleDeg : nb de balles et angle (360 = cercle)

## Playtest

- lancé avec `npm run dev-nolog`
- les ennemis bleus spawn toutes les 3s, max 3, ils font bien des vagues
- ils tirent 3 balles bleues en eventail
- quand on les touche ils flash en blanc et meurent, le score monte, les rouges marchent comme avant
- mis 60 balles a 360 dans le json -> ils tirent en cercle
- mis amplitude 150 et spawnRateMs 1000 -> vagues plus grandes et plus d'ennemis
- joué un moment pour que le pool reutilise les ennemis, ils repartent bien de leur point de spawn
- `npm run build-nolog` passe
