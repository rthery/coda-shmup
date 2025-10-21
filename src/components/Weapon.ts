import {Physics} from 'phaser';
import Bullet from "../entities/Bullet.ts";
import IComponent from "./IComponent.ts";

export default class Weapon implements IComponent {
    public enabled: boolean = true;

    private readonly _bullets: Physics.Arcade.Group;

    constructor(bullets: Physics.Arcade.Group) {
        if (!bullets) {
            console.error("Weapon 'bullets' group cannot be null or undefined");
        }

        this._bullets = bullets;
    }

    public shoot(x: number, y: number, width: number, height: number, color: number, velocityY: number) {
        if (!this.enabled)
            return;

        if (!this._bullets)
            return;

        const bullet: Bullet = this._bullets.get() as Bullet;
        if (bullet) {
            bullet.enable(x, y, width, height, color, velocityY);
        }
    }
}