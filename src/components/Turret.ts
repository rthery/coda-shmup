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

    private readonly _ship: Ship;
    private readonly _image: GameObjects.Image;
    private readonly _pivot: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
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
        this._image.setPosition(this._ship.x + this._pivot.x, this._ship.y + this._pivot.y)
            .setDepth(this._ship.depth + 1)
            // Blinks with the ship while it's invulnerable
            .setAlpha(this._ship.alpha);
    }
}
