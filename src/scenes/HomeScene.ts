import {Loader} from "phaser";
import GameConstants from "../GameConstants.ts";
import Thrusters from "../components/Thrusters.ts";
import WingTrails from "../components/WingTrails.ts";
import Turret from "../components/Turret.ts";
import type {PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import UiUtils, {type HintPart, type UiFrame} from "../utils/UiUtils.ts";
import UiLayout from "../utils/UiLayout.ts";
import Sfx from "../audio/Sfx.ts";
import type SaveManager from "../managers/SaveManager.ts";
import {isSameDevice, type InputDevice} from "../managers/PlayerInput.ts";

type MenuOption = {
    title: string;
    label: string;
    subtitle: string;
    frame: UiFrame;
    // Shown, but not selectable yet
    isDisabled?: boolean;
}

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
    private static readonly STICK_THRESHOLD: number = 0.5;
    // Solo, local coop and online coop: cards stacked like the level-up ones, the selected one lifted and nudged
    private static readonly MENU_TOP: number = 880;
    private static readonly MENU_CARD_WIDTH: number = 820;
    private static readonly MENU_CARD_HEIGHT: number = 200;
    private static readonly MENU_CARD_GAP: number = 24;
    private static readonly CARD_LIFT: number = 14;
    private static readonly CARD_NUDGE: number = 30;
    private static readonly CARD_ALPHA: number = 0.8;
    private static readonly DISABLED_CARD_ALPHA: number = 0.45;
    private static readonly CARD_SHADOW_ALPHA: number = 0.45;
    private static readonly CARD_SHADOW_RADIUS: number = 18;
    private static readonly MENU_OPTIONS: MenuOption[] = [
        {title: 'SOLO', label: '1 PLAYER', subtitle: 'ANY KEYBOARD OR PAD', frame: 'ui_header_blade_blue'},
        {title: 'LOCAL COOP', label: '2 PLAYERS', subtitle: 'SAME SCREEN', frame: 'ui_header_blade_green'},
        {title: 'ONLINE COOP', label: '2 PLAYERS', subtitle: 'COMING SOON', frame: 'ui_header_blade_red', isDisabled: true},
    ];
    // Local coop: a panel with a row per player and a START button like the pause screen's
    private static readonly LOBBY_TOP: number = 880;
    private static readonly LOBBY_WIDTH: number = 820;
    private static readonly ROW_HEIGHT: number = 130;
    private static readonly ROW_GAP: number = 20;
    private static readonly ROW_PADDING: number = 40;
    private static readonly ROW_RADIUS: number = 16;
    // Longest side: a key cluster (WASD, arrows) is three keys wide, a keyboard or a gamepad is one icon
    private static readonly ROW_CLUSTER_SIZE: number = 110;
    private static readonly ROW_ICON_SIZE: number = 60;
    private static readonly BUTTON_WIDTH: number = 440;
    private static readonly BUTTON_HEIGHT: number = 84;
    private static readonly BUTTON_RADIUS: number = 12;
    private static readonly BUTTON_LIFT: number = 8;
    private static readonly START_COLORS = {fill: 0x1fbf75, shade: 0x15955a};
    private static readonly DISABLED_BUTTON_COLOR: number = 0xb7bec9;
    // Above the menu, higher than the old single ship so the stacked cards fit under it
    private static readonly TITLE_Y: number = 400;
    private static readonly SHIP_Y: number = 710;
    // Readable on the panels' light body: the ships' blue and orange, darker
    private static readonly PLAYER_INK_COLORS: number[] = [0x2a7fc4, 0xd9731f];
    private static readonly READY_COLOR: string = '#2f8f52';
    private static readonly ICON_INK: number = 0x4a5263;

    private _bg: Phaser.GameObjects.TileSprite;
    private _playerShip: HomeShip;
    // Player 2's ship, kept to come back after leaving
    private _joinedShip: HomeShip | null;
    private _title: Phaser.GameObjects.Container;
    // The title, the menu, the lobby and the hints, on the portrait frame
    private _frame: Phaser.GameObjects.Container;
    private _menuCards: Phaser.GameObjects.Container[];
    private _menuIndex: number;
    // null until the first update, so a direction held when the screen opens doesn't move the selection
    private _previousMoveY: number | null;
    private _lobby: Phaser.GameObjects.Container;
    private _rows: Phaser.GameObjects.Container[];
    private _startButton: Phaser.GameObjects.Graphics;
    private _startText: Phaser.GameObjects.Text;
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
        this._menuIndex = 0;
        this._previousMoveY = null;

        this._bg = this.add.tileSprite(0, 0, 1, 1, 'bg').setOrigin(0).setTileScale(HomeScene.BG_TILE_SCALE);

        this._playerShip = this.createShip(1, UiLayout.WIDTH / 2 - HomeScene.SHIP_SWAY_X, HomeScene.SHIP_Y);
        this.sway(this._playerShip, UiLayout.WIDTH / 2, HomeScene.SHIP_SWAY_X);

        const centerX: number = UiLayout.WIDTH / 2;
        this._title = this.add.container(0, 0, [
            this.add.text(centerX, HomeScene.TITLE_Y, 'FINAL ORBIT', {fontSize: '120px', color: '#fff', fontFamily: 'future'})
                .setOrigin(0.5).setShadow(0, 8, '#000', 0, false, true),
        ]);

        this._menuCards = HomeScene.MENU_OPTIONS.map((option, index) => this.createMenuCard(option, index));
        this._lobby = this.createLobby();
        this._hint = UiUtils.addPulsingButtonHint(this, centerX, UiLayout.HEIGHT - 220, []);
        // Long: smaller, to fit a portrait screen
        this._subHint = UiUtils.addButtonHint(this, centerX, UiLayout.HEIGHT - 140, [], UiUtils.SMALL_HINT_FONT_SIZE)
            .setAlpha(0.5);
        this._frame = this.add.container(0, 0, [this._title, ...this._menuCards, this._lobby, this._hint, this._subHint]);
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

    // The mode's name on the header, its player count and a word on how it plays
    private createMenuCard(option: MenuOption, index: number): Phaser.GameObjects.Container {
        const width: number = HomeScene.MENU_CARD_WIDTH;
        const height: number = HomeScene.MENU_CARD_HEIGHT;
        const top: number = -height / 2;
        const bodyTop: number = top + UiUtils.HEADER_HEIGHT;

        const shadow = this.add.graphics().fillStyle(0x000000, HomeScene.CARD_SHADOW_ALPHA)
            .fillRoundedRect(-width / 2, top + HomeScene.CARD_LIFT, width, height, HomeScene.CARD_SHADOW_RADIUS);
        const panel = UiUtils.addPanel(this, 0, 0, width, height, option.frame);
        if (!option.isDisabled)
            panel.setInteractive({useHandCursor: true})
                .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.selectMenu(index))
                .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.chooseMenu({type: 'keyboard', keys: 'all'}));
        const title = UiUtils.addHeaderTitle(this, -width / 2, top, option.title);
        // The player count on the left of the body, how it plays on the right
        const bodyCenterY: number = bodyTop + (height / 2 - bodyTop) / 2;
        const label = this.add.text(-width / 2 + 40, bodyCenterY, option.label,
            {fontSize: '44px', color: UiUtils.INK_COLOR, fontFamily: 'future'}).setOrigin(0, 0.5);
        const subtitle = this.add.text(width / 2 - 40, bodyCenterY, option.subtitle,
            {fontSize: '26px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future'}).setOrigin(1, 0.5);

        const centerY: number = HomeScene.MENU_TOP + height / 2 + index * (height + HomeScene.MENU_CARD_GAP);
        return this.add.container(UiLayout.WIDTH / 2, centerY, [shadow, panel, title, label, subtitle])
            .setData('shadow', shadow).setData('restY', centerY);
    }

    // The two player rows and the START button
    private createLobby(): Phaser.GameObjects.Container {
        const width: number = HomeScene.LOBBY_WIDTH;
        const rowsTop: number = UiUtils.HEADER_HEIGHT + HomeScene.ROW_PADDING;
        const buttonY: number = rowsTop + 2 * HomeScene.ROW_HEIGHT + HomeScene.ROW_GAP + HomeScene.ROW_PADDING
            + HomeScene.BUTTON_HEIGHT / 2;
        const height: number = buttonY + HomeScene.BUTTON_HEIGHT / 2 + HomeScene.ROW_PADDING;
        const panel = UiUtils.addPanel(this, 0, height / 2, width, height, 'ui_header_blade_green');
        const title = UiUtils.addHeaderTitle(this, -width / 2, 0, 'LOCAL COOP');
        this._rows = [0, 1].map(index => this.add.container(0,
            rowsTop + HomeScene.ROW_HEIGHT / 2 + index * (HomeScene.ROW_HEIGHT + HomeScene.ROW_GAP)));

        this._startButton = this.add.graphics();
        this._startText = this.add.text(0, buttonY, 'START', {fontSize: '40px', color: '#fff', fontFamily: 'future'})
            .setOrigin(0.5).setData('restY', buttonY);
        const buttonZone = this.add.zone(0, buttonY, HomeScene.BUTTON_WIDTH, HomeScene.BUTTON_HEIGHT)
            .setInteractive({useHandCursor: true})
            .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.tryStartCoop());
        return this.add.container(UiLayout.WIDTH / 2, HomeScene.LOBBY_TOP,
            [panel, title, ...this._rows, this._startButton, this._startText, buttonZone]).setVisible(false);
    }

    // The menu on keyboards and gamepads. Touch only gets "TAP TO START": no coop on touch
    private updateMenu() {
        const isMenuShown: boolean = this._state === 'menu' && this.gameInputManager.activeInputType !== 'touch';
        this._menuCards.forEach((card, index) => {
            const isSelected: boolean = index === this._menuIndex;
            const alpha: number = HomeScene.MENU_OPTIONS[index].isDisabled ? HomeScene.DISABLED_CARD_ALPHA
                : isSelected ? 1 : HomeScene.CARD_ALPHA;
            card.setVisible(isMenuShown).setAlpha(alpha)
                .setPosition(UiLayout.WIDTH / 2 + (isSelected ? HomeScene.CARD_NUDGE : 0),
                    card.getData('restY') - (isSelected ? HomeScene.CARD_LIFT : 0));
            (card.getData('shadow') as Phaser.GameObjects.Graphics).setVisible(isSelected);
        });
    }

    private selectMenu(index: number) {
        if (index === this._menuIndex || this._state !== 'menu' || HomeScene.MENU_OPTIONS[index].isDisabled)
            return;
        this._menuIndex = index;
        Sfx.play(this, 'cardSelect');
        this.updateMenu();
    }

    // The next selectable card up or down, skipping the ones not playable yet
    private moveMenu(step: number) {
        let index: number = this._menuIndex;
        do
            index = Phaser.Math.Wrap(index + step, 0, HomeScene.MENU_OPTIONS.length);
        while (HomeScene.MENU_OPTIONS[index].isDisabled && index !== this._menuIndex);
        this.selectMenu(index);
    }

    // The device that picks the option is player 1's
    private chooseMenu(device: InputDevice) {
        if (this._state !== 'menu')
            return;
        if (this._menuIndex === 0)
            this.startGame([{type: 'any'}]);
        else
            this.openLobby(device);
    }

    // A row: the player's number in its ship's color, what drives it, and whether it's in
    private drawRow(playerNumber: number, device: InputDevice | null) {
        const row: Phaser.GameObjects.Container = this._rows[playerNumber - 1];
        this.tweens.killTweensOf(row.list);
        row.removeAll(true);
        const width: number = HomeScene.LOBBY_WIDTH - 2 * HomeScene.ROW_PADDING;
        const height: number = HomeScene.ROW_HEIGHT;
        const left: number = -width / 2;
        const color: number = HomeScene.PLAYER_INK_COLORS[playerNumber - 1];
        const frame = this.add.graphics().fillStyle(0x000000, 0.06)
            .fillRoundedRect(left, -height / 2, width, height, HomeScene.ROW_RADIUS)
            .lineStyle(4, color, device ? 1 : 0.35)
            .strokeRoundedRect(left, -height / 2, width, height, HomeScene.ROW_RADIUS);
        const numberText = this.add.text(left + 40, 0, `P${playerNumber}`, {fontSize: '64px', fontFamily: 'future',
            color: Phaser.Display.Color.IntegerToColor(color).rgba}).setOrigin(0, 0.5).setAlpha(device ? 1 : 0.5);
        const status = this.add.text(width / 2 - 40, 0, device ? 'READY' : 'WAITING...', {fontSize: '32px',
            color: device ? HomeScene.READY_COLOR : UiUtils.INK_SOFT_COLOR, fontFamily: 'future'}).setOrigin(1, 0.5);
        row.add([frame, numberText, status]);

        if (!device) {
            this.tweens.add({targets: status, alpha: 0.3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'});
            return;
        }
        // The pack's icons are white: inked to read on the panel
        const icon = this.add.image(0, 0, 'sprites', this.gameInputManager.deviceIcon(device)).setTint(HomeScene.ICON_INK);
        const isCluster: boolean = icon.width > icon.height * 1.2 && icon.width > 100;
        const scale: number = (isCluster ? HomeScene.ROW_CLUSTER_SIZE : HomeScene.ROW_ICON_SIZE)
            / Math.max(icon.width, icon.height);
        icon.setScale(scale).setX(numberText.x + numberText.width + 40 + icon.displayWidth / 2);
        row.add(icon);
        this.tweens.add({targets: icon, scale: {from: 1.25 * scale, to: scale}, duration: 250, ease: 'Back.easeOut'});
    }

    // Solid green and lifted once player 2 or the bot is in, flat and gray before
    private drawStartButton() {
        const isReady: boolean = this._joinedDevice !== null;
        const width: number = HomeScene.BUTTON_WIDTH;
        const restY: number = this._startText.getData('restY');
        const top: number = restY - HomeScene.BUTTON_HEIGHT / 2;
        const lift: number = isReady ? HomeScene.BUTTON_LIFT : 0;
        this._startButton.clear();
        if (isReady)
            this._startButton.fillStyle(HomeScene.START_COLORS.shade)
                .fillRoundedRect(-width / 2, top, width, HomeScene.BUTTON_HEIGHT, HomeScene.BUTTON_RADIUS);
        this._startButton.fillStyle(isReady ? HomeScene.START_COLORS.fill : HomeScene.DISABLED_BUTTON_COLOR)
            .fillRoundedRect(-width / 2, top - lift, width, HomeScene.BUTTON_HEIGHT, HomeScene.BUTTON_RADIUS);
        this._startText.setY(restY - lift).setAlpha(isReady ? 1 : 0.7);
    }

    private refreshLobby() {
        this.drawRow(1, this._playerDevice);
        this.drawRow(2, this._joinedDevice);
        this.drawStartButton();
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
        // The mouse clicks the START button
        UiUtils.setButtonHint(this._hint, inputManager.usesMouse(player) ? []
            : ['PRESS', inputManager.confirmHintPart(player), 'TO START']);
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
        if (this._previousMoveY !== null && moveY !== 0 && moveY !== this._previousMoveY)
            this.moveMenu(moveY);
        this._previousMoveY = moveY;

        const device: InputDevice | null = inputManager.findConfirmingDevice();
        if (device)
            this.chooseMenu(device);
    }

    // 2 players: player 1 owns the device that picked the option, the whole keyboard until player 2 takes the arrows
    private openLobby(device: InputDevice) {
        Sfx.play(this, 'cardPick');
        this._state = 'lobby';
        this._playerDevice = device.type === 'keyboard' ? {type: 'keyboard', keys: 'all'} : device;
        this._lobby.setVisible(true);
        this.tweens.add({targets: this._lobby, alpha: {from: 0, to: 1}, y: {from: HomeScene.LOBBY_TOP + 40,
            to: HomeScene.LOBBY_TOP}, duration: 250, ease: 'Quad.easeOut'});
        this.refreshLobby();
        this.updateHints();
    }

    private closeLobby() {
        if (this._joinedDevice)
            this.removeJoined();
        this._lobby.setVisible(false);
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
                this.tryStartCoop();
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
        const y: number = HomeScene.SHIP_Y;
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

        this.refreshLobby();
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
        this.refreshLobby();
        this.updateHints();
    }

    // Once player 2 or the bot is in
    private tryStartCoop() {
        if (this._state === 'lobby' && this._playerDevice && this._joinedDevice)
            this.startGame([this._playerDevice, this._joinedDevice]);
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
        this.tweens.add({targets: [this._hint, this._subHint, ...this._menuCards, this._lobby], alpha: 0, duration: 200});
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

        if (this._state === 'menu')
            this.updateMenuInput();
        else if (this._state === 'lobby')
            this.updateLobbyInput();
    }
}
