# Local coop: tech plan

Two players (up to 4 with no extra work) on one screen, each on their own device. The online mode comes later and reuses this code: a remote player becomes one more input source.

## Rules

- XP and level are shared by the team. On a level-up the game pauses and every player picks one upgrade for their own ship. The game resumes once everyone has picked.
- Upgrades stay per ship.
- Pause is for everyone and can be opened from any device.
- A destroyed ship turns into a pod. The pod can move but can't shoot, it's invulnerable, and enemies ignore it. After `RESPAWN_DELAY` (10 s, shown on the pod) the ship comes back where the pod is, keeping its upgrades, with its hull and shield cells full and the usual brief invulnerability. Game over happens when every player is down at the same time.
- Score, combo and run time are shared. A hit on any player breaks the combo.
- One best score, saved with the number of players who made it, shown as "BEST 12345 · 2P".
- No touch in coop: touch only drives a solo run.
- Difficulty scales with the number of players who joined (not the number alive).
- Solo plays exactly as it does today.

## Design

### Input: one `PlayerInput` per player

- New `PlayerInput` interface: `moveDirection` and `confirmJustPressed()`. Implementations:
  - `AnyDeviceInput` is today's behavior, used in solo.
  - `KeyboardInput` takes a key set: WASD for one player, arrows for another.
  - `GamepadInput` is bound to a pad index.
  - Touch stays inside `AnyDeviceInput`, so it only drives a solo run.
- `GameInputManager` builds and owns these. Menu-level queries (`confirmJustPressed`, `pauseJustPressed`, `restartJustPressed`) stay global and answer for any device.
- `Player.preUpdate` reads `this.input.moveDirection` instead of `scene.gameInputManager.moveDirection`. This is the seam the online mode plugs a `RemoteInput` into.

### Team state

- New `Team` object, owned by `MainGameScene`. It holds the players, the shared `Experience`, and the joined count.
- `Experience` moves from `Player` to `Team`. Gems add to the team.
- `MainUIScene` binds the XP bar to the team instead of `PLAYER_SPAWNED_EVENT`'s player.
- A new `TEAM_SPAWNED_EVENT` carries the team. The HUD shows one row of life icons per player, colored per player.

### EntityManager with N players

- `_player` becomes `_players` (an arcade group). Overlaps are set against the group, and callbacks get the player that was hit.
- `Enemy` targets the nearest player that isn't down, picked each frame (70 enemies × 2 players is cheap). `init` takes the team, not a player.
- `XpGem` flies to the nearest player whose magnet radius it enters, and stores that player as `target`. `MagnetField` only draws tethers to its own gems.
- Pickups:
  - Bomb goes off from the collector.
  - Magnet pulls every gem to the collector.
  - Repair heals every player, and drops when any player's hull is damaged.
- Dev cheats (F, L, digits, M, and +/- from `MainGameScene`) move into a new `CheatManager` scene plugin, registered like `EntityManager` and only active in dev builds. Upgrade cheats act on player 1. Otherwise L adds the XP twice and digits upgrade both ships.
- Player 2 needs its own ship sprite: a recolor of `playerShip3_blue` added to `assets-src/sprites`, plus an entry in `playerShips.json`.

### Camera

- The camera follows an invisible target placed at the centroid of the players who aren't down. In coop the look-ahead uses their average velocity.
- Leash: on each axis, two players can't be farther apart than the view size minus a margin. The player moving away gets clamped, the same way the arena clamp works today. Enemy spawns and the bomb already use the camera view, so they need no change.

### Down and respawn

- `Health.DEATH_EVENT` on a player now leads to a downed state, not to `endGame`:
  - The ship is hidden and a pod sprite takes its place.
  - The body is disabled for hits (it stays in `_players`, flagged `isDown`).
  - A respawn timer starts.
- `MainGameScene` checks the team on each down. When all players are down, it plays the current death sequence on the last one, then `endGame`.
- In solo, the down state goes straight to game over, as today.

### Level-up

- `Team` emits the level-up. `LevelUpScene` gets the list of players and runs one pick per player, in order ("PLAYER 2: PICK AN UPGRADE"). Each pick reads only that player's `PlayerInput`, and each player gets their own 3 random cards. `close()` runs after the last pick.
- One pick at a time fits both portrait and landscape views, since a card is 960 px wide. Online would run the same per-player picks in parallel, each on its own screen.

### Joining (`HomeScene`)

- Today, confirm from any device starts the run. New flow:
  - The first confirm claims a slot for that device (Space claims WASD, Enter claims arrows, A claims that pad) and shows "P2: PRESS TO JOIN".
  - A confirm from another device claims the next slot.
  - The first player confirms again to launch.
- With a single player, they get `AnyDeviceInput`, which keeps solo unchanged.
- The joined slots are passed to `MainGameScene` through scene data.

### Difficulty

New `coop` block in `difficulty.json`, applied for each player beyond the first:

```json
"coop": { "maxEnemiesScale": 0.6, "spawnIntervalScale": 0.75, "enemyHealthScale": 0, "xpScale": 0.5 }
```

`DifficultyCurve.at()` and the XP curve take the joined count. `xpScale` exists because two players kill faster and also pick twice per level.

## Steps

Each step builds and plays in solo before the next one.

1. `PlayerInput` and the input slots. No behavior change.
2. `Team` with the shared `Experience`, and the HUD bound to it. No behavior change.
3. `CheatManager`, then N players in `EntityManager`: targeting, gems, pickups. A dev flag spawns 2 players.
4. Camera centroid and leash.
5. Down, pod, respawn, team game over.
6. Level-up picks for each player.
7. `HomeScene` join flow, player 2 sprite, HUD rows, best score with its player count.
8. Difficulty scaling.

## Risks

- `GameInputManager` only knows the scene's gamepad plugin once a scene is hooked. Pad indexes must stay stable across the Home to Game scene change, or the slots get remapped.
- `hitStop` and the level-up both pause `MainGameScene`. The existing `updateHitStop` guard covers it, but the new sequential pick must still resume only once.
- With the leash, two players pushing in opposite directions are both stuck at the limit. That's intended, but it needs a playtest.

### Best score

`SaveManager` stores `PLAYER_BEST_SCORE_PLAYERS` next to `PLAYER_BEST_SCORE`, written together. Saves from before this change have no count and read as 1. Home and game over show the count next to the best score.
