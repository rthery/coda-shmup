import Entity from "../entities/Entity.ts";
import IComponent from "./IComponent.ts";

// Horizontal sinusoidal movement around an anchor line: x = anchorX + amplitude * sin(2 PI * frequency * t + phase)
// The vertical movement is left to the Movement component.
export default class SineMovement implements IComponent {
    public enabled: boolean = true;

    private readonly _frequency: number;
    private readonly _phase: number;
    private _amplitude: number;
    private _anchorX: number = 0;
    private _elapsed: number = 0;

    // frequency in Hz, phase in degrees
    public constructor(amplitude: number, frequency: number, phase: number = 0) {
        this._amplitude = amplitude;
        this._frequency = frequency;
        this._phase = Phaser.Math.DegToRad(phase);
    }

    // Restart the oscillation, e.g. when an enemy is reused from the pool
    public reset(anchorX: number, amplitude: number = this._amplitude) {
        this._anchorX = anchorX;
        this._amplitude = amplitude;
        this._elapsed = 0;
    }

    // Horizontal position for the current time of the oscillation
    public getX(): number {
        const angle: number = this._phase + Math.PI * 2 * this._frequency * (this._elapsed / 1000);
        return this._anchorX + this._amplitude * Math.sin(angle);
    }

    // deltaTime in milliseconds, like the other components
    public moveHorizontally(entity: Entity, deltaTime: number) {
        if (!this.enabled)
            return;

        this._elapsed += deltaTime;
        entity.x = this.getX();
    }
}