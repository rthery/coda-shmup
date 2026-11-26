import {GameObjects, Physics, Tweens} from "phaser";
import type {PickupData} from "../gameData/PickupsData.ts";

// A rare drop the player has to fly to: it isn't pulled by the magnet, and it vanishes after a while
export default class Pickup extends Physics.Arcade.Sprite {
    private static readonly LIFETIME: number = 20000; // ms
    // Blinks for this long before vanishing
    private static readonly WARNING_DURATION: number = 5000; // ms
    private static readonly WARNING_BLINK_PERIOD: number = 250; // ms
    private static readonly SCALE: number = 1.4;
    private static readonly GLOW_SCALE: number = 0.9;
    private static readonly GLOW_ALPHA: number = 0.6;
    private static readonly BOB_HEIGHT: number = 6; // px
    private static readonly SPIN_SPEED: number = 0.0008; // rad/ms

    private _data: PickupData;
    private _glow: GameObjects.Image;
    private _pulseTween: Tweens.Tween;
    private _age: number = 0; // ms
    private _baseY: number = 0;

    public get pickupData(): PickupData {
        return this._data;
    }

    public init() {
        this.scene.physics.add.existing(this);
        (this.body as Physics.Arcade.Body).allowGravity = false;

        this._glow = this.scene.add.image(0, 0, 'shapes', 'light_03')
            .setBlendMode(Phaser.BlendModes.ADD).setScale(Pickup.GLOW_SCALE);
        this._pulseTween = this.scene.tweens.add({
            targets: this._glow,
            scale: {from: Pickup.GLOW_SCALE * 0.8, to: Pickup.GLOW_SCALE * 1.2},
            alpha: {from: Pickup.GLOW_ALPHA * 0.6, to: Pickup.GLOW_ALPHA},
            duration: 500,
            ease: 'Sine.easeInOut',
            repeat: -1,
            yoyo: true
        }).pause();
    }

    public setDepth(depth: number): this {
        super.setDepth(depth);
        this._glow?.setDepth(depth - 1);
        return this;
    }

    public enable(x: number, y: number, data: PickupData) {
        this._data = data;
        this._age = 0;
        this._baseY = y;
        this.setTexture('sprites', data.texture).setScale(Pickup.SCALE).setAlpha(1).setRotation(0);
        this.enableBody(true, x, y, true, true);
        (this.body as Physics.Arcade.Body).setCircle(this.width / 2);

        this._glow.setPosition(x, y).setTint(Phaser.Display.Color.HexStringToColor(data.glowTint).color)
            .setVisible(true);
        this._pulseTween.restart();

        // Pops out of the wreck
        this.scene.tweens.add({targets: this, scale: {from: 0, to: Pickup.SCALE}, duration: 300, ease: 'Back.easeOut'});
    }

    public disable() {
        this.disableBody(true, true);
        this._glow.setVisible(false);
        this._pulseTween.pause();
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);
        if (!this.active)
            return;

        this._age += deltaTime;
        if (this._age >= Pickup.LIFETIME) {
            this.disable();
            return;
        }

        this.y = this._baseY + Math.sin(this._age / 300) * Pickup.BOB_HEIGHT;
        this.rotation = Math.sin(this._age * Pickup.SPIN_SPEED) * 0.3;
        this._glow.setPosition(this.x, this.y);

        const isWarning: boolean = this._age > Pickup.LIFETIME - Pickup.WARNING_DURATION;
        const isBlinkOff: boolean = isWarning && Math.floor(this._age / Pickup.WARNING_BLINK_PERIOD) % 2 === 1;
        this.setAlpha(isBlinkOff ? 0.25 : 1);
    }
}
