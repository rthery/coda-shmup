# Local coop: tech plan

Two players on one screen, each on their own device, or one player with a bot. The online mode comes later and reuses this code: a remote player becomes one more input source.

## Rules

- XP and level are shared by the team. On a level-up the game pauses and every player picks one upgrade for their own ship. The game resumes once everyone has picked.
- Upgrades stay per ship.
- Pause is for everyone and can be opened from any device.
- A destroyed ship turns into a pod. The pod can move but can't shoot, it's invulnerable, and enemies ignore it. After `RESPAWN_DELAY` (10 s, shown on the pod) the ship comes back where the pod is, keeping its upgrades, with its hull and shield cells full and a brief invulnerability. Game over happens when every player is down at the same time.
- Score, combo and run time are shared. A hit on any player breaks the combo.
- One best score, saved with the number of players who made it, shown on game over as "BEST 012345 · 2P".
- No touch in coop: touch only drives a solo run.
- A second player joins anytime during a run, from a device player 1 isn't using, or B adds a bot instead.
- Difficulty scales with the number of players who joined (not the number alive).
- Solo plays exactly as it did before.

## Design

### Input: one `PlayerInput` per player

- `PlayerInput` interface: `device`, `moveDirection` and `confirmJustPressed()`. `GameInputManager.getInput(device)` builds one for an `InputDevice`:
  - `any`: every device minus `excluded`, the ones the other human players own. Player 1's, and the only one touch drives.
  - `keyboard`: a key set by physical position, WASD + Space or arrows + Enter.
  - `gamepad`: one pad index, stick or d-pad, A or Start to confirm.
- Menu-level queries (`confirmJustPressed`, `pauseJustPressed`, `restartJustPressed`) stay global and answer for any device.
- `Player.preUpdate` reads its own `playerInput`. This is the seam the online mode plugs a remote input into.

### Team state

- `Team`, owned by `MainGameScene`, holds the players and the shared `Experience`, and finds the nearest player still in the fight.
- `TEAM_CREATED_EVENT` carries the team. The HUD binds the XP bar to it, and adds one row of lives per spawned player, in that ship's color.

### EntityManager with N players

- `_player` becomes `_players`, an array. Overlaps take the array, and callbacks get the player that was hit.
- `Enemy` targets the nearest player in the fight, picked each frame. `init` takes the team.
- `XpGem` flies to the first player whose magnet radius it enters and stores it as `target`, or to the nearest one if that player goes down. `MagnetField` only draws tethers to its own gems.
- Pickups: the bomb goes off from the collector, the magnet pulls every gem to the collector, and repair heals every player in the fight (it drops when any of them is damaged).
- Dev cheats (F, L, digits, M, +/-) live in the `CheatManager` scene plugin, dev builds only. Upgrade cheats act on player 1.
- Ships cycle through `playerShips.json`: blue `playerShip3`, then orange `playerShip1`, a different shape. Each ship data has a `lifeIcon`, used by the HUD and the pod.

### Camera

- The camera follows the middle of the ships still on the field, pods included. The look-ahead uses their average velocity.
- Leash: on each axis, two ships can't be farther apart than the view size minus `LEASH_MARGIN`. The one moving away is clamped, like the arena clamp. Enemy spawns and the bomb already use the camera view.

### Down and respawn

- On `Health.DEATH_EVENT`, `MainGameScene` checks the team. If a teammate is still in the fight, `Player.eject()` turns the ship into its pod and starts the respawn timer. Otherwise every pod is removed, the death sequence plays on the last ship, then `endGame`.
- `Player.isInFight` (active and not down) gates targeting, gems, repair and firing. `active` alone gates the camera and the leash.
- Components got a `show()` to undo `hide()` on respawn.
- In solo there is never a teammate, so death goes straight to game over.

### Level-up

- `LevelUpScene` gets the players and runs one pick per player, in order ("LEVEL 3 · PLAYER 2"). Each pick reads only that player's input, with its own 3 random cards and its own hint. The scene closes after the last pick.

### Joining

- The home screen is unchanged: any confirm starts the run.
- During a run, `MainGameScene.updateJoining()` lets a second player in with the confirm of a key set or pad player 1 didn't use up to the last frame (Space, Enter or A). `EntityManager.joinPlayer()` flies the ship in from below the screen next to player 1, briefly invulnerable. The device goes into player 1's `excluded` list.
- B adds a bot instead. `BotInput` steers toward its teammate past `FOLLOW_DISTANCE`, away from enemies inside `DANGER_RADIUS`, and toward the nearest free star. On level-up it picks a random card after `BOT_PICK_DELAY`.
- The HUD shows how to join at the bottom while there's room (not on touch), and a "PLAYER 2 JOINED" or "BOT JOINED" banner.
- Joining raises the difficulty and the XP curve to the new player count.
- Joined devices are kept across an R restart. Game over goes back home, solo.

### Difficulty

`coop` block in `difficulty.json`, applied for each player beyond the first:

```json
"coop": { "maxEnemiesPerPlayer": 0.6, "spawnIntervalPerPlayer": 0.75, "enemyHealthPerPlayer": 0, "xpPerPlayer": 0.5 }
```

`DifficultyCurve` takes the player count. `xpPerPlayer` exists because two players kill faster and also pick twice per level.

### Best score

`PLAYER_BEST_SCORE_PLAYERS` is saved with `PLAYER_BEST_SCORE`. Saves from before have no count and read as 1.

## Steps

1. `PlayerInput` and the input slots.
2. `CheatManager`, then `Team` with the shared `Experience`.
3. N players in `EntityManager`: targeting, gems, pickups.
4. Camera center and leash.
5. Down, pod, respawn, team game over.
6. Level-up picks for each player.
7. Player 2 ship, HUD rows, best score with its player count.
8. Difficulty scaling.
9. Drop-in joining during a run, and the bot.

## Risks

- Player 1's device is the last key set or pad it used. If player 1 never touched a device before player 2 presses its confirm, that device can't join until player 1 moves once.
- With the leash, two players pushing in opposite directions both stop at the limit. The top margin also lets a ship slide under the HUD.
- `Invulnerability` blinks for about twice its duration (each repeat is a yoyo), so the 2000 ms respawn invulnerability lasts about 4 s.
