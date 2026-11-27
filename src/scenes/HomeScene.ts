import {Loader} from "phaser";
import GameConstants from "../GameConstants.ts";
import Thrusters from "../components/Thrusters.ts";
import WingTrails from "../components/WingTrails.ts";
import Turret from "../components/Turret.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import UiUtils, {type HintPart} from "../utils/UiUtils.ts";
import UiLayout from "../utils/UiLayout.ts";
import Sfx from "../audio/Sfx.ts";
import type SaveManager from "../managers/SaveManager.ts";
import {isSameDevice, type InputDevice} from "../managers/PlayerInput.ts";

// Choosing 1 or 2 players, waiting for player 2, then flying out
type HomeState = 'menu' | 'lobby' | 'started';

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
    private static readonly MENU_Y: number = 1360;
    private static readonly MENU_SPACING: number = 100;
    private static readonly SELECTED_COLOR: string = '#ffcc00';
    private static readonly SELECTED_SCALE: number = 1.1;
    private static readonly UNSELECTED_ALPHA: number = 0.6;
    private static readonly STICK_THRESHOLD: number = 0.5;

    private _bg: Phaser.GameObjects.TileSprite;
    private _playerShip: HomeShip;
    // Player 2's ship, kept to come back after leaving
    private _joinedShip: HomeShip | null;
    // "P1" and "P2" with an icon of what drives them, under each ship
    private _labels: Phaser.GameObjects.Container[];
    private _title: Phaser.GameObjects.Container;
    // The title, the menu and the hints, on the portrait frame
    private _frame: Phaser.GameObjects.Container;
    private _menuOptions: Phaser.GameObjects.Text[];
    private _menuIndex: number;
    // null until the first update, so a direction held when the screen opens doesn't move the selection
    private _previousMoveY: number | null;
    private _hint: Phaser.GameObjects.Container;
    private _subHint: Phaser.GameObjects.Container;
    private _state: HomeState;
    // 2 players: the device that picked the option, and player 2's once it joins (or the bot)
    private _playerDevice: InputDevice | null;
    private _joinedDevice: InputDevice | null;
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

        this._state = 'menu';
        this._playerDevice = null;
        this._joinedDevice = null;
        this._joinedShip = null;
        this._labels = [];
        this._menuIndex = 0;
        this._previousMoveY = null;

        this._bg = this.add.tileSprite(0, 0, 1, 1, 'bg').setOrigin(0).setTileScale(HomeScene.BG_TILE_SCALE);

        this._playerShip = this.createShip(1, UiLayout.WIDTH / 2 - HomeScene.SHIP_SWAY_X, UiLayout.HEIGHT / 2);
        this.sway(this._playerShip, UiLayout.WIDTH / 2, HomeScene.SHIP_SWAY_X);

        const centerX: number = UiLayout.WIDTH / 2;
        const titleY: number = 560;
        this._title = this.add.container(0, 0, [
            this.add.text(centerX, titleY, 'FINAL ORBIT', {fontSize: '120px', color: '#fff', fontFamily: 'future'})
                .setOrigin(0.5).setShadow(0, 8, '#000', 0, false, true),
        ]);

        this._menuOptions = ['1 PLAYER', '2 PLAYERS'].map((label, index) => this.add.text(centerX,
            HomeScene.MENU_Y + index * HomeScene.MENU_SPACING, label, {fontSize: '64px', color: '#fff', fontFamily: 'future'})
            .setOrigin(0.5).setShadow(0, 6, '#000', 0, false, true));
        this._hint = UiUtils.addPulsingButtonHint(this, centerX, UiLayout.HEIGHT - 220, []);
        // Long: smaller, to fit a portrait screen
        this._subHint = UiUtils.addButtonHint(this, centerX, UiLayout.HEIGHT - 140, [], UiUtils.SMALL_HINT_FONT_SIZE)
            .setAlpha(0.5);
        this._frame = this.add.container(0, 0, [this._title, ...this._menuOptions, this._hint, this._subHint]);
        this.updateMenu();
        this.updateHints();
        UiLayout.onResize(this, () => this.layout());

        this.game.events.on('input-type-changed', this.updateHints, this);
        this.game.events.on('gamepad-connected', this.updateHints, this);
        this.game.events.on('gamepad-disconnected', this.updateHints, this);
        this.events.once('shutdown', () => {
            this.game.events.off('input-type-changed', this.updateHints, this);
            this.game.events.off('gamepad-connected', this.updateHints, this);
            this.game.events.off('gamepad-disconnected', this.updateHints, this);
        });

        console.log("HomeScene created");
    }

    // The ship and the stars at the game's scale, as in a run. Only the title, the menu and the hints fit the frame
    private layout() {
        const camera = this.cameras.main;
        camera.setOrigin(0.5).setZoom(1).centerOn(UiLayout.WIDTH / 2, UiLayout.HEIGHT / 2);
        this._bg.setPosition(camera.scrollX, camera.scrollY).setSize(this.scale.width, this.scale.height);

        const zoom: number = UiLayout.frameZoom(this);
        this._frame.setScale(zoom).setPosition(UiLayout.WIDTH / 2 * (1 - zoom), UiLayout.HEIGHT / 2 * (1 - zoom));
    }

    // The selected option in yellow and a bit bigger. Touch only gets "TAP TO START": no coop on touch
    private updateMenu() {
        const isMenuShown: boolean = this._state === 'menu' && this.gameInputManager.activeInputType !== 'touch';
        this._menuOptions.forEach((option, index) => {
            const isSelected: boolean = index === this._menuIndex;
            option.setVisible(isMenuShown).setColor(isSelected ? HomeScene.SELECTED_COLOR : '#ffffff')
                .setScale(isSelected ? HomeScene.SELECTED_SCALE : 1).setAlpha(isSelected ? 1 : HomeScene.UNSELECTED_ALPHA);
        });
    }

    private updateHints() {
        if (this._state === 'started')
            return;
        const inputManager = this.gameInputManager;
        this.updateMenu();
        if (this._state === 'menu') {
            UiUtils.setButtonHint(this._hint, inputManager.menuHintParts());
            this._subHint.setVisible(false);
            return;
        }

        const player: InputDevice = this._playerDevice!;
        const joined: InputDevice | null = this._joinedDevice;
        this._subHint.setVisible(true);
        if (!joined) {
            // Player 2 joins with a device player 1 doesn't hold: the arrows' Enter, or another pad's A
            const keyboardJoin: HintPart = inputManager.keyHintPart(player.type === 'keyboard' ? 'Enter' : 'Space');
            const hasOtherPad: boolean = inputManager.gamepadCount > (player.type === 'gamepad' ? 1 : 0);
            UiUtils.setButtonHint(this._hint, ['P2: PRESS', keyboardJoin,
                ...(hasOtherPad ? ['OR', inputManager.gamepadHintPart('confirm')] : []), 'TO JOIN']);
            UiUtils.setButtonHint(this._subHint, [inputManager.botHintPart(player), 'FOR A BOT,',
                inputManager.backHintPart(player), 'BACK']);
            return;
        }
        UiUtils.setButtonHint(this._hint, ['PRESS', inputManager.confirmHintPart(player), 'TO START']);
        UiUtils.setButtonHint(this._subHint, joined.type === 'bot'
            ? [inputManager.botHintPart(player), 'TO REMOVE THE BOT']
            : ['P2:', inputManager.backHintPart(joined), 'TO LEAVE']);
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

    private updateMenuInput() {
        const inputManager = this.gameInputManager;
        if (inputManager.activeInputType === 'touch') {
            if (inputManager.tapJustPressed())
                this.startGame([{type: 'any'}]);
            return;
        }

        const moveDirectionY: number = inputManager.moveDirection.y;
        const moveY: number = Math.abs(moveDirectionY) > HomeScene.STICK_THRESHOLD ? Math.sign(moveDirectionY) : 0;
        if (this._previousMoveY !== null && moveY !== 0 && moveY !== this._previousMoveY) {
            this._menuIndex = Phaser.Math.Wrap(this._menuIndex + moveY, 0, this._menuOptions.length);
            Sfx.play(this, 'cardSelect');
            this.updateMenu();
        }
        this._previousMoveY = moveY;

        // The device that picks the option is player 1's
        const device: InputDevice | null = inputManager.findConfirmingDevice();
        if (!device)
            return;
        if (this._menuIndex === 0)
            this.startGame([{type: 'any'}]);
        else
            this.openLobby(device);
    }

    // 2 players: player 1 owns the device that picked the option, the whole keyboard until player 2 takes the arrows
    private openLobby(device: InputDevice) {
        Sfx.play(this, 'cardPick');
        this._state = 'lobby';
        this._playerDevice = device.type === 'keyboard' ? {type: 'keyboard', keys: 'all'} : device;
        this._labels = [this.addLabel(this._playerShip, 1, this.gameInputManager.deviceIcon(this._playerDevice))];
        this.updateHints();
    }

    private closeLobby() {
        if (this._joinedDevice)
            this.removeJoined();
        this._labels.forEach(label => label.destroy());
        this._labels = [];
        this._state = 'menu';
        this._playerDevice = null;
        this._previousMoveY = null;
        this.updateHints();
    }

    private updateLobbyInput() {
        const inputManager = this.gameInputManager;
        const player: InputDevice = this._playerDevice!;
        const joined: InputDevice | null = this._joinedDevice;
        if (inputManager.backJustPressed(player)) {
            this.closeLobby();
            return;
        }

        if (joined) {
            if (joined.type === 'bot' ? inputManager.botJustPressed() : inputManager.backJustPressed(joined))
                this.removeJoined();
            else if (inputManager.readConfirmJustPressed(player))
                this.startGame([player, joined]);
            return;
        }

        if (inputManager.botJustPressed()) {
            this.join({type: 'bot'});
            return;
        }
        const device: InputDevice | null = inputManager.findConfirmingDevice();
        if (!device)
            return;
        if (device.type === 'keyboard') {
            // Sharing the keyboard: player 2 takes the arrows with Enter, player 1 keeps WASD and Space
            if (player.type !== 'keyboard')
                this.join({type: 'keyboard', keys: 'all'});
            else if (device.keys === 'arrows')
                this.join(device);
        } else if (!isSameDevice(device, player)) {
            this.join(device);
        }
    }

    // Player 2's ship flies in next to player 1's, both labeled with what drives them
    private join(device: InputDevice) {
        this._joinedDevice = device;
        if (device.type === 'keyboard' && device.keys === 'arrows')
            this._playerDevice = {type: 'keyboard', keys: 'wasd'};
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

        this.setLabels(device);
        this.updateHints();
    }

    // Player 2 or the bot flies away, player 1 gets the whole keyboard back and the middle of the screen
    private removeJoined() {
        this._joinedDevice = null;
        if (this._playerDevice?.type === 'keyboard')
            this._playerDevice = {type: 'keyboard', keys: 'all'};
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
        this.sway(this._playerShip, UiLayout.WIDTH / 2, HomeScene.SHIP_SWAY_X);
        this.setLabels(null);
        this.updateHints();
    }

    private setLabels(joinedDevice: InputDevice | null) {
        this._labels.forEach(label => label.destroy());
        const inputManager = this.gameInputManager;
        this._labels = [this.addLabel(this._playerShip, 1, inputManager.deviceIcon(this._playerDevice!))];
        if (joinedDevice)
            this._labels.push(this.addLabel(this._joinedShip!, 2, inputManager.deviceIcon(joinedDevice)));
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
        this.tweens.add({targets: label, alpha: 1, duration: 250});
        return label;
    }

    private startGame(devices: InputDevice[]): void {
        this._state = 'started';
        Sfx.play(this, 'start');
        Sfx.play(this, 'launch');

        const ships: HomeShip[] = this._joinedDevice ? [this._playerShip, this._joinedShip!] : [this._playerShip];
        this.tweens.killTweensOf(ships.map(ship => ship.image));
        // The title clears the ships' way out
        this.tweens.add({targets: this._title, y: -200, alpha: 0, duration: 400, ease: 'Quad.easeIn'});
        this.tweens.killTweensOf(this._hint);
        this.tweens.add({targets: [this._hint, this._subHint, ...this._menuOptions, ...this._labels], alpha: 0, duration: 200});
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
                    this.scene.start(GameConstants.SceneKeys.MAIN_GAME, {devices});
                }
            });
        });
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

        if (this._state === 'menu')
            this.updateMenuInput();
        else if (this._state === 'lobby')
            this.updateLobbyInput();
    }
}
