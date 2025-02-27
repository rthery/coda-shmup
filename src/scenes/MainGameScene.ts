import {Scene, GameObjects} from 'phaser';
import {GameDataKeys} from "../GameDataKeys.ts";
import {SceneNames} from "./SceneNames.ts";
import {Health} from "../components/Health.ts";
import {EntityManager} from "./plugins/EntityManager.ts";

export class MainGameScene extends Scene {
    protected entities;

    private bg: GameObjects.TileSprite;
    private planet: GameObjects.Image;
    private scoreText: GameObjects.Text;

    constructor() {
        super(SceneNames.MAIN_GAME_SCENE);

        this.entities = new EntityManager(this);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const bgMargin = 512;
        this.bg = this.add.tileSprite(this.cameras.main.centerX, this.cameras.main.centerY, this.cameras.main.width + bgMargin, this.cameras.main.height + bgMargin, 'bg').setTileScale(2);
        this.planet = this.add.image(0, -512, 'planet').setOrigin(0);

        this.entities.addPlayer();
        this.entities.player.getComponent(Health)?.once('death', this.endGame, this);
        this.entities.player.setPosition(this.cameras.main.centerX, this.cameras.main.height + this.entities.player.height);
        this.tweens.add({
            targets: this.entities.player,
            y: this.cameras.main.height - 128,
            duration: 500,
            ease: Phaser.Math.Easing.Quadratic.Out,
            onComplete: () => {
                this.entities.addEnemies();
                this.entities.addGroupCollisions();
            }
        });

        if (this.input.keyboard) {
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.scene.restart());
        } else {
            console.error('No keyboard input');
        }

        this.addHUD();

        // Set and track player score
        this.registry.set<number>(GameDataKeys.PLAYER_SCORE, 0);
        this.registry.events.on('changedata-' + GameDataKeys.PLAYER_SCORE, (_: any, value: number) => {
            this.scoreText.setText(value.toString());
            console.log("Score: " + value);
        });
    }

    private addHUD() {
        this.add.nineslice(this.cameras.main.width, 0, 'panel_glass_notch_bl', undefined, 256, 64, 16, 16, 16, 16).setOrigin(1, 0).setDepth(500);
        this.add.rectangle(this.cameras.main.width - 12, 12, 256 - 24, 64 - 24, 0x000000, 0.15).setOrigin(1, 0).setDepth(501);
        this.scoreText = this.add.text(this.cameras.main.width - 24, 16, "0", {
            fontSize: '32px',
            align: 'right',
            color: '#222',
            fontStyle: 'bold'
        }).setOrigin(1, 0).setDepth(502);
    }

    private endGame() {
        console.log("Game over");

        this.scene.start(SceneNames.GAME_OVER_SCENE);
    }

    update(_timeSinceLaunch: number, deltaTime: number) {
        this.bg.tilePositionY -= 0.1 * deltaTime;
        this.planet.y += 0.40 * deltaTime;
    }
}
