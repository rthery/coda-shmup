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
    private static readonly CONFIRM_BUTTON_INDEX = 0;
    private static readonly START_BUTTON_INDEX = 9;

    private _scene: Scene | null = null;

    private _leftKey: Input.Keyboard.Key | null = null;
    private _rightKey: Input.Keyboard.Key | null = null;
    private _shootKey: Input.Keyboard.Key | null = null;
    private _restartKey: Input.Keyboard.Key | null = null;

    private _touchPointers = new Map<number, number>();
    private _touchLeft: boolean = false;
    private _touchRight: boolean = false;
    private _touchJustDown: boolean = false;
    private _isTouchDevice: boolean = false;

    private _confirmJustDown: boolean = false;
    private _restartJustDown: boolean = false;

    private _prevGamepadButtons = new Map<string, boolean>();
    private _activeInputType: InputType = 'keyboard';

    constructor(pluginManager: Plugins.PluginManager) {
        super(pluginManager);

        this.game.events.on(Phaser.Core.Events.STEP, this._preUpdate, this);
        this.game.events.on(Phaser.Core.Events.POST_STEP, this._postUpdate, this);

        console.log('[GameInputManager] Initialized');
    }

    private _preUpdate(): void {
        this._updateSceneBinding();

        this._confirmJustDown = false;
        this._restartJustDown = false;
        this._touchLeft = false;
        this._touchRight = false;

        for (const x of this._touchPointers.values()) {
            if (x < this.game.scale.width / 2) {
                this._touchLeft = true;
            } else {
                this._touchRight = true;
            }
        }

        if (this._shootKey && Input.Keyboard.JustDown(this._shootKey)) {
            this._confirmJustDown = true;
        }

        if (this._restartKey && Input.Keyboard.JustDown(this._restartKey)) {
            this._restartJustDown = true;
        }

        for (const pad of this._getConnectedGamepads()) {
            const movedHorizontally = Math.abs(pad.leftStick.x) > GameInputManager.STICK_DEADZONE;
            const pressedAction = pad.A || pad.left || pad.right || pad.isButtonDown(GameInputManager.START_BUTTON_INDEX);

            if (movedHorizontally || pressedAction) {
                this._setInputType('gamepad');
            }

            if (this._isGamepadButtonJustPressed(pad, GameInputManager.CONFIRM_BUTTON_INDEX)) {
                this._confirmJustDown = true;
            }

            if (this._isGamepadButtonJustPressed(pad, GameInputManager.START_BUTTON_INDEX)) {
                this._confirmJustDown = true;
                this._restartJustDown = true;
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
        this._touchPointers.clear();
        this._touchLeft = false;
        this._touchRight = false;

        const keyboard = scene.input.keyboard;
        if (keyboard) {
            this._leftKey = keyboard.addKey(Input.Keyboard.KeyCodes.LEFT);
            this._rightKey = keyboard.addKey(Input.Keyboard.KeyCodes.RIGHT);
            this._shootKey = keyboard.addKey(Input.Keyboard.KeyCodes.SPACE);
            this._restartKey = keyboard.addKey(Input.Keyboard.KeyCodes.R);

            keyboard.on(Input.Keyboard.Events.ANY_KEY_DOWN, this._onAnyKeyDown, this);
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

            if (this._leftKey) keyboard.removeKey(this._leftKey, true);
            if (this._rightKey) keyboard.removeKey(this._rightKey, true);
            if (this._shootKey) keyboard.removeKey(this._shootKey, true);
            if (this._restartKey) keyboard.removeKey(this._restartKey, true);
        }

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
        this._shootKey = null;
        this._restartKey = null;
        this._touchPointers.clear();
        this._touchLeft = false;
        this._touchRight = false;
    }

    private _onAnyKeyDown(): void {
        this._setInputType('keyboard');
    }

    private _onPointerDown(pointer: Phaser.Input.Pointer): void {
        if (!pointer.wasTouch) {
            return;
        }

        this._touchPointers.set(pointer.id, pointer.x);
        this._touchJustDown = true;
        this._isTouchDevice = true;
        this._setInputType('touch');
    }

    private _onPointerMove(pointer: Phaser.Input.Pointer): void {
        if (!pointer.wasTouch || !pointer.isDown) {
            return;
        }

        this._touchPointers.set(pointer.id, pointer.x);
    }

    private _onPointerUp(pointer: Phaser.Input.Pointer): void {
        if (!pointer.wasTouch) {
            return;
        }

        this._touchPointers.delete(pointer.id);
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
            this._isTouchDevice = false;
            this._touchPointers.clear();
            this._touchLeft = false;
            this._touchRight = false;
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

    public get movingLeft(): boolean {
        if (this._leftKey?.isDown) {
            return true;
        }

        if (this._touchLeft) {
            return true;
        }

        return this._getConnectedGamepads().some((pad) =>
            pad.left || pad.leftStick.x < -GameInputManager.STICK_DEADZONE
        );
    }

    public get movingRight(): boolean {
        if (this._rightKey?.isDown) {
            return true;
        }

        if (this._touchRight) {
            return true;
        }

        return this._getConnectedGamepads().some((pad) =>
            pad.right || pad.leftStick.x > GameInputManager.STICK_DEADZONE
        );
    }

    public get shooting(): boolean {
        if (this._shootKey?.isDown) {
            return true;
        }

        if (this._isTouchDevice) {
            return true;
        }

        return this._getConnectedGamepads().some((pad) => pad.A);
    }

    public confirmJustPressed(): boolean {
        return this._confirmJustDown || this._touchJustDown;
    }

    public restartJustPressed(): boolean {
        return this._restartJustDown;
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
