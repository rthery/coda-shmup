import Entity from "../entities/Entity.ts";
import IComponent from "./IComponent.ts";

export default class Movement implements IComponent {
    public enabled: boolean = true;

    private _speed: number = 0;

    private _sinTime: number = 0;

    private _baseX: number | null = null;

    private _maxAmplitude: number = 300;

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

   public resetSinusoidal(startX: number) {
        this._sinTime = 0;
        this._baseX = startX;
    }

    public moveSinusoidal(entity: Entity, deltaTime: number, amplitude: number = 400, frequency: number = 0.005) {
        if (!this.enabled)
            return;

        if (this._baseX === null) {
            this._baseX = entity.x;
        }

        // Amplitude can not be above 300 so it doesn't go off screen
        if (amplitude > this._maxAmplitude) {
            amplitude = 300;
        }

        this._sinTime += deltaTime;
        entity.y += this._speed * deltaTime;
        entity.x = this._baseX + Math.sin(this._sinTime * frequency) * amplitude;
    }
}
