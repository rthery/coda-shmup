import {Physics} from 'phaser';
import {BulletData} from "../gameData/BulletData.ts";
import Bullet from "../entities/Bullet.ts";
import Entity from "../entities/Entity.ts";
import IComponent from "./IComponent.ts";

export default class Weapon implements IComponent {
    public enabled: boolean = true;

    private readonly _bullets: Physics.Arcade.Group;
    private readonly _bulletData: BulletData;

    constructor(bullets: Physics.Arcade.Group, bulletData: BulletData) {
        if (!bullets) {
            console.error("Weapon 'bullets' group cannot be null or undefined");
        }

        this._bullets = bullets;
        this._bulletData = bulletData;
    }

    public shoot(source: Entity) {
        if (!this.enabled)
            return;

        if (!this._bullets)
            return;

        const sourceForward: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0).rotate(source.rotation);
        this.fireInDirection(source, sourceForward);
    }

    public shootSpread(source: Entity, bulletCount: number, angleDegrees: number) {
        if (!this.enabled || !this._bullets || bulletCount <= 0) {
            return;
        }

        const forward = new Phaser.Math.Vector2(1, 0).rotate(source.rotation);
        if (bulletCount === 1) {
            this.fireInDirection(source, forward);
            return;
        }

        const spreadRadians = Phaser.Math.DegToRad(angleDegrees);
        const step = spreadRadians / (angleDegrees === 360 ? bulletCount : bulletCount - 1);
        const firstAngle = -spreadRadians / 2;

        for (let i = 0; i < bulletCount; i++) {
            this.fireInDirection(source, forward.clone().rotate(firstAngle + step * i));
        }
    }

    private fireInDirection(source: Entity, direction: Phaser.Math.Vector2) {
        const bullet: Bullet = this._bullets.get() as Bullet;
        if (!bullet) {
            return;
        }

        const bulletVelocity = direction.clone().scale(this._bulletData.speed);
        bullet.enable(
            source.x + direction.x * source.arcadeBody.radius,
            source.y + direction.y * source.arcadeBody.radius,
            bulletVelocity.x,
            bulletVelocity.y,
            this._bulletData
        );
    }
}