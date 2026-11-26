import {Input, Plugins, Scene} from 'phaser';
import GameConstants from "../GameConstants.ts";

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
    // Physical key positions, not characters: WASD on a US keyboard, ZQSD on AZERTY
    private static readonly MOVE_LEFT_CODE = 'KeyA';
    private static readonly MOVE_RIGHT_CODE = 'KeyD';
    private static readonly MOVE_UP_CODE = 'KeyW';
    private static readonly MOVE_DOWN_CODE = 'KeyS';
    // Arrows and their WASD positions, with the axis sign each one moves toward
    private static readonly AXIS_SIGNS: Record<string, { axis: 'x' | 'y', sign: number }> = {
        ArrowLeft: {axis: 'x', sign: -1}, KeyA: {axis: 'x', sign: -1},
        ArrowRight: {axis: 'x', sign: 1}, KeyD: {axis: 'x', sign: 1},
        ArrowUp: {axis: 'y', sign: -1}, KeyW: {axis: 'y', sign: -1},
        ArrowDown: {axis: 'y', sign: 1}, KeyS: {axis: 'y', sign: 1},
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
    // When both directions of an axis are held, the last one pressed wins instead of cancelling out:
    // rolling from Up to Down would otherwise brake the ship for the overlap
    private readonly _lastPressedSign = {x: 0, y: 0};

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

    constructor(pluginManager: Plugins.PluginManager) {
        super(pluginManager);

        this.game.events.on(Phaser.Core.Events.STEP, this._preUpdate, this);
        this.game.events.on(Phaser.Core.Events.POST_STEP, this._postUpdate, this);
        // Key ups are lost while the window is unfocused
        this.game.events.on(Phaser.Core.Events.BLUR, () => this._heldKeyCodes.clear());

        console.log('[GameInputManager] Initialized');
    }

    private _preUpdate(): void {
        this._updateSceneBinding();

        this._confirmJustDown = false;
        this._restartJustDown = false;
        this._pauseJustDown = this._isPausePending;
        this._isPausePending = false;

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
        const axisSign = GameInputManager.AXIS_SIGNS[event.code];
        if (axisSign && !event.repeat)
            this._lastPressedSign[axisSign.axis] = axisSign.sign;
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
        this._moveDirection.set(
            GameInputManager.resolveAxis(!!this._leftKey?.isDown || held.has(GameInputManager.MOVE_LEFT_CODE),
                !!this._rightKey?.isDown || held.has(GameInputManager.MOVE_RIGHT_CODE), this._lastPressedSign.x),
            GameInputManager.resolveAxis(!!this._upKey?.isDown || held.has(GameInputManager.MOVE_UP_CODE),
                !!this._downKey?.isDown || held.has(GameInputManager.MOVE_DOWN_CODE), this._lastPressedSign.y));

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

    private static resolveAxis(isNegativeHeld: boolean, isPositiveHeld: boolean, lastPressedSign: number): number {
        if (isNegativeHeld && isPositiveHeld)
            return lastPressedSign;
        return (isPositiveHeld ? 1 : 0) - (isNegativeHeld ? 1 : 0);
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
