import {Scene} from 'phaser';
import Health from "../components/Health.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveManager from "../managers/SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import EntityManager from "../managers/EntityManager.ts";
import GameConstants from "../GameConstants.ts";
import Experience from "../components/Experience.ts";
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

    private saveManager: SaveManager;
    private entityManager: EntityManager;
    private _killStreak: number = 0;
    private _runTime: number = 0; // ms
    private _lastHitStopTime: number = -Infinity; // ms, real time
    private _hitStopEndTime: number = 0; // ms, real time
    private _background: Phaser.GameObjects.TileSprite;
    private _planet: Phaser.GameObjects.Image;
    private _difficulty: DifficultyCurve;
    private player: Player;
    private readonly cameraLookAhead: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    constructor() {
        super(GameConstants.SceneKeys.MAIN_GAME);
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
        this._difficulty = new DifficultyCurve(this.cache.json.get('difficulty') as DifficultyData);

        // Dev cheats: + (or =) and - jump the run clock to the next or previous threat level.
        // Matched on the typed character, key codes differ between keyboard layouts (AZERTY on a Mac)
        if (import.meta.env.DEV && this.input.keyboard) {
            this.input.keyboard.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, (event: KeyboardEvent) => {
                if (event.key === '+' || event.key === '=')
                    this.jumpThreatLevel(1);
                else if (event.key === '-')
                    this.jumpThreatLevel(-1);
            });
        }

        if (!this.entityManager) {
            console.error('EntityManager plugin not found');
        }

        // Keep the camera still during the player intro, then follow the player
        this.cameras.main.centerOn(GameConstants.ARENA_WIDTH / 2, GameConstants.ARENA_HEIGHT / 2);
        const player = this.entityManager.initAndSpawnPlayer(() => {
            this.cameras.main.startFollow(player, true, 0.15, 0.15);
        });
        this.player = player;
        player.getComponent(Health)?.once(Health.DEATH_EVENT, () => {
            // Hide the player and let its explosions play before showing the game over screen
            player.disableBody(true, true);
            this.playPlayerDeath(player.x, player.y);
            this.time.delayedCall(MainGameScene.DEATH_SEQUENCE_DURATION, this.endGame, [], this);
        }, this);

        // Freeze the game while the player picks an upgrade
        player.getComponent(Experience)?.on(Experience.LEVEL_UP_EVENT, (level: number) => {
            this.registry.set(RegistryConstants.Keys.PLAYER_LEVEL, level);
            this.scene.pause();
            this.scene.launch(GameConstants.SceneKeys.LEVEL_UP, {player});
        }, this);

        // A hit breaks the combo
        player.getComponent(Health)?.on(Health.CHANGE_EVENT, (current: number, previous: number) => {
            if (current >= previous)
                return;

            if (this._killStreak > 0)
                this.game.events.emit(GameConstants.Events.COMBO_BROKEN_EVENT);
            this.setKillStreak(0);
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
            console.log("New Best Score: " + currentScore);
        }

        // The arena stays on screen, frozen, behind the game over screen
        this.scene.pause();
        this.scene.launch(GameConstants.SceneKeys.GAME_OVER);
    }

    // From Escape, P or a gamepad's Start
    private openPause() {
        if (this.scene.isActive(GameConstants.SceneKeys.PAUSE) || !this.player?.active)
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
            this.scene.restart();
        }

        // update() doesn't run while the scene is paused, so level-up screens don't count
        this._runTime += deltaTime;
        const runSeconds: number = Math.floor(this._runTime / 1000);
        if (runSeconds !== this.registry.get(RegistryConstants.Keys.RUN_TIME)) {
            this.registry.set(RegistryConstants.Keys.RUN_TIME, runSeconds);
            this.updateThreatTint(runSeconds);
        }

        // Look ahead in the move direction: the follow offset is subtracted from the target position
        const velocity = this.player.getComponent(Movement)?.velocity;
        if (velocity) {
            const lookAheadTime = 250;
            const smoothing = 1 - Math.exp(-deltaTime / 200);
            this.cameraLookAhead.x += (-velocity.x * lookAheadTime - this.cameraLookAhead.x) * smoothing;
            this.cameraLookAhead.y += (-velocity.y * lookAheadTime - this.cameraLookAhead.y) * smoothing;
            this.cameras.main.setFollowOffset(this.cameraLookAhead.x, this.cameraLookAhead.y);
        }
    }
}
