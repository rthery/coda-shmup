import {Scene} from 'phaser';
import Health from "../components/Health.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveManager from "../managers/SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";
import EntityManager from "../managers/EntityManager.ts";
import GameConstants from "../GameConstants.ts";

export default class MainGameScene extends Scene {
    private saveManager: SaveManager;
    private entityManager: EntityManager;

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
            this.cameras.main.startFollow(player, true, 0.1, 0.1);
        });
        player.getComponent(Health)?.once(Health.DEATH_EVENT, () => {
            // Hide the player and let its explosion play before showing the game over screen
            player.disableBody(true, true);
            this.time.delayedCall(1000, this.endGame, [], this);
        }, this);

        if (this.input.keyboard) {
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.scene.restart());
        } else {
            console.error('No keyboard input');
        }

        this.registry.set(RegistryConstants.Keys.PLAYER_SCORE, 0);

        console.log("MainGameScene created");
    }

    private endGame() {
        const bestScore: number = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        const currentScore: number = Number(this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0);
        if (currentScore > bestScore) {
            this.saveManager.setData(SaveConstants.Keys.PLAYER_BEST_SCORE, currentScore);
            console.log("New Best Score: " + currentScore);
        }

        this.scene.start(GameConstants.SceneKeys.GAME_OVER);
    }
}
