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
    preload() {
        const width: number = this.cameras.main.width;
        const y: number = this.cameras.main.centerY;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(0, y, width, 64);
        this.load.on('progress', function (value: number) { // 0-1
            console.log(value);
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(0, y, width * value, 64);
        });
        this.load.on('complete', function () {
            console.log('complete');
            progressBar.destroy();
            progressBox.destroy();
        });

        this.load.setPath('assets');

        this.load.image('bg', 'Backgrounds/darkPurple.png');
        this.load.image('planet', 'Planets/planet00.png');
        this.load.atlas('sprites', 'Spritesheet/gameSprites.png', 'Spritesheet/gameSprites.json');
        this.load.image('panel_glass_notch_bl', 'UI/panel_glass_notch_bl.png');

        this.load.audio('sfx_laser1', 'Sounds/sfx_laser1.ogg');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');

        this.load.json('playerShips', 'Data/playerShips.json');
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this.bg = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'bg').setOrigin(0).setTileScale(2);
        this.planet = this.add.image(0, -512, 'planet').setOrigin(0);

        this.entities.addPlayer();
        this.entities.player.getComponent(Health)?.once('death', this.endGame, this);

        this.entities.addEnemies();
        this.entities.addGroupCollisions();

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
