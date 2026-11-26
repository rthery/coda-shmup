import {Loader} from "phaser";
import GameConstants from "../GameConstants.ts";
import Thrusters from "../components/Thrusters.ts";
import WingTrails from "../components/WingTrails.ts";
import Turret from "../components/Turret.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import UiUtils from "../utils/UiUtils.ts";

export default class HomeScene extends Phaser.Scene {
    private static readonly BG_TILE_SCALE: number = 2;
    private static readonly BG_SCROLL_SPEED: number = 0.1; // texture px/ms

    private _bg: Phaser.GameObjects.TileSprite;
    private _playerShip: Phaser.GameObjects.Image;
    private _thrusters: Thrusters;
    private _wingTrails: WingTrails;
    private _turret: Turret;
    private _title: Phaser.GameObjects.Container;
    private _startPrompt: Phaser.GameObjects.Text;
    private _started: boolean = false;

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
        this.load.on(Loader.Events.PROGRESS, function (value: number) {
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
        this.load.json('upgrades', 'Data/upgrades.json');
        this.load.json('difficulty', 'Data/difficulty.json');
        this.load.audio('sfx_laser1', 'Sounds/sfx_laser1.ogg');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');
    }

    create() {
        console.log(this.sys.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas');

        this._started = false;

        this._bg = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'bg')
            .setOrigin(0).setTileScale(HomeScene.BG_TILE_SCALE);

        const playerShipData = (this.cache.json.get('playerShips') as PlayerShipsData)[1];
        const playerShipOffsetX: number = 96;
        this._playerShip = this.add.image(this.scale.width / 2 - playerShipOffsetX, this.scale.height / 2, 'sprites',
            playerShipData.texture).setAngle(-90).setDepth(10);

        this._thrusters = new Thrusters(this._playerShip);
        this._thrusters.setThrusters(playerShipData.thrusters);
        // The streaks drift down with the background, in px/s
        const bgScreenSpeed: number = HomeScene.BG_SCROLL_SPEED * HomeScene.BG_TILE_SCALE * 1000;
        this._wingTrails = new WingTrails(this._playerShip, bgScreenSpeed);
        this._wingTrails.setWingTips(playerShipData.wingTips);
        this._turret = new Turret(this._playerShip);
        this._turret.setTurret(playerShipData.turret);

        this.tweens.add({
            targets: this._playerShip,
            x: this.cameras.main.centerX + playerShipOffsetX,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Quad.easeInOut'
        });

        const centerX: number = this.scale.width / 2;
        const titleY: number = 560;
        this._title = this.add.container(0, 0, [
            this.add.text(centerX, titleY - 96, 'SURVIVAL',
                {fontSize: '36px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future', letterSpacing: 12})
                .setOrigin(0.5),
            this.add.text(centerX, titleY, 'CODA ARENA', {fontSize: '120px', color: '#fff', fontFamily: 'future'})
                .setOrigin(0.5).setShadow(0, 8, '#000', 0, false, true),
        ]);

        this._startPrompt = UiUtils.addHint(this, centerX, this.scale.height - 220,
            this._getPromptText(this.gameInputManager.activeInputType));

        this.game.events.on('input-type-changed', this._onInputTypeChanged, this);
        this.events.once('shutdown', () => {
            this.game.events.off('input-type-changed', this._onInputTypeChanged, this);
        });

        console.log("HomeScene created");
    }

    private _onInputTypeChanged(type: InputType): void {
        if (!this._started) {
            this._startPrompt.setText(this._getPromptText(type));
        }
    }

    private _getPromptText(type: InputType): string {
        switch (type) {
            case 'touch': return 'TAP TO START';
            case 'gamepad': return 'PRESS A OR START';
            default: return 'PRESS SPACE TO START';
        }
    }

    private _startGame(): void {
        this._started = true;

        this.tweens.killTweensOf([this._playerShip, this._startPrompt]);
        this._thrusters.setBoost(true);
        // The title clears the ship's way out
        this.tweens.add({targets: this._title, y: -200, alpha: 0, duration: 400, ease: 'Quad.easeIn'});
        this.tweens.add({targets: this._startPrompt, alpha: 0, duration: 200});
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
        });
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);
        this._bg.tilePositionY -= HomeScene.BG_SCROLL_SPEED * deltaTime;
        // Cruising forward, as the background scrolls
        this._thrusters.update(true, 1, deltaTime);
        this._wingTrails.update(true);
        this._turret.update(deltaTime);

        if (!this._started && this.gameInputManager.confirmJustPressed()) {
            this._startGame();
        }
    }
}
