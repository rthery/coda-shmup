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

export default class MainGameScene extends Scene {
    private static readonly KILL_SCORE: number = 10;
    private static readonly KILLS_PER_COMBO_STEP: number = 10;
    private static readonly MAX_COMBO: number = 5;

    private saveManager: SaveManager;
    private entityManager: EntityManager;
    private _killStreak: number = 0;
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

        this.add.tileSprite(0, 0, GameConstants.ARENA_WIDTH, GameConstants.ARENA_HEIGHT, 'bg')
            .setOrigin(0).setTileScale(2);
        this.add.image(GameConstants.ARENA_WIDTH / 2, GameConstants.ARENA_HEIGHT / 2, 'planet').setScale(7.5);

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
            // Hide the player and let its explosion play before showing the game over screen
            player.disableBody(true, true);
            this.time.delayedCall(1000, this.endGame, [], this);
        }, this);

        // Freeze the game while the player picks an upgrade
        player.getComponent(Experience)?.on(Experience.LEVEL_UP_EVENT, (level: number) => {
            this.registry.set(RegistryConstants.Keys.PLAYER_LEVEL, level);
            this.scene.pause();
            this.scene.launch(GameConstants.SceneKeys.LEVEL_UP, {player});
        }, this);

        // A hit breaks the combo
        player.getComponent(Health)?.on(Health.CHANGE_EVENT, (current: number, previous: number) => {
            if (current < previous)
                this.setKillStreak(0);
        }, this);

        this.game.events.on(GameConstants.Events.ENEMY_KILLED_EVENT, this.onEnemyKilled, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.ENEMY_KILLED_EVENT, this.onEnemyKilled, this);
        }, this);

        this.registry.set(RegistryConstants.Keys.PLAYER_SCORE, 0);
        this.registry.set(RegistryConstants.Keys.PLAYER_LEVEL, 1);
        this.setKillStreak(0);

        console.log("MainGameScene created");
    }

    private onEnemyKilled() {
        this.registry.inc(RegistryConstants.Keys.PLAYER_SCORE,
            MainGameScene.KILL_SCORE * this.registry.get(RegistryConstants.Keys.PLAYER_COMBO));
        this.setKillStreak(this._killStreak + 1);
    }

    private setKillStreak(killStreak: number) {
        this._killStreak = killStreak;

        const combo: number = Math.min(1 + Math.floor(killStreak / MainGameScene.KILLS_PER_COMBO_STEP), MainGameScene.MAX_COMBO);
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

    update(_timeSinceLaunch: number, deltaTime: number) {
        if (this.gameInputManager.restartJustPressed()) {
            this.scene.restart();
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
