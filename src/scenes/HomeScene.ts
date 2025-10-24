import {Loader} from "phaser";
import GameConstants from "../GameConstants.ts";

export default class HomeScene extends Phaser.Scene {
    private _bg: Phaser.GameObjects.TileSprite;
    private _playerShip: Phaser.GameObjects.Image;

    constructor() {
        super(GameConstants.SceneKeys.HOME);
    }

    preload() {
        const width: number = this.scale.width;
        const y: number = this.scale.height / 2;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(0, y, width, 64);
        this.load.on(Loader.Events.PROGRESS, function (value: number) { // 0-1
            console.log("Loading : " + value);

            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(0, y, width * value, 64);
        });
        this.load.on(Loader.Events.COMPLETE, function () {
            console.log("Loading complete");

            progressBar.destroy();
            progressBox.destroy();
        });

        this.load.setPath('assets');

        this.load.image('bg', 'Backgrounds/darkPurple.png');
        this.load.image('planet', 'Planets/planet00.png');
        this.load.atlas('sprites', 'Spritesheet/gameSprites.png', 'Spritesheet/gameSprites.json');
        this.load.atlas('shapes', 'FX/shapes.png', 'FX/shapes.json');
        this.load.bitmapFont('future-bmp', 'Fonts/kenvector_future.png', 'Fonts/kenvector_future.xml');
        this.load.font('future', 'Fonts/kenvector_future.ttf');
        this.load.json('playerShips', 'Data/playerShips.json');
        this.load.audio('sfx_laser1', 'Sounds/sfx_laser1.ogg');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');
    }

    create() {
        this._bg = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'bg')
            .setOrigin(0).setTileScale(2);

        const playerShipOffsetX: number = 96;
        this._playerShip = this.add.image(this.scale.width / 2 - playerShipOffsetX, this.scale.height / 2, 'sprites',
            'playerShip1_blue.png').setAngle(-90);

        this.tweens.add({
            targets: this._playerShip,
            x: this.cameras.main.centerX + playerShipOffsetX,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Quad.easeInOut'
        });

        this.add.text(this.scale.width / 2, 512, 'CODA SHMUP',
            {fontSize: '72px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);
        this.add.text(this.scale.width / 2, this.scale.height - 256, 'Press SPACE to start',
            {fontSize: '32px', color: '#fff'}).setOrigin(0.5);

        this.input.keyboard?.once('keydown-SPACE', () => {
            this.tweens.killTweensOf(this._playerShip);
            this.tweens.add({
                targets: this._playerShip,
                x: this.cameras.main.centerX,
                y: -this._playerShip.height,
                duration: 600,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    this.scene.launch(GameConstants.SceneKeys.MAIN_UI);
                    this.scene.start(GameConstants.SceneKeys.MAIN_GAME);
                }
            })
        });

        console.log("HomeScene created");
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);

        this._bg.tilePositionY -= 0.1 * deltaTime;
    }
}