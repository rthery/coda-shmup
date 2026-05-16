import Entity from "../entities/Entity.ts";
import IComponent from "./IComponent.ts";

export default class Movement implements IComponent {
    public enabled: boolean = true;

    private _speed: number = 0;
    private _elapsedTime: number = 0;
    private _startX: number | null = null;

    public get speed(): number {
        return this._speed;
    }

    public reset(entity: Entity) {
        this._elapsedTime = 0;
        this._startX = entity.x;
    }

    public constructor(speed?: number) {
        if (speed) {
            this._speed = speed;
        }
    }

    public setSpeed(speed: number) {
        this._speed = speed;
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

    public moveSinusoidally(entity: Entity, deltaTime: number, amplitude: number, frequency: number) {
        if(!this.enabled)
            return;
        if(this._startX === null) {
            this._startX = entity.x;
        }

        this._elapsedTime += deltaTime;
        entity.y += this._speed * deltaTime;
        
        entity.x = this._startX + amplitude * Math.sin(this._elapsedTime * frequency);

    }
}