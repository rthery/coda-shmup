import Entity from "../entities/Entity.ts";
import IComponent from "./IComponent.ts";

export default class Movement implements IComponent {
    public enabled: boolean = true;

    private _speed: number = 0;
    private _acceleration: number = 0;
    private _deceleration: number = 0;
    private readonly _velocity: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _velocityChange: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    public get velocity(): Phaser.Math.Vector2 {
        return this._velocity;
    }

    public constructor(speed?: number) {
        if (speed) {
            this._speed = speed;
        }
    }

    public setSpeed(speed: number) {
        this._speed = speed;
    }

    public setAcceleration(acceleration: number, deceleration: number) {
        this._acceleration = acceleration;
        this._deceleration = deceleration;
    }

    public moveHorizontally(entity: Entity, deltaTime: number) {
        if (!this.enabled)
            return;

        entity.x += this._speed * deltaTime;
    }

    public moveVertically(entity: Entity, deltaTime: number) {
        if (!this.enabled)
            return;

        entity.y += this._speed * deltaTime;
    }

    // direction must be normalized, or diagonals go faster
    public move(entity: Entity, direction: Phaser.Math.Vector2, deltaTime: number) {
        if (!this.enabled)
            return;

        entity.x += direction.x * this._speed * deltaTime;
        entity.y += direction.y * this._speed * deltaTime;
    }

    // Velocity tends toward direction * speed instead of jumping to it: direction is normalized, or zero to brake
    public accelerateInDirection(entity: Entity, direction: Phaser.Math.Vector2, deltaTime: number) {
        if (!this.enabled)
            return;

        const isBraking = direction.lengthSq() == 0;
        const maxChange = (isBraking ? this._deceleration : this._acceleration) * deltaTime;

        this._velocityChange.copy(direction).scale(this._speed).subtract(this._velocity);
        if (this._velocityChange.length() > maxChange)
            this._velocityChange.setLength(maxChange);
        this._velocity.add(this._velocityChange);

        entity.x += this._velocity.x * deltaTime;
        entity.y += this._velocity.y * deltaTime;
    }

    public stop() {
        this._velocity.set(0, 0);
    }
}