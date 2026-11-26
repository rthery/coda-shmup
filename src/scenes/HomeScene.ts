import {Loader} from "phaser";
import GameConstants from "../GameConstants.ts";
import Thrusters from "../components/Thrusters.ts";
import WingTrails from "../components/WingTrails.ts";
import Turret from "../components/Turret.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import UiUtils, {type HintPart} from "../utils/UiUtils.ts";
import UiLayout from "../utils/UiLayout.ts";
import Sfx from "../audio/Sfx.ts";
import type SaveManager from "../managers/SaveManager.ts";
import type {InputDevice} from "../managers/PlayerInput.ts";

// A ship on the home screen, cruising forward
type HomeShip = {
    image: Phaser.GameObjects.Image;
    thrusters: Thrusters;
    wingTrails: WingTrails;
    turret: Turret;
}

export default class HomeScene extends Phaser.Scene {
    private static readonly BG_TILE_SCALE: number = 2;
    private static readonly LOADING_BACKGROUND: number = 0x3a2e3f;
    private static readonly LOADING_FILL: number = 0xf5c542;
    private static readonly LOADING_BAR_WIDTH: number = 640;
    private static readonly LOADING_BAR_HEIGHT: number = 24;
    private static readonly LOADING_BAR_OFFSET_Y: number = 200;
    private static readonly BG_SCROLL_SPEED: number = 0.1; // texture px/ms
    private static readonly SHIP_SWAY_X: number = 96;
    // Player 2's ship, joined: the two ships side by side
    private static readonly SHIP_SPACING_X: number = 140;
    private static readonly SHIP_LABEL_OFFSET_Y: number = 90;

    private _bg: Phaser.GameObjects.TileSprite;
    private _ships: HomeShip[];
    // Player 2, joined before the run starts: its device, or a bot
    private _joinedDevice: InputDevice | null;
    private _shipLabels: Phaser.GameObjects.Text[];
    private _title: Phaser.GameObjects.Container;
    // The title and the prompt, on the portrait frame
    private _frame: Phaser.GameObjects.Container;
    private _startPrompt: Phaser.GameObjects.Container;
    private _joinPrompt: Phaser.GameObjects.Container;
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
        this._ships = [];
        this._joinedDevice = null;
        this._shipLabels = [];

        this._bg = this.add.tileSprite(0, 0, 1, 1, 'bg').setOrigin(0).setTileScale(HomeScene.BG_TILE_SCALE);

        const playerShip: HomeShip = this.createShip(1, UiLayout.WIDTH / 2 - HomeScene.SHIP_SWAY_X, UiLayout.HEIGHT / 2);
        this.tweens.add({
            targets: playerShip.image,
            x: UiLayout.WIDTH / 2 + HomeScene.SHIP_SWAY_X,
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

        this._startPrompt = UiUtils.addPulsingButtonHint(this, centerX, UiLayout.HEIGHT - 220,
            this._getPromptText(this.gameInputManager.activeInputType));
        // Long: smaller, to fit a portrait screen
        this._joinPrompt = UiUtils.addButtonHint(this, centerX, UiLayout.HEIGHT - 140, [], UiUtils.SMALL_HINT_FONT_SIZE)
            .setAlpha(0.5);
        this._updateJoinPrompt();
        this._frame = this.add.container(0, 0, [this._title, this._startPrompt, this._joinPrompt]);
        UiLayout.onResize(this, () => this.layout());

        this.game.events.on('input-type-changed', this._onInputTypeChanged, this);
        this.game.events.on('gamepad-connected', this._updateJoinPrompt, this);
        this.game.events.on('gamepad-disconnected', this._updateJoinPrompt, this);
        this.events.once('shutdown', () => {
            this.game.events.off('input-type-changed', this._onInputTypeChanged, this);
            this.game.events.off('gamepad-connected', this._updateJoinPrompt, this);
            this.game.events.off('gamepad-disconnected', this._updateJoinPrompt, this);
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
            UiUtils.setButtonHint(this._startPrompt, this._getPromptText(type));
            this._updateJoinPrompt();
        }
    }

    private _getPromptText(type: InputType): HintPart[] {
        return type === 'touch' ? ['TAP TO START'] : ['PRESS', this.gameInputManager.keyHintPart('Space'), 'TO START'];
    }

    // Until player 2 joins. No coop on touch
    private _updateJoinPrompt(): void {
        const inputManager = this.gameInputManager;
        UiUtils.setButtonHint(this._joinPrompt, inputManager.joinHintParts());
        this._joinPrompt.setVisible(!this._joinedDevice && inputManager.activeInputType !== 'touch');
    }

    private createShip(shipId: number, x: number, y: number): HomeShip {
        const data = (this.cache.json.get('playerShips') as PlayerShipsData)[shipId];
        const image = this.add.image(x, y, 'sprites', data.texture).setAngle(-90).setDepth(10);
        const thrusters = new Thrusters(image);
        thrusters.setThrusters(data.thrusters);
        // The streaks drift down with the background, in px/s
        const bgScreenSpeed: number = HomeScene.BG_SCROLL_SPEED * HomeScene.BG_TILE_SCALE * 1000;
        const wingTrails = new WingTrails(image, bgScreenSpeed);
        wingTrails.setWingTips(data.wingTips);
        const turret = new Turret(image);
        turret.setTurret(data.turret);
        const ship: HomeShip = {image, thrusters, wingTrails, turret};
        this._ships.push(ship);
        return ship;
    }

    // Enter, a gamepad's A or B for a bot: player 2's ship flies in next to player 1's, labeled with its controls
    private _updateJoining(): void {
        if (this._joinedDevice)
            return;
        const inputManager = this.gameInputManager;
        let device: InputDevice | null = inputManager.botJustPressed() ? {type: 'bot'} : inputManager.findConfirmingDevice();
        // Space starts the run
        if (device?.type === 'keyboard' && device.keys === 'wasd')
            device = null;
        if (!device)
            return;

        this._joinedDevice = device;
        Sfx.play(this, 'launch');
        const centerX: number = UiLayout.WIDTH / 2;
        const y: number = UiLayout.HEIGHT / 2;
        const playerShip: HomeShip = this._ships[0];
        this.tweens.killTweensOf(playerShip.image);
        this.tweens.add({targets: playerShip.image, x: centerX - HomeScene.SHIP_SPACING_X, duration: 400, ease: 'Quad.easeOut'});

        const joinedShip: HomeShip = this.createShip(2, centerX + HomeScene.SHIP_SPACING_X,
            this.cameras.main.worldView.bottom + 100);
        joinedShip.thrusters.setBoost(true);
        this.tweens.add({targets: joinedShip.image, y, duration: 600, ease: 'Quad.easeOut',
            onComplete: () => joinedShip.thrusters.setBoost(false)});
        // Player 1 keeps the keyboard, minus the arrows if player 2 took them
        const playerControls: string = device.type === 'keyboard' ? 'WASD' : 'KEYBOARD';
        this.addShipLabel(centerX - HomeScene.SHIP_SPACING_X, y, `P1 ${playerControls}`, '#7fd4ff');
        this.addShipLabel(joinedShip.image.x, y, `P2 ${HomeScene.deviceLabel(device)}`, '#ff9a3c');
        this._updateJoinPrompt();
    }

    private addShipLabel(x: number, shipY: number, text: string, color: string) {
        const label = this.add.text(x, shipY + HomeScene.SHIP_LABEL_OFFSET_Y, text,
            {fontSize: '32px', color, fontFamily: 'future'}).setOrigin(0.5).setAlpha(0);
        this.tweens.add({targets: label, alpha: 1, delay: 400, duration: 250});
        this._shipLabels.push(label);
    }

    private static deviceLabel(device: InputDevice): string {
        switch (device.type) {
            case 'bot': return 'BOT';
            case 'gamepad': return 'GAMEPAD';
            case 'keyboard': return device.keys === 'wasd' ? 'WASD' : 'ARROWS';
            default: return '';
        }
    }

    private _startGame(): void {
        this._started = true;
        Sfx.play(this, 'start');
        Sfx.play(this, 'launch');

        this.tweens.killTweensOf([...this._ships.map(ship => ship.image), this._startPrompt]);
        // The title clears the ships' way out
        this.tweens.add({targets: this._title, y: -200, alpha: 0, duration: 400, ease: 'Quad.easeIn'});
        this.tweens.add({targets: [this._startPrompt, this._joinPrompt, ...this._shipLabels], alpha: 0, duration: 200});
        const joinedDevices: InputDevice[] = this._joinedDevice ? [this._joinedDevice] : [];
        this._ships.forEach((ship, index) => {
            ship.thrusters.setBoost(true);
            this.tweens.add({
                targets: ship.image,
                x: this._ships.length > 1 ? ship.image.x : UiLayout.WIDTH / 2,
                y: this.cameras.main.scrollY - ship.image.height,
                duration: 600,
                ease: 'Quad.easeIn',
                onComplete: index > 0 ? undefined : () => {
                    this.scene.launch(GameConstants.SceneKeys.MAIN_UI);
                    this.scene.start(GameConstants.SceneKeys.MAIN_GAME, {joinedDevices});
                }
            });
        });
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);
        this._bg.tilePositionY -= HomeScene.BG_SCROLL_SPEED * deltaTime;
        // Cruising forward, as the background scrolls
        for (const ship of this._ships) {
            ship.thrusters.update(true, 1, deltaTime);
            ship.wingTrails.update(true);
            ship.turret.update(deltaTime);
        }

        if (this._started)
            return;
        if (this.gameInputManager.startJustPressed())
            this._startGame();
        else
            this._updateJoining();
    }
}
