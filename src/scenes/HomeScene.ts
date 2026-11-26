import {Loader} from "phaser";
import GameConstants from "../GameConstants.ts";
import Thrusters from "../components/Thrusters.ts";
import WingTrails from "../components/WingTrails.ts";
import Turret from "../components/Turret.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import UiUtils from "../utils/UiUtils.ts";
import UiLayout from "../utils/UiLayout.ts";
import Sfx from "../audio/Sfx.ts";
import type SaveManager from "../managers/SaveManager.ts";

export default class HomeScene extends Phaser.Scene {
    private static readonly BG_TILE_SCALE: number = 2;
    private static readonly LOADING_BACKGROUND: number = 0x3a2e3f;
    private static readonly LOADING_FILL: number = 0xf5c542;
    private static readonly LOADING_BAR_WIDTH: number = 640;
    private static readonly LOADING_BAR_HEIGHT: number = 24;
    private static readonly LOADING_BAR_OFFSET_Y: number = 200;
    private static readonly BG_SCROLL_SPEED: number = 0.1; // texture px/ms

    private _bg: Phaser.GameObjects.TileSprite;
    private _playerShip: Phaser.GameObjects.Image;
    private _thrusters: Thrusters;
    private _wingTrails: WingTrails;
    private _turret: Turret;
    private _title: Phaser.GameObjects.Container;
    // The title and the prompt, on the portrait frame
    private _frame: Phaser.GameObjects.Container;
    private _startPrompt: Phaser.GameObjects.Text;
    private _started: boolean = false;
    private saveManager: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.HOME);
    }

    preload() {
        this.createLoadingBar();

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
        this.load.json('pickups', 'Data/pickups.json');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');
        Sfx.preload(this.load);
    }

    // Drawn with shapes: nothing is loaded yet, neither the game's font nor its sprites.
    // In the XP bar's colors, on the game's background
    private createLoadingBar() {
        const centerX: number = UiLayout.WIDTH / 2;
        const y: number = UiLayout.HEIGHT / 2 + HomeScene.LOADING_BAR_OFFSET_Y;
        const width: number = HomeScene.LOADING_BAR_WIDTH;
        const height: number = HomeScene.LOADING_BAR_HEIGHT;
        const left: number = centerX - width / 2;

        // Only shown while loading: sized once, without following resizes
        UiLayout.fitCamera(this, true);
        const area = UiLayout.visibleArea(this);
        const background = this.add.rectangle(area.x, area.y, area.width, area.height, HomeScene.LOADING_BACKGROUND)
            .setOrigin(0);
        const label = this.add.text(centerX, y - 48, 'LOADING',
            {fontSize: '28px', color: '#8a92a3', fontFamily: 'sans-serif', fontStyle: 'bold', letterSpacing: 12})
            .setOrigin(0.5);
        const track = this.add.graphics()
            .fillStyle(0x000000, 0.35).fillRoundedRect(left, y, width, height, height / 2)
            .lineStyle(2, 0xffffff, 0.2).strokeRoundedRect(left, y, width, height, height / 2);
        const fill = this.add.graphics();

        this.load.on(Loader.Events.PROGRESS, (value: number) => {
            // Never thinner than its rounded ends
            const fillWidth: number = Math.max(height, width * value);
            fill.clear().fillStyle(HomeScene.LOADING_FILL, 1).fillRoundedRect(left, y, fillWidth, height, height / 2);
        });
        this.load.once(Loader.Events.COMPLETE, () => {
            [background, label, track, fill].forEach(gameObject => gameObject.destroy());
        });
    }

    create() {
        // Plays across scenes, from the first input on (browsers block sound until then)
        // The game also loads it when a run starts: here it's for the sound settings, read before any run
        this.saveManager.load();
        Sfx.loadSettings(this.saveManager);
        Sfx.startMusic(this);
        console.log(this.sys.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas');

        this._started = false;

        this._bg = this.add.tileSprite(0, 0, 1, 1, 'bg').setOrigin(0).setTileScale(HomeScene.BG_TILE_SCALE);

        const playerShipData = (this.cache.json.get('playerShips') as PlayerShipsData)[1];
        const playerShipOffsetX: number = 96;
        this._playerShip = this.add.image(UiLayout.WIDTH / 2 - playerShipOffsetX, UiLayout.HEIGHT / 2, 'sprites',
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
            x: UiLayout.WIDTH / 2 + playerShipOffsetX,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Quad.easeInOut'
        });

        const centerX: number = UiLayout.WIDTH / 2;
        const titleY: number = 560;
        this._title = this.add.container(0, 0, [
            this.add.text(centerX, titleY, 'FINAL ORBIT', {fontSize: '120px', color: '#fff', fontFamily: 'future'})
                .setOrigin(0.5).setShadow(0, 8, '#000', 0, false, true),
        ]);

        this._startPrompt = UiUtils.addHint(this, centerX, UiLayout.HEIGHT - 220,
            this._getPromptText(this.gameInputManager.activeInputType));
        this._frame = this.add.container(0, 0, [this._title, this._startPrompt]);
        UiLayout.onResize(this, () => this.layout());

        this.game.events.on('input-type-changed', this._onInputTypeChanged, this);
        this.events.once('shutdown', () => {
            this.game.events.off('input-type-changed', this._onInputTypeChanged, this);
        });

        console.log("HomeScene created");
    }

    // The ship and the stars at the game's scale, as in a run. Only the title and the prompt fit the frame
    private layout() {
        const camera = this.cameras.main;
        camera.setOrigin(0.5).setZoom(1).centerOn(UiLayout.WIDTH / 2, UiLayout.HEIGHT / 2);
        this._bg.setPosition(camera.scrollX, camera.scrollY).setSize(this.scale.width, this.scale.height);

        const zoom: number = UiLayout.frameZoom(this);
        this._frame.setScale(zoom).setPosition(UiLayout.WIDTH / 2 * (1 - zoom), UiLayout.HEIGHT / 2 * (1 - zoom));
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
        Sfx.play(this, 'start');
        Sfx.play(this, 'launch');

        this.tweens.killTweensOf([this._playerShip, this._startPrompt]);
        this._thrusters.setBoost(true);
        // The title clears the ship's way out
        this.tweens.add({targets: this._title, y: -200, alpha: 0, duration: 400, ease: 'Quad.easeIn'});
        this.tweens.add({targets: this._startPrompt, alpha: 0, duration: 200});
        this.tweens.add({
            targets: this._playerShip,
            x: UiLayout.WIDTH / 2,
            y: this.cameras.main.scrollY - this._playerShip.height,
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
