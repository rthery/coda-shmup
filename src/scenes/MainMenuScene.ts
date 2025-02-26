import {SceneNames} from "./SceneNames.ts";

export class MainMenuScene extends Phaser.Scene {
    private bg: Phaser.GameObjects.TileSprite;
    private playerShip: Phaser.GameObjects.Sprite;

    constructor() {
        super(SceneNames.MAIN_MENU_SCENE);
    }

    preload() {
        this.load.setPath('assets');

        this.load.image('bg', 'Backgrounds/darkPurple.png');
        this.load.atlas('sprites', 'Spritesheet/gameSprites.png', 'Spritesheet/gameSprites.json');

        this.load.font('future', 'Fonts/kenvector_future.ttf');
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this.bg = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'bg').setOrigin(0).setTileScale(2);

        const playerShipOffsetX = 64;
        this.playerShip = this.add.sprite(this.cameras.main.centerX - playerShipOffsetX, this.cameras.main.centerY, 'sprites', 'playerShip1_blue.png');
        this.playerShip.setAngle(-90);

        if (!this.anims.exists('playerShipIdle')) {
            this.anims.create({
                key: 'playerShipIdle',
                frames: [
                    {key: 'sprites', frame: 'playerShip1_blue-idle0.png'},
                    {key: 'sprites', frame: 'playerShip1_blue-idle1.png'},
                ],
                frameRate: 30,
                repeat: -1
            });
        }
        this.playerShip.play('playerShipIdle');

        this.tweens.add({
            targets: this.playerShip,
            x: this.cameras.main.centerX + playerShipOffsetX,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Quad.easeInOut'
        });

        this.add.text(this.cameras.main.centerX, 256, 'CODA SHUMP', {
            fontSize: '32px', color: '#fff', fontFamily: 'future'
        }).setOrigin(0.5).setScale(2);
        this.add.text(this.cameras.main.centerX, this.cameras.main.height - 256, 'Press SPACE to start', {
            fontSize: '32px',
            color: '#fff'
        }).setOrigin(0.5);

        this.input.keyboard?.once('keydown-SPACE', () => {
            this.scene.start(SceneNames.MAIN_GAME_SCENE);
        });
    }

    update(_timeSinceLaunch: number, deltaTime: number) {
        this.bg.tilePositionY -= 0.1 * deltaTime;
    }
}