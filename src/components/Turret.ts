import {GameObjects} from "phaser";
import IComponent from "./IComponent.ts";
import type {TurretData} from "../gameData/TurretData.ts";

// A sprite or an image: the in-game player and the home menu ship
type Ship = GameObjects.Image | GameObjects.Sprite;

// Turns on its own toward a target, on top of the ship
export default class Turret implements IComponent {
    public enabled: boolean = true;

    private static readonly FRAME: string = 'playerTurret';
    // The frame points right, its pivot is the center of the round base
    private static readonly BASE_RADIUS: number = 13;
    private static readonly TRACK_TURN_SPEED: number = 0.012; // rad/ms
    // With no target, it holds its aim for a moment, then slowly turns back to the ship's heading
    private static readonly RETURN_DELAY: number = 500; // ms
    private static readonly RETURN_TURN_SPEED: number = 0.004; // rad/ms
    private static readonly RECOIL_DISTANCE: number = 7;
    private static readonly RECOIL_DURATION: number = 120;
    private static readonly FLASH_FRAMES: string[] = ['muzzle_02', 'muzzle_03', 'muzzle_04', 'muzzle_05'];
    private static readonly FLASH_DURATION: number = 70;

    private readonly _ship: Ship;
    private readonly _image: GameObjects.Image;
    private readonly _flash: GameObjects.Image;
    private readonly _pivot: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _muzzle: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _recoil = {distance: 0};
    private _data: TurretData = {x: 0, y: 0};
    private _targetRotation: number | null = null;
    private _timeWithoutTarget: number = 0; // ms

    public get rotation(): number {
        return this._image.rotation;
    }

    constructor(ship: Ship) {
        this._ship = ship;
        this._image = ship.scene.add.image(0, 0, 'sprites', Turret.FRAME);
        this._image.setOrigin(Turret.BASE_RADIUS / this._image.width, 0.5).setRotation(ship.rotation);
        // Flame shapes point up, their base on the barrel's end
        this._flash = ship.scene.add.image(0, 0, 'shapes', Turret.FLASH_FRAMES[0])
            .setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    }

    // Kicks the barrel back and flashes at its end, tinted like the laser
    public playShot(flashTint: number) {
        const scene = this._ship.scene;
        scene.tweens.killTweensOf(this._recoil);
        scene.tweens.add({
            targets: this._recoil,
            distance: {from: Turret.RECOIL_DISTANCE, to: 0},
            duration: Turret.RECOIL_DURATION,
            ease: 'Quad.easeOut'
        });

        scene.tweens.killTweensOf(this._flash);
        this._flash.setFrame(Phaser.Utils.Array.GetRandom(Turret.FLASH_FRAMES)).setTint(flashTint)
            .setVisible(true).setAlpha(1).setScale(Phaser.Math.FloatBetween(0.6, 0.9));
        scene.tweens.add({
            targets: this._flash,
            alpha: 0,
            scaleX: 0.3,
            duration: Turret.FLASH_DURATION,
            ease: 'Quad.easeIn',
            onComplete: () => this._flash.setVisible(false)
        });
    }

    public setTurret(data: TurretData) {
        this._data = data;
    }

    // null: back to the ship's heading
    public aim(rotation: number | null) {
        this._targetRotation = rotation;
    }

    public isAimedAt(rotation: number, tolerance: number): boolean {
        return Math.abs(Phaser.Math.Angle.Wrap(rotation - this._image.rotation)) <= tolerance;
    }

    // Where lasers leave the barrel, in world space
    public getMuzzle(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
        const length: number = this._image.width - Turret.BASE_RADIUS;
        return out.set(this._image.x + Math.cos(this._image.rotation) * length,
            this._image.y + Math.sin(this._image.rotation) * length);
    }

    public hide() {
        this._image.setVisible(false);
        this._flash.setVisible(false);
    }

    public update(deltaTime: number) {
        if (this._targetRotation !== null) {
            this._timeWithoutTarget = 0;
            this._image.rotation = Phaser.Math.Angle.RotateTo(this._image.rotation, this._targetRotation,
                Turret.TRACK_TURN_SPEED * deltaTime);
        } else {
            this._timeWithoutTarget += deltaTime;
            if (this._timeWithoutTarget > Turret.RETURN_DELAY)
                this._image.rotation = Phaser.Math.Angle.RotateTo(this._image.rotation, this._ship.rotation,
                    Turret.RETURN_TURN_SPEED * deltaTime);
        }

        this._pivot.set(this._data.x, this._data.y).rotate(this._ship.rotation);
        const recoil: number = this._recoil.distance;
        this._image.setPosition(
            this._ship.x + this._pivot.x - Math.cos(this._image.rotation) * recoil,
            this._ship.y + this._pivot.y - Math.sin(this._image.rotation) * recoil)
            .setDepth(this._ship.depth + 1)
            // Blinks with the ship while it's invulnerable
            .setAlpha(this._ship.alpha);

        this.getMuzzle(this._muzzle);
        this._flash.setPosition(this._muzzle.x, this._muzzle.y).setRotation(this._image.rotation + Math.PI / 2)
            .setDepth(this._ship.depth + 2);
    }
}
