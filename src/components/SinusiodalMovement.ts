import Entity from "../entities/Entity.ts";
import IOComponent from "../components/IComponent.ts";

export default class SinusoidalMovement implements IOComponent {
    public enabled: boolean = true;

    private _speed: number = 0;
    private _amplitude: number;
    private _frequency: number;
    private _elapsedTime: number = 0;
    private _originX: number = 0;
    //amplitude to change the width of the wave, frequency to change how many waves are in a given time
    public constructor(speed?: number, amplitude: number = 48, frequency: number = 1) {
        if (speed) {
            this._speed = speed;
        }
        this._amplitude = amplitude;
        this._frequency = frequency;
    }

    public setSpeed(speed: number) {
        this._speed = speed;
    }

    public reset(entity: Entity) {
        this._originX = entity.x;
        this._elapsedTime = 0;
    }

    public moveSinusoidally(entity: Entity, deltaTime: number) {
        if (!this.enabled)
            return;

        this._elapsedTime += deltaTime / 1000;
        entity.y += this._speed * deltaTime;
        entity.x = this._originX + this._amplitude * Math.sin(this._elapsedTime * this._frequency * Math.PI * 2);
    }
}