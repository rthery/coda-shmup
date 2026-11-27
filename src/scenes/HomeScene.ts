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
import {isSameDevice, type InputDevice} from "../managers/PlayerInput.ts";

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
    private static readonly SHIP_SWAY_DURATION: number = 700; // ms
    private static readonly SHIP_MOVE_DURATION: number = 400; // ms
    // Player 2 joined: the two ships side by side, each swaying around its own spot
    private static readonly SHIP_SPACING_X: number = 150;
    private static readonly DUO_SWAY_X: number = 48;
    private static readonly DUO_SWAY_DELAY: number = 150; // ms
    private static readonly LABEL_OFFSET_Y: number = 110;
    private static readonly LABEL_ICON_OFFSET_Y: number = 75;
    // Longest side: a key cluster (WASD, arrows) is three keys wide, a keyboard or a gamepad is one icon,
    // close to its 48 px to stay sharp
    private static readonly LABEL_CLUSTER_SIZE: number = 110;
    private static readonly LABEL_ICON_SIZE: number = 52;
    private static readonly PLAYER_COLORS: string[] = ['#7fd4ff', '#ff9a3c'];

    private _bg: Phaser.GameObjects.TileSprite;
    private _playerShip: HomeShip;
    // Player 2, joined before the run starts: its device, or a bot. Its ship is kept to come back
    private _joinedDevice: InputDevice | null;
    // Player 1's device: the one used last, up to the last frame, that isn't player 2's
    private _playerDevice: InputDevice;
    private _joinedShip: HomeShip | null;
    // "P1" and "P2" with an icon of what drives them, under each ship
    private _labels: Phaser.GameObjects.Container[];
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
        this._joinedDevice = null;
        this._playerDevice = this.gameInputManager.lastUsedDevice;
        this._joinedShip = null;
        this._labels = [];

        this._bg = this.add.tileSprite(0, 0, 1, 1, 'bg').setOrigin(0).setTileScale(HomeScene.BG_TILE_SCALE);

        this._playerShip = this.createShip(1, UiLayout.WIDTH / 2 - HomeScene.SHIP_SWAY_X, UiLayout.HEIGHT / 2);
        this.sway(this._playerShip, UiLayout.WIDTH / 2, HomeScene.SHIP_SWAY_X);

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
        return type === 'touch' ? ['TAP TO START'] : this.gameInputManager.startHintParts(this._playerDevice);
    }

    // How player 2 joins, or leaves once it has. No coop on touch
    private _updateJoinPrompt(): void {
        const inputManager = this.gameInputManager;
        UiUtils.setButtonHint(this._startPrompt, this._getPromptText(inputManager.activeInputType));
        UiUtils.setButtonHint(this._joinPrompt, this._joinedDevice
            ? inputManager.leaveHintParts(this._joinedDevice) : inputManager.joinHintParts());
        this._joinPrompt.setVisible(inputManager.activeInputType !== 'touch');
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
        return {image, thrusters, wingTrails, turret};
    }

    // Glides to the left of its spot, then sways from side to side around it
    private sway(ship: HomeShip, centerX: number, amplitude: number, delay: number = 0) {
        this.tweens.killTweensOf(ship.image);
        this.tweens.add({
            targets: ship.image,
            x: centerX - amplitude,
            duration: HomeScene.SHIP_MOVE_DURATION,
            ease: 'Quad.easeInOut',
            onComplete: () => this.tweens.add({
                targets: ship.image,
                x: centerX + amplitude,
                delay,
                duration: HomeScene.SHIP_SWAY_DURATION,
                yoyo: true,
                repeat: -1,
                ease: 'Quad.easeInOut'
            })
        });
    }

    // Enter or a gamepad's A makes player 2 join, and its Backspace or B makes it leave. Keyboard B adds or removes the bot
    private _updateJoining(): void {
        const inputManager = this.gameInputManager;
        if (inputManager.botJustPressed()) {
            if (!this._joinedDevice)
                this.join({type: 'bot'});
            else if (this._joinedDevice.type === 'bot')
                this.removeJoined();
            return;
        }
        if (this._joinedDevice) {
            if (inputManager.leaveJustPressed(this._joinedDevice))
                this.removeJoined();
            return;
        }
        const device: InputDevice | null = inputManager.findJoiningDevice();
        // Space starts the run, Enter always joins (player 1 keeps Space), and player 1's own pad doesn't join
        if (device && !(device.type === 'keyboard' && device.keys === 'wasd')
            && !(device.type === 'gamepad' && isSameDevice(device, this._playerDevice)))
            this.join(device);
    }

    // Player 2's ship flies in next to player 1's, both labeled with what drives them
    private join(device: InputDevice) {
        this._joinedDevice = device;
        Sfx.play(this, 'launch');
        const centerX: number = UiLayout.WIDTH / 2;
        const y: number = UiLayout.HEIGHT / 2;
        this.sway(this._playerShip, centerX - HomeScene.SHIP_SPACING_X, HomeScene.DUO_SWAY_X);

        const joinedShip: HomeShip = this._joinedShip ??= this.createShip(2, 0, 0);
        const joinedX: number = centerX + HomeScene.SHIP_SPACING_X;
        joinedShip.image.setVisible(true).setPosition(joinedX - HomeScene.DUO_SWAY_X, this.cameras.main.worldView.bottom + 100);
        joinedShip.thrusters.show();
        joinedShip.wingTrails.show();
        joinedShip.turret.show();
        joinedShip.thrusters.setBoost(true);
        this.tweens.killTweensOf(joinedShip.image);
        this.tweens.add({targets: joinedShip.image, y, duration: 600, ease: 'Quad.easeOut', onComplete: () => {
            joinedShip.thrusters.setBoost(false);
            this.sway(joinedShip, joinedX, HomeScene.DUO_SWAY_X, HomeScene.DUO_SWAY_DELAY);
        }});

        const inputManager = this.gameInputManager;
        this._labels = [
            this.addLabel(this._playerShip, 1, inputManager.deviceIcon({type: 'any', excluded: [device]})),
            this.addLabel(joinedShip, 2, inputManager.deviceIcon(device))
        ];
        this._updateJoinPrompt();
    }

    // Player 2 or the bot flies away, player 1 has the screen to itself again
    private removeJoined() {
        this._joinedDevice = null;
        const joinedShip = this._joinedShip!;
        this.tweens.killTweensOf(joinedShip.image);
        joinedShip.thrusters.setBoost(true);
        this.tweens.add({targets: joinedShip.image, y: this.cameras.main.worldView.bottom + 100, duration: 500,
            ease: 'Quad.easeIn', onComplete: () => {
                joinedShip.thrusters.setBoost(false);
                joinedShip.thrusters.hide();
                joinedShip.wingTrails.hide();
                joinedShip.turret.hide();
                joinedShip.image.setVisible(false);
            }});
        this._labels.forEach(label => label.destroy());
        this._labels = [];
        this.sway(this._playerShip, UiLayout.WIDTH / 2, HomeScene.SHIP_SWAY_X);
        this._updateJoinPrompt();
    }

    // Follows its ship's sway
    private addLabel(ship: HomeShip, playerNumber: number, icon: string): Phaser.GameObjects.Container {
        const color: string = HomeScene.PLAYER_COLORS[playerNumber - 1];
        const text = this.add.text(0, 0, `P${playerNumber}`, {fontSize: '64px', color, fontFamily: 'future'})
            .setOrigin(0.5).setShadow(0, 6, '#000', 0, false, true);
        const image = this.add.image(0, HomeScene.LABEL_ICON_OFFSET_Y, 'sprites', icon);
        const isCluster: boolean = image.width > image.height * 1.2 && image.width > 100;
        image.setScale((isCluster ? HomeScene.LABEL_CLUSTER_SIZE : HomeScene.LABEL_ICON_SIZE)
            / Math.max(image.width, image.height));
        const label = this.add.container(ship.image.x, UiLayout.HEIGHT / 2 + HomeScene.LABEL_OFFSET_Y, [text, image])
            .setData('ship', ship).setAlpha(0);
        this.tweens.add({targets: label, alpha: 1, delay: 400, duration: 250});
        return label;
    }

    private _startGame(): void {
        this._started = true;
        Sfx.play(this, 'start');
        Sfx.play(this, 'launch');

        const ships: HomeShip[] = this._joinedDevice ? [this._playerShip, this._joinedShip!] : [this._playerShip];
        this.tweens.killTweensOf([...ships.map(ship => ship.image), this._startPrompt]);
        // The title clears the ships' way out
        this.tweens.add({targets: this._title, y: -200, alpha: 0, duration: 400, ease: 'Quad.easeIn'});
        this.tweens.add({targets: [this._startPrompt, this._joinPrompt, ...this._labels], alpha: 0, duration: 200});
        const joinedDevices: InputDevice[] = this._joinedDevice ? [this._joinedDevice] : [];
        ships.forEach((ship, index) => {
            ship.thrusters.setBoost(true);
            this.tweens.add({
                targets: ship.image,
                x: ships.length > 1 ? ship.image.x : UiLayout.WIDTH / 2,
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

    // The start hint follows player 1's device
    private updatePlayerDevice() {
        const lastUsed: InputDevice = this.gameInputManager.lastUsedDevice;
        if (isSameDevice(lastUsed, this._playerDevice) || (this._joinedDevice && isSameDevice(lastUsed, this._joinedDevice)))
            return;
        this._playerDevice = lastUsed;
        this._updateJoinPrompt();
    }

    private updateShip(ship: HomeShip, deltaTime: number) {
        ship.thrusters.update(true, 1, deltaTime);
        ship.wingTrails.update(true);
        ship.turret.update(deltaTime);
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);
        this._bg.tilePositionY -= HomeScene.BG_SCROLL_SPEED * deltaTime;
        // Cruising forward, as the background scrolls
        this.updateShip(this._playerShip, deltaTime);
        if (this._joinedShip)
            this.updateShip(this._joinedShip, deltaTime);
        for (const label of this._labels)
            label.x = (label.getData('ship') as HomeShip).image.x;

        if (this._started)
            return;
        if (this.gameInputManager.startJustPressed(this._joinedDevice))
            this._startGame();
        else
            this._updateJoining();
        this.updatePlayerDevice();
    }
}
