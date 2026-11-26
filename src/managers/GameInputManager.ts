import {Input, Plugins, Scene} from 'phaser';
import GameConstants from "../GameConstants.ts";
import type PlayerInput from "./PlayerInput.ts";
import {isSameDevice, type InputDevice, type KeyboardKeySet} from "./PlayerInput.ts";

declare module 'phaser' {
    interface Scene {
        gameInputManager: GameInputManager;
    }
}

export type InputType = 'keyboard' | 'touch' | 'gamepad';

export default class GameInputManager extends Plugins.BasePlugin {
    public static readonly PLUGIN_KEY: string = 'GameInputManager';
    public static readonly MAPPING_NAME: string = 'gameInputManager';

    private static readonly STICK_DEADZONE = 0.3;
    private static readonly TOUCH_DEADZONE = 24;
    private static readonly CONFIRM_BUTTON_INDEX = 0;
    private static readonly START_BUTTON_INDEX = 9;
    // In a run: adds a bot teammate
    private static readonly BOT_KEY_CODE = 'KeyB';
    // Physical key positions, not characters: WASD on a US keyboard, ZQSD on AZERTY
    private static readonly MOVE_LEFT_CODE = 'KeyA';
    private static readonly MOVE_RIGHT_CODE = 'KeyD';
    private static readonly MOVE_UP_CODE = 'KeyW';
    private static readonly MOVE_DOWN_CODE = 'KeyS';
    // Coop: each key set drives one player, by physical position
    private static readonly KEY_SETS: Record<KeyboardKeySet, {
        left: string, right: string, up: string, down: string, confirm: string[]
    }> = {
        wasd: {left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', confirm: ['Space']},
        arrows: {left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', confirm: ['Enter', 'NumpadEnter']},
    };
    private static readonly KEY_SET_NAMES: readonly KeyboardKeySet[] = ['wasd', 'arrows'];
    private static readonly KEYBOARD_DEVICES: Record<KeyboardKeySet, InputDevice> = {
        wasd: {type: 'keyboard', keys: 'wasd'},
        arrows: {type: 'keyboard', keys: 'arrows'},
    };

    private _scene: Scene | null = null;

    private _leftKey: Input.Keyboard.Key | null = null;
    private _rightKey: Input.Keyboard.Key | null = null;
    private _upKey: Input.Keyboard.Key | null = null;
    private _downKey: Input.Keyboard.Key | null = null;
    private _shootKey: Input.Keyboard.Key | null = null;
    private _restartKey: Input.Keyboard.Key | null = null;
    // Phaser keys match key codes, which change with the layout: these are tracked by physical position
    private readonly _heldKeyCodes = new Set<string>();
    // Pressed during the last step, by physical position: they wait in the pending set for the next step
    private _justPressedKeyCodes = new Set<string>();
    private _pendingPressedKeyCodes = new Set<string>();
    private readonly _anyDeviceInput: PlayerInput;

    // Touch: a floating joystick, the first touch sets its center
    private _touchPointerId: number = -1;
    private readonly _touchOrigin = new Phaser.Math.Vector2();
    private readonly _touchDirection = new Phaser.Math.Vector2();
    private _touchJustDown: boolean = false;
    private readonly _moveDirection = new Phaser.Math.Vector2();

    private _confirmJustDown: boolean = false;
    private _restartJustDown: boolean = false;
    private _pauseJustDown: boolean = false;
    // Keyboard events arrive before the step resets the flags: they wait here for the next step
    private _isPausePending: boolean = false;

    private _prevGamepadButtons = new Map<string, boolean>();
    private _activeInputType: InputType = 'keyboard';
    // The key set or pad used last: a solo player's own device, that can't make a second player join
    private _lastUsedDevice: InputDevice = GameInputManager.KEYBOARD_DEVICES.wasd;
    private readonly _gamepadDevices = new Map<number, InputDevice>();
    private readonly _keySetDirection = new Phaser.Math.Vector2();

    constructor(pluginManager: Plugins.PluginManager) {
        super(pluginManager);

        this.game.events.on(Phaser.Core.Events.STEP, this._preUpdate, this);
        this.game.events.on(Phaser.Core.Events.POST_STEP, this._postUpdate, this);
        // Key ups are lost while the window is unfocused
        this.game.events.on(Phaser.Core.Events.BLUR, () => this._heldKeyCodes.clear());

        this._anyDeviceInput = this.getInput({type: 'any'});

        console.log('[GameInputManager] Initialized');
    }

    // Every device at once: solo runs and menus
    public get anyDeviceInput(): PlayerInput {
        return this._anyDeviceInput;
    }

    public getInput(device: InputDevice): PlayerInput {
        return new DeviceInput(device, this);
    }

    public get lastUsedDevice(): InputDevice {
        return this._lastUsedDevice;
    }

    // The key set or pad whose confirm was just pressed: a player joining the run
    public findConfirmingDevice(): InputDevice | null {
        for (const keys of GameInputManager.KEY_SET_NAMES) {
            const device: InputDevice = GameInputManager.KEYBOARD_DEVICES[keys];
            if (this.readConfirmJustPressed(device))
                return device;
        }
        for (const pad of this._getConnectedGamepads()) {
            const device: InputDevice = this._getGamepadDevice(pad.index);
            if (this.readConfirmJustPressed(device))
                return device;
        }
        return null;
    }

    // Home: only Space starts a run, or a tap on touch screens. The other confirms make a player join
    public startJustPressed(): boolean {
        return this.readConfirmJustPressed(GameInputManager.KEYBOARD_DEVICES.wasd) || this._touchJustDown;
    }

    public botJustPressed(): boolean {
        return this._justPressedKeyCodes.has(GameInputManager.BOT_KEY_CODE);
    }

    public readMoveDirection(device: InputDevice, out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
        switch (device.type) {
            case 'bot':
                return out.set(0, 0);
            case 'any': {
                const excluded = device.excluded;
                if (!excluded?.length)
                    return out.copy(this.moveDirection);
                // Every device the other players don't own, the first one pushed wins
                for (const keys of GameInputManager.KEY_SET_NAMES) {
                    const keySet: InputDevice = GameInputManager.KEYBOARD_DEVICES[keys];
                    if (!GameInputManager.isExcluded(keySet, excluded)
                        && this.readMoveDirection(keySet, this._keySetDirection).lengthSq() > 0)
                        return out.copy(this._keySetDirection);
                }
                if (this._touchDirection.lengthSq() > 0)
                    return out.copy(this._touchDirection);
                for (const pad of this._getConnectedGamepads()) {
                    const padDevice: InputDevice = this._getGamepadDevice(pad.index);
                    if (!GameInputManager.isExcluded(padDevice, excluded)
                        && this.readMoveDirection(padDevice, out).lengthSq() > 0)
                        return out;
                }
                return out.set(0, 0);
            }
            case 'keyboard': {
                const keys = GameInputManager.KEY_SETS[device.keys];
                const held = this._heldKeyCodes;
                return out.set((held.has(keys.right) ? 1 : 0) - (held.has(keys.left) ? 1 : 0),
                    (held.has(keys.down) ? 1 : 0) - (held.has(keys.up) ? 1 : 0));
            }
            case 'gamepad': {
                const pad = this._getConnectedGamepads().find(pad => pad.index === device.index);
                if (!pad)
                    return out.set(0, 0);
                if (pad.leftStick.length() > GameInputManager.STICK_DEADZONE)
                    return out.copy(pad.leftStick);
                return out.set((pad.right ? 1 : 0) - (pad.left ? 1 : 0), (pad.down ? 1 : 0) - (pad.up ? 1 : 0));
            }
        }
    }

    public readConfirmJustPressed(device: InputDevice): boolean {
        switch (device.type) {
            case 'bot':
                return false;
            case 'any': {
                const excluded = device.excluded;
                if (!excluded?.length)
                    return this.confirmJustPressed();
                for (const keys of GameInputManager.KEY_SET_NAMES) {
                    const keySet: InputDevice = GameInputManager.KEYBOARD_DEVICES[keys];
                    if (!GameInputManager.isExcluded(keySet, excluded) && this.readConfirmJustPressed(keySet))
                        return true;
                }
                for (const pad of this._getConnectedGamepads()) {
                    const padDevice: InputDevice = this._getGamepadDevice(pad.index);
                    if (!GameInputManager.isExcluded(padDevice, excluded) && this.readConfirmJustPressed(padDevice))
                        return true;
                }
                return this._touchJustDown;
            }
            case 'keyboard':
                return GameInputManager.KEY_SETS[device.keys].confirm.some(code => this._justPressedKeyCodes.has(code));
            case 'gamepad': {
                const pad = this._getConnectedGamepads().find(pad => pad.index === device.index);
                return !!pad && (this._isGamepadButtonJustPressed(pad, GameInputManager.CONFIRM_BUTTON_INDEX)
                    || this._isGamepadButtonJustPressed(pad, GameInputManager.START_BUTTON_INDEX));
            }
        }
    }

    private _preUpdate(): void {
        this._updateSceneBinding();

        this._confirmJustDown = false;
        this._restartJustDown = false;
        this._pauseJustDown = this._isPausePending;
        this._isPausePending = false;
        [this._justPressedKeyCodes, this._pendingPressedKeyCodes] = [this._pendingPressedKeyCodes, this._justPressedKeyCodes];
        this._pendingPressedKeyCodes.clear();

        // Ignore the OS key repeat: SPACE may still be held from the previous scene
        if (this._shootKey && Input.Keyboard.JustDown(this._shootKey) && !this._shootKey.originalEvent?.repeat) {
            this._confirmJustDown = true;
        }

        if (this._restartKey && Input.Keyboard.JustDown(this._restartKey)) {
            this._restartJustDown = true;
        }

        for (const pad of this._getConnectedGamepads()) {
            const movedStick = pad.leftStick.length() > GameInputManager.STICK_DEADZONE;
            const pressedAction = pad.A || pad.left || pad.right || pad.up || pad.down
                || pad.isButtonDown(GameInputManager.START_BUTTON_INDEX);

            if (movedStick || pressedAction) {
                this._setInputType('gamepad');
                this._lastUsedDevice = this._getGamepadDevice(pad.index);
            }

            if (this._isGamepadButtonJustPressed(pad, GameInputManager.CONFIRM_BUTTON_INDEX)) {
                this._confirmJustDown = true;
            }

            // Start confirms on menus and pauses during a run, like on consoles
            if (this._isGamepadButtonJustPressed(pad, GameInputManager.START_BUTTON_INDEX)) {
                this._confirmJustDown = true;
                this._pauseJustDown = true;
            }
        }
    }

    private _postUpdate(): void {
        this._prevGamepadButtons.clear();

        for (const pad of this._getConnectedGamepads()) {
            for (let i = 0; i < pad.getButtonTotal(); i++) {
                this._prevGamepadButtons.set(this._getGamepadButtonKey(pad, i), pad.isButtonDown(i));
            }
        }

        this._touchJustDown = false;
        this._confirmJustDown = false;
        this._restartJustDown = false;
    }

    private _updateSceneBinding(): void {
        const nextScene = this._findActiveScene();

        if (nextScene === this._scene) {
            return;
        }

        this._unhookScene();

        if (nextScene) {
            this._hookScene(nextScene);
        }
    }

    private _findActiveScene(): Scene | null {
        const scenes = this.game.scene.getScenes(true, true) as Scene[];

        for (const scene of scenes) {
            if (scene.sys.settings.key !== GameConstants.SceneKeys.MAIN_UI) {
                return scene;
            }
        }

        return null;
    }

    private _hookScene(scene: Scene): void {
        this._scene = scene;
        this._clearTouch();

        // A restarted scene drops its input listeners: hook it again on the next step
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this._unhookScene, this);

        const keyboard = scene.input.keyboard;
        if (keyboard) {
            this._leftKey = keyboard.addKey(Input.Keyboard.KeyCodes.LEFT);
            this._rightKey = keyboard.addKey(Input.Keyboard.KeyCodes.RIGHT);
            this._upKey = keyboard.addKey(Input.Keyboard.KeyCodes.UP);
            this._downKey = keyboard.addKey(Input.Keyboard.KeyCodes.DOWN);
            this._shootKey = keyboard.addKey(Input.Keyboard.KeyCodes.SPACE);
            this._restartKey = keyboard.addKey(Input.Keyboard.KeyCodes.R);

            keyboard.on(Input.Keyboard.Events.ANY_KEY_DOWN, this._onAnyKeyDown, this);
            keyboard.on(Input.Keyboard.Events.ANY_KEY_UP, this._onAnyKeyUp, this);
        }

        scene.input.on(Input.Events.POINTER_DOWN, this._onPointerDown, this);
        scene.input.on(Input.Events.POINTER_DOWN_OUTSIDE, this._onPointerDown, this);
        scene.input.on(Input.Events.POINTER_MOVE, this._onPointerMove, this);
        scene.input.on(Input.Events.POINTER_UP, this._onPointerUp, this);
        scene.input.on(Input.Events.POINTER_UP_OUTSIDE, this._onPointerUp, this);

        if (scene.input.gamepad) {
            scene.input.gamepad.on(Input.Gamepad.Events.CONNECTED, this._onGamepadConnected, this);
            scene.input.gamepad.on(Input.Gamepad.Events.DISCONNECTED, this._onGamepadDisconnected, this);
        }
    }

    private _unhookScene(): void {
        if (!this._scene) {
            return;
        }

        const keyboard = this._scene.input.keyboard;
        if (keyboard) {
            keyboard.off(Input.Keyboard.Events.ANY_KEY_DOWN, this._onAnyKeyDown, this);
            keyboard.off(Input.Keyboard.Events.ANY_KEY_UP, this._onAnyKeyUp, this);

            if (this._leftKey) keyboard.removeKey(this._leftKey, true);
            if (this._rightKey) keyboard.removeKey(this._rightKey, true);
            if (this._upKey) keyboard.removeKey(this._upKey, true);
            if (this._downKey) keyboard.removeKey(this._downKey, true);
            if (this._shootKey) keyboard.removeKey(this._shootKey, true);
            if (this._restartKey) keyboard.removeKey(this._restartKey, true);
        }

        this._scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this._unhookScene, this);
        this._scene.input.off(Input.Events.POINTER_DOWN, this._onPointerDown, this);
        this._scene.input.off(Input.Events.POINTER_DOWN_OUTSIDE, this._onPointerDown, this);
        this._scene.input.off(Input.Events.POINTER_MOVE, this._onPointerMove, this);
        this._scene.input.off(Input.Events.POINTER_UP, this._onPointerUp, this);
        this._scene.input.off(Input.Events.POINTER_UP_OUTSIDE, this._onPointerUp, this);

        if (this._scene.input.gamepad) {
            this._scene.input.gamepad.off(Input.Gamepad.Events.CONNECTED, this._onGamepadConnected, this);
            this._scene.input.gamepad.off(Input.Gamepad.Events.DISCONNECTED, this._onGamepadDisconnected, this);
        }

        this._scene = null;
        this._leftKey = null;
        this._rightKey = null;
        this._upKey = null;
        this._downKey = null;
        this._shootKey = null;
        this._restartKey = null;
        this._heldKeyCodes.clear();
        this._clearTouch();
    }

    private _onAnyKeyDown(event: KeyboardEvent): void {
        this._heldKeyCodes.add(event.code);
        if (!event.repeat)
            this._pendingPressedKeyCodes.add(event.code);
        for (const keys of GameInputManager.KEY_SET_NAMES) {
            const keySet = GameInputManager.KEY_SETS[keys];
            if (event.code === keySet.left || event.code === keySet.right || event.code === keySet.up
                || event.code === keySet.down || keySet.confirm.includes(event.code))
                this._lastUsedDevice = GameInputManager.KEYBOARD_DEVICES[keys];
        }
        // Escape by position, P by character: P moves between layouts
        if (!event.repeat && (event.code === 'Escape' || event.key.toLowerCase() === 'p'))
            this._isPausePending = true;
        this._setInputType('keyboard');
    }

    private _onAnyKeyUp(event: KeyboardEvent): void {
        this._heldKeyCodes.delete(event.code);
    }

    private _onPointerDown(pointer: Phaser.Input.Pointer): void {
        if (!pointer.wasTouch) {
            return;
        }

        this._touchJustDown = true;
        this._setInputType('touch');

        if (this._touchPointerId !== -1) {
            return;
        }

        this._touchPointerId = pointer.id;
        this._touchOrigin.set(pointer.x, pointer.y);
        this._touchDirection.set(0, 0);
    }

    private _onPointerMove(pointer: Phaser.Input.Pointer): void {
        if (pointer.id !== this._touchPointerId) {
            return;
        }

        this._touchDirection.set(pointer.x - this._touchOrigin.x, pointer.y - this._touchOrigin.y);
        if (this._touchDirection.length() < GameInputManager.TOUCH_DEADZONE) {
            this._touchDirection.set(0, 0);
        }
    }

    private _onPointerUp(pointer: Phaser.Input.Pointer): void {
        if (pointer.id === this._touchPointerId) {
            this._clearTouch();
        }
    }

    private _clearTouch(): void {
        this._touchPointerId = -1;
        this._touchDirection.set(0, 0);
    }

    private _onGamepadConnected(pad: Phaser.Input.Gamepad.Gamepad): void {
        this.game.events.emit('gamepad-connected', pad);
    }

    private _onGamepadDisconnected(pad: Phaser.Input.Gamepad.Gamepad): void {
        this.game.events.emit('gamepad-disconnected', pad);
    }

    private _setInputType(type: InputType): void {
        if (this._activeInputType === type) {
            return;
        }

        this._activeInputType = type;

        if (type !== 'touch') {
            this._clearTouch();
        }

        this.game.events.emit('input-type-changed', this._activeInputType);
    }

    private _getConnectedGamepads(): Phaser.Input.Gamepad.Gamepad[] {
        if (!this._scene?.input.gamepad) {
            return [];
        }

        return this._scene.input.gamepad.getAll().filter((pad) => pad.connected);
    }

    // One object per pad, so devices compare and store without allocating every frame
    private _getGamepadDevice(index: number): InputDevice {
        let device: InputDevice | undefined = this._gamepadDevices.get(index);
        if (!device) {
            device = {type: 'gamepad', index};
            this._gamepadDevices.set(index, device);
        }
        return device;
    }

    private static isExcluded(device: InputDevice, excluded: readonly InputDevice[]): boolean {
        for (const other of excluded) {
            if (isSameDevice(device, other))
                return true;
        }
        return false;
    }

    private _getGamepadButtonKey(pad: Phaser.Input.Gamepad.Gamepad, buttonIndex: number): string {
        return `${pad.index}:${buttonIndex}`;
    }

    private _isGamepadButtonJustPressed(pad: Phaser.Input.Gamepad.Gamepad, buttonIndex: number): boolean {
        const key = this._getGamepadButtonKey(pad, buttonIndex);
        const isDown = pad.isButtonDown(buttonIndex);
        const wasDown = this._prevGamepadButtons.get(key) ?? false;

        return isDown && !wasDown;
    }

    public get moveDirection(): Phaser.Math.Vector2 {
        this._moveDirection.set(0, 0);

        const held = this._heldKeyCodes;
        if (this._leftKey?.isDown || held.has(GameInputManager.MOVE_LEFT_CODE)) this._moveDirection.x -= 1;
        if (this._rightKey?.isDown || held.has(GameInputManager.MOVE_RIGHT_CODE)) this._moveDirection.x += 1;
        if (this._upKey?.isDown || held.has(GameInputManager.MOVE_UP_CODE)) this._moveDirection.y -= 1;
        if (this._downKey?.isDown || held.has(GameInputManager.MOVE_DOWN_CODE)) this._moveDirection.y += 1;

        if (this._moveDirection.lengthSq() === 0) {
            this._moveDirection.copy(this._touchDirection);
        }

        for (const pad of this._getConnectedGamepads()) {
            if (this._moveDirection.lengthSq() > 0) {
                break;
            }

            if (pad.leftStick.length() > GameInputManager.STICK_DEADZONE) {
                this._moveDirection.copy(pad.leftStick);
            } else {
                this._moveDirection.set((pad.right ? 1 : 0) - (pad.left ? 1 : 0), (pad.down ? 1 : 0) - (pad.up ? 1 : 0));
            }
        }

        return this._moveDirection;
    }

    public confirmJustPressed(): boolean {
        return this._confirmJustDown || this._touchJustDown;
    }

    public restartJustPressed(): boolean {
        return this._restartJustDown;
    }

    public pauseJustPressed(): boolean {
        return this._pauseJustDown;
    }

    public get activeInputType(): InputType {
        return this._activeInputType;
    }

    public get isGamepadConnected(): boolean {
        return this.gamepadCount > 0;
    }

    public getGamepad(index: number): Phaser.Input.Gamepad.Gamepad | null {
        return this._scene?.input.gamepad?.getPad(index) ?? null;
    }

    public get gamepadCount(): number {
        return this._scene?.input.gamepad?.total ?? 0;
    }

    destroy(): void {
        this._unhookScene();

        this.game.events.off(Phaser.Core.Events.STEP, this._preUpdate, this);
        this.game.events.off(Phaser.Core.Events.POST_STEP, this._postUpdate, this);

        super.destroy();

        console.log('[GameInputManager] Destroyed');
    }
}

class DeviceInput implements PlayerInput {
    private readonly _moveDirection = new Phaser.Math.Vector2();

    constructor(public readonly device: InputDevice, private readonly _manager: GameInputManager) {
    }

    public get moveDirection(): Phaser.Math.Vector2 {
        return this._manager.readMoveDirection(this.device, this._moveDirection);
    }

    public confirmJustPressed(): boolean {
        return this._manager.readConfirmJustPressed(this.device);
    }
}
