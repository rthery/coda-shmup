import {SceneNames} from "./SceneNames.ts";

export class MainMenuScene extends Phaser.Scene {
    private bg: Phaser.GameObjects.TileSprite;
    private playerShip: Phaser.GameObjects.Image;

    constructor() {
        super(SceneNames.MAIN_MENU_SCENE);
    }

    preload() {
        this.load.setPath('assets');

        this.load.image('bg', 'Backgrounds/darkPurple.png');
        this.load.atlas('sprites', 'Spritesheet/gameSprites.png', 'Spritesheet/gameSprites.json');

        this.load.font('future', 'Fonts/kenvector_future.ttf');
    }

    create() {
        this.bg = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'bg').setOrigin(0).setTileScale(2);

        const playerShipOffsetX = 64;
        this.playerShip = this.add.image(this.cameras.main.centerX - playerShipOffsetX, this.cameras.main.centerY, 'sprites', 'playerShip1_blue.png');
        this.playerShip.setAngle(-90);

        this.tweens.add({
            targets: this.playerShip,
            x: this.cameras.main.centerX + playerShipOffsetX,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Quad.easeInOut'
        });

        this.add.text(this.cameras.main.centerX, 256, 'Main Menu', {
            fontSize: '32px', color: '#fff', fontFamily: 'future'
        }).setOrigin(0.5).setScale(2);
        this.add.text(this.cameras.main.centerX, this.cameras.main.height - 256, 'Press SPACE to start', {fontSize: '16px', color: '#fff'}).setOrigin(0.5).setScale(2);

        this.input.keyboard?.once('keydown-SPACE', () => {
            this.scene.start(SceneNames.MAIN_GAME_SCENE);
        });
    }

    update(_timeSinceLaunch: number, deltaTime: number) {
        this.bg.tilePositionY -= 0.1 * deltaTime;
    }
}