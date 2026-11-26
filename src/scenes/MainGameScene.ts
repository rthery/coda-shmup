import {Scene} from 'phaser';
import Health from "../components/Health.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveManager from "../managers/SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import EntityManager from "../managers/EntityManager.ts";
import CheatManager from "../managers/CheatManager.ts";
import GameConstants from "../GameConstants.ts";
import Experience from "../components/Experience.ts";
import Team from "../Team.ts";
import {isSameDevice, type InputDevice} from "../managers/PlayerInput.ts";
import type PlayerInput from "../managers/PlayerInput.ts";
import BotInput from "../managers/BotInput.ts";
import Movement from "../components/Movement.ts";
import Player from "../entities/Player.ts";
import DifficultyCurve from "../utils/DifficultyCurve.ts";
import type {DifficultyData} from "../gameData/DifficultyData.ts";
import type Enemy from "../entities/Enemy.ts";
import Sfx from "../audio/Sfx.ts";

export default class MainGameScene extends Scene {
    private static readonly KILL_SCORE: number = 10;
    private static readonly HIT_STOP_DURATION: number = 30; // ms
    private static readonly HIT_STOP_COOLDOWN: number = 400; // ms
    // The wreck keeps blowing up, bigger each time, while the camera closes in
    private static readonly DEATH_EXPLOSIONS = [
        {delay: 200, size: 1.5},
        {delay: 500, size: 2.5},
        {delay: 850, size: 3.5},
    ];
    private static readonly DEATH_EXPLOSION_SPREAD: number = 60;
    private static readonly DEATH_ZOOM: number = 1.3;
    private static readonly DEATH_SEQUENCE_DURATION: number = 1800; // ms
    // Background and planet tints at the last difficulty keyframe: the arena reddens as the threat rises
    private static readonly MAX_THREAT_BACKGROUND_TINT: number = 0xff8a80;
    private static readonly MAX_THREAT_PLANET_TINT: number = 0xffb0a0;
    // Coop: ships stay this far inside the screen's edges, so they can't lose each other
    private static readonly LEASH_MARGIN: number = 160;
    private static readonly RESPAWN_DELAY: number = 10000; // ms

    private saveManager: SaveManager;
    private entityManager: EntityManager;
    private cheatManager: CheatManager;
    private _killStreak: number = 0;
    private _runTime: number = 0; // ms
    private _lastHitStopTime: number = -Infinity; // ms, real time
    private _hitStopEndTime: number = 0; // ms, real time
    private _background: Phaser.GameObjects.TileSprite;
    private _planet: Phaser.GameObjects.Image;
    private _difficulty: DifficultyCurve;
    private _team: Team;
    // Players 2 and up, kept across a restart. Player 1 reads every device the human ones don't own
    private _joinedDevices: InputDevice[];
    private _ownedDevices: InputDevice[];
    // The device player 1 used up to the last frame: pressing its confirm doesn't make a second player join
    private _soloDevice: InputDevice;
    private readonly cameraLookAhead: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    // The camera follows the middle of the ships still in the fight
    private readonly _cameraTarget: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _playersCenter: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _averageVelocity: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    constructor() {
        super(GameConstants.SceneKeys.MAIN_GAME);
    }

    // noinspection JSUnusedGlobalSymbols
    init(data: { joinedDevices?: InputDevice[] }) {
        this._joinedDevices = [...(data?.joinedDevices ?? [])];
        this._ownedDevices = this._joinedDevices.filter(device => device.type !== 'bot');
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        if (!this.saveManager) {
            console.error('SaveManager plugin not found');
        }
        this.saveManager?.load();

        // The world is bigger than the screen: the camera will move inside it
        this.cameras.main.setBounds(0, 0, GameConstants.ARENA_WIDTH, GameConstants.ARENA_HEIGHT);

        this._background = this.add.tileSprite(0, 0, GameConstants.ARENA_WIDTH, GameConstants.ARENA_HEIGHT, 'bg')
            .setOrigin(0).setTileScale(2);
        this._planet = this.add.image(GameConstants.ARENA_WIDTH / 2, GameConstants.ARENA_HEIGHT / 2, 'planet').setScale(2.5);
        this._difficulty = new DifficultyCurve(this.cache.json.get('difficulty') as DifficultyData,
            1 + this._joinedDevices.length);

        if (!this.entityManager) {
            console.error('EntityManager plugin not found');
        }

        // Keep the camera still during the player intro, then follow the player
        this.cameras.main.centerOn(GameConstants.ARENA_WIDTH / 2, GameConstants.ARENA_HEIGHT / 2);
        this._cameraTarget.set(GameConstants.ARENA_WIDTH / 2, GameConstants.ARENA_HEIGHT / 2);
        const team = new Team(this._difficulty.xpCurve);
        this._team = team;
        this.game.events.emit(GameConstants.Events.TEAM_CREATED_EVENT, team);
        const inputs = [this.gameInputManager.getInput({type: 'any', excluded: this._ownedDevices}),
            ...this._joinedDevices.map(device => this.createInput(device))];
        this._soloDevice = this.gameInputManager.lastUsedDevice;
        const players = this.entityManager.initAndSpawnPlayers(team, inputs, () => {
            this.cameras.main.startFollow(this._cameraTarget, true, 0.15, 0.15);
        });
        this.cheatManager.init({team, jumpThreatLevel: step => this.jumpThreatLevel(step)});
        players.forEach(player => this.initPlayer(player));

        // Freeze the game while the player picks an upgrade
        team.experience.on(Experience.LEVEL_UP_EVENT, (level: number) => {
            this.registry.set(RegistryConstants.Keys.PLAYER_LEVEL, level);
            this.scene.pause();
            this.scene.launch(GameConstants.SceneKeys.LEVEL_UP, {players, level});
        }, this);

        this.game.events.on(GameConstants.Events.ENEMY_KILLED_EVENT, this.onEnemyKilled, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.ENEMY_KILLED_EVENT, this.onEnemyKilled, this);
            this.game.events.off(Phaser.Core.Events.POST_STEP, this.updateHitStop, this);
        }, this);

        this.registry.set(RegistryConstants.Keys.PLAYER_SCORE, 0);
        this.registry.set(RegistryConstants.Keys.PLAYER_LEVEL, 1);
        this._runTime = 0;
        this.registry.set(RegistryConstants.Keys.RUN_TIME, 0);
        this.setKillStreak(0);

        console.log("MainGameScene created");
    }

    private initPlayer(player: Player) {
        player.getComponent(Health)?.on(Health.DEATH_EVENT, () => {
            // A teammate still fights: eject a pod until the ship respawns
            if (this._team.players.some(teammate => teammate !== player && teammate.isInFight)) {
                player.eject(MainGameScene.RESPAWN_DELAY);
                return;
            }

            // Every ship is down: let the explosions play before showing the game over screen
            player.disableBody(true, true);
            this._team.players.forEach(teammate => {
                if (teammate.isDown)
                    teammate.removePod();
            });
            this.playPlayerDeath(player.x, player.y);
            this.time.delayedCall(MainGameScene.DEATH_SEQUENCE_DURATION, this.endGame, [], this);
        }, this);

        // A hit on any player breaks the combo
        player.getComponent(Health)?.on(Health.CHANGE_EVENT, (current: number, previous: number) => {
            if (current >= previous)
                return;

            if (this._killStreak > 0)
                this.game.events.emit(GameConstants.Events.COMBO_BROKEN_EVENT);
            this.setKillStreak(0);
        }, this);
    }

    private playPlayerDeath(x: number, y: number) {
        const camera = this.cameras.main;
        camera.flash(200, 255, 255, 255);
        camera.shake(600, 0.025);
        camera.zoomTo(MainGameScene.DEATH_ZOOM, MainGameScene.DEATH_SEQUENCE_DURATION, 'Quad.easeOut');

        const spread: number = MainGameScene.DEATH_EXPLOSION_SPREAD;
        MainGameScene.DEATH_EXPLOSIONS.forEach(explosion => {
            this.time.delayedCall(explosion.delay, () => {
                Sfx.play(this, 'explosion', {volumeScale: explosion.size / 2, detune: -300});
                this.entityManager.spawnExplosion(x + Phaser.Math.Between(-spread, spread),
                    y + Phaser.Math.Between(-spread, spread), explosion.size);
                camera.shake(200, 0.01 * explosion.size, true);
            });
        });
    }

    private onEnemyKilled(enemy: Enemy) {
        // Only tougher enemies get the freeze, or a crowd of one-shot kills would stutter
        if ((enemy.getComponent(Health)?.max ?? 1) > 1)
            this.hitStop();

        this.registry.inc(RegistryConstants.Keys.PLAYER_SCORE,
            MainGameScene.KILL_SCORE * this.registry.get(RegistryConstants.Keys.PLAYER_COMBO));
        this.setKillStreak(this._killStreak + 1);
    }

    // Dev cheat: the run clock jumps to the next or previous threat level
    private jumpThreatLevel(step: number) {
        const level: number = Phaser.Math.Clamp(this._difficulty.threatLevelAt(this._runTime / 1000) + step,
            0, this._difficulty.maxThreatLevel);
        this._runTime = this._difficulty.threatLevelTime(level) * 1000;
        console.log("[Cheat] Threat level " + (level + 1) + ", run time " + this._runTime / 1000 + " s");
    }

    private updateThreatTint(runSeconds: number) {
        const progress: number = Math.round(this._difficulty.progressAt(runSeconds) * 100);
        this._background.setTint(MainGameScene.interpolateTint(MainGameScene.MAX_THREAT_BACKGROUND_TINT, progress));
        this._planet.setTint(MainGameScene.interpolateTint(MainGameScene.MAX_THREAT_PLANET_TINT, progress));
    }

    // From white (no tint) to the given tint, progress from 0 to 100
    private static interpolateTint(tint: number, progress: number): number {
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(tint), 100, progress);
        return Phaser.Display.Color.GetColor(color.r, color.g, color.b);
    }

    // Freezes the game for a few frames. The scene clock stops with it, so the game loop ends it, in real time
    private hitStop() {
        const now: number = performance.now();
        if (now - this._lastHitStopTime < MainGameScene.HIT_STOP_COOLDOWN)
            return;
        this._lastHitStopTime = now;
        this._hitStopEndTime = now + MainGameScene.HIT_STOP_DURATION;

        this.scene.pause();
        this.game.events.off(Phaser.Core.Events.POST_STEP, this.updateHitStop, this);
        this.game.events.on(Phaser.Core.Events.POST_STEP, this.updateHitStop, this);
    }

    // After the scene manager's update, so the pause, queued during this scene's update, is applied
    private updateHitStop() {
        if (performance.now() < this._hitStopEndTime)
            return;

        // A level-up or game over screen may have paused the game for longer meanwhile: it resumes it itself
        const isOtherPause: boolean = this.scene.isActive(GameConstants.SceneKeys.LEVEL_UP)
            || this.scene.isActive(GameConstants.SceneKeys.GAME_OVER)
            || this.scene.isActive(GameConstants.SceneKeys.PAUSE);
        // On a long frame the pause may not be applied yet
        if (!isOtherPause && !this.scene.isPaused())
            return;

        this.game.events.off(Phaser.Core.Events.POST_STEP, this.updateHitStop, this);
        if (!isOtherPause)
            this.scene.resume();
    }

    private setKillStreak(killStreak: number) {
        this._killStreak = killStreak;

        const combo: number = Math.min(1 + Math.floor(killStreak / GameConstants.COMBO_KILLS_PER_STEP), GameConstants.MAX_COMBO);
        const progress: number = combo === GameConstants.MAX_COMBO ? 1
            : (killStreak % GameConstants.COMBO_KILLS_PER_STEP) / GameConstants.COMBO_KILLS_PER_STEP;
        this.registry.set(RegistryConstants.Keys.PLAYER_COMBO_PROGRESS, progress);
        this.registry.set(RegistryConstants.Keys.PLAYER_COMBO, combo);
    }

    private endGame() {
        const bestScore: number = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        const currentScore: number = Number(this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0);
        const isNewBestScore: boolean = currentScore > bestScore;
        this.registry.set(RegistryConstants.Keys.IS_NEW_BEST_SCORE, isNewBestScore);
        if (isNewBestScore) {
            this.saveManager.setData(SaveConstants.Keys.PLAYER_BEST_SCORE, currentScore);
            this.saveManager.setData(SaveConstants.Keys.PLAYER_BEST_SCORE_PLAYERS, this._team.players.length);
            console.log("New Best Score: " + currentScore);
        }

        // The arena stays on screen, frozen, behind the game over screen
        this.scene.pause();
        this.scene.launch(GameConstants.SceneKeys.GAME_OVER);
    }

    // From Escape, P or a gamepad's Start
    private openPause() {
        if (this.scene.isActive(GameConstants.SceneKeys.PAUSE) || !this._team?.players.some(player => player.active))
            return;
        this.scene.pause();
        this.scene.launch(GameConstants.SceneKeys.PAUSE);
    }

    update(_timeSinceLaunch: number, deltaTime: number) {
        if (this.gameInputManager.pauseJustPressed()) {
            this.openPause();
            return;
        }

        if (this.gameInputManager.restartJustPressed()) {
            this.scene.restart({joinedDevices: this._joinedDevices});
        }

        // update() doesn't run while the scene is paused, so level-up screens don't count
        this._runTime += deltaTime;
        const runSeconds: number = Math.floor(this._runTime / 1000);
        if (runSeconds !== this.registry.get(RegistryConstants.Keys.RUN_TIME)) {
            this.registry.set(RegistryConstants.Keys.RUN_TIME, runSeconds);
            this.updateThreatTint(runSeconds);
        }

        this.updateJoining();
        this.updateLeashes();
        this.updateCamera(deltaTime);
    }

    private createInput(device: InputDevice): PlayerInput {
        return device.type === 'bot' ? new BotInput(this._team, this.entityManager) : this.gameInputManager.getInput(device);
    }

    // A second player joins anytime with the confirm of a device player 1 isn't using, or B adds a bot
    private updateJoining() {
        if (this._team.players.length >= GameConstants.MAX_PLAYERS)
            return;

        const inputManager = this.gameInputManager;
        let device: InputDevice | null = null;
        if (inputManager.botJustPressed()) {
            device = {type: 'bot'};
        } else {
            const confirming: InputDevice | null = inputManager.findConfirmingDevice();
            if (confirming && !isSameDevice(confirming, this._soloDevice))
                device = confirming;
        }
        this._soloDevice = inputManager.lastUsedDevice;
        if (device)
            this.joinPlayer(device);
    }

    private joinPlayer(device: InputDevice) {
        this._joinedDevices.push(device);
        if (device.type !== 'bot')
            this._ownedDevices.push(device);

        const player = this.entityManager.joinPlayer(this.createInput(device));
        this.initPlayer(player);
        this._difficulty.setPlayerCount(this._team.players.length);
        this._team.experience.setCurve(this._difficulty.xpCurve);
        Sfx.play(this, 'launch');
        this.game.events.emit(GameConstants.Events.PLAYER_JOINED_EVENT, this._team.players.length, device.type === 'bot');
    }

    private updateCamera(deltaTime: number) {
        this._playersCenter.reset();
        this._averageVelocity.reset();
        let count: number = 0;
        for (const player of this._team.players) {
            if (!player.active)
                continue;
            count++;
            this._playersCenter.add(player);
            const velocity = player.getComponent(Movement)?.velocity;
            if (velocity)
                this._averageVelocity.add(velocity);
        }
        // The last ship destroyed: the camera stays on its wreck
        if (count === 0)
            return;
        this._cameraTarget.copy(this._playersCenter.scale(1 / count));
        this._averageVelocity.scale(1 / count);

        // Look ahead in the move direction: the follow offset is subtracted from the target position
        const lookAheadTime = 250;
        const smoothing = 1 - Math.exp(-deltaTime / 200);
        this.cameraLookAhead.x += (-this._averageVelocity.x * lookAheadTime - this.cameraLookAhead.x) * smoothing;
        this.cameraLookAhead.y += (-this._averageVelocity.y * lookAheadTime - this.cameraLookAhead.y) * smoothing;
        this.cameras.main.setFollowOffset(this.cameraLookAhead.x, this.cameraLookAhead.y);
    }

    // Two ships can't be farther apart than the screen, minus a margin: the one moving away stops
    private updateLeashes() {
        const camera = this.cameras.main;
        const maxSpreadX: number = camera.width / camera.zoom - 2 * MainGameScene.LEASH_MARGIN;
        const maxSpreadY: number = camera.height / camera.zoom - 2 * MainGameScene.LEASH_MARGIN;
        const players = this._team.players;
        for (const player of players) {
            if (!player.active)
                continue;
            let minX: number = Infinity, maxX: number = -Infinity, minY: number = Infinity, maxY: number = -Infinity;
            for (const teammate of players) {
                if (teammate === player || !teammate.active)
                    continue;
                minX = Math.min(minX, teammate.x);
                maxX = Math.max(maxX, teammate.x);
                minY = Math.min(minY, teammate.y);
                maxY = Math.max(maxY, teammate.y);
            }
            if (minX === Infinity)
                player.clearLeash();
            else
                player.setLeash(maxX - maxSpreadX, maxY - maxSpreadY, minX + maxSpreadX, minY + maxSpreadY);
        }
    }
}
