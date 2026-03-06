import Entity from "../entities/Entity.ts";
import Enemy from "../entities/Enemy.ts";
import IComponent from "./IComponent.ts";

export default class Movement implements IComponent {
    public enabled: boolean = true;

    private _speed: number = 0;

    public get speed(): number {
        return this._speed;
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

    public moveSinusoidally(enemy: Enemy, deltaTime: number, amplitude: number, frequency: number) {
        if(!this.enabled)
            return;
        let internTimer: number = enemy.getInterTimer();
        let startX: number = enemy.getStartX();

        internTimer += deltaTime;
        enemy.y += this._speed * deltaTime;
        
        enemy.x = startX + amplitude * Math.sin(internTimer * frequency);

        enemy.setInternTimer(internTimer);
        enemy.setStartX(startX);
    }
}