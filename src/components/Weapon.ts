import {Physics} from 'phaser';
import {BulletData} from "../gameData/BulletData.ts";
import type {SpreadShotData} from "../gameData/SpreadShotData.ts";
import Bullet from "../entities/Bullet.ts";
import Entity from "../entities/Entity.ts";
import SpreadUtils from "../utils/SpreadUtils.ts";
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

        this.fire(source, source.rotation);
    }

    // Fire several bullets at once, as a fan centered on the forward direction of the source entity
    public shootSpread(source: Entity, spread: SpreadShotData) {
        if (!this.enabled)
            return;

        if (!this._bullets)
            return;

        const angles: number[] = SpreadUtils.computeAngles(source.rotation, spread.count, Phaser.Math.DegToRad(spread.angle));
        for (const angle of angles) {
            this.fire(source, angle);
        }
    }

    // Fire one bullet from the source entity, in the direction given by angle (in radians)
    private fire(source: Entity, angle: number) {
        const bullet: Bullet = this._bullets.get() as Bullet;
        if (bullet) {
            // Get forward vector of the given direction
            const sourceForward: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0).rotate(angle);
            const bulletVelocity: Phaser.Math.Vector2 = sourceForward.clone().scale(this._bulletData.speed);
            bullet.enable(source.x + sourceForward.x * source.arcadeBody.radius, source.y + sourceForward.y * source.arcadeBody.radius,
                bulletVelocity.x, bulletVelocity.y, this._bulletData);

            // Maths way
            // const forwardVectorX: number = Math.cos(angle);
            // const forwardVectorY: number = Math.sin(angle);
            // const bulletVelocityX: number = forwardVectorX * this._bulletData.speed;
            // const bulletVelocityY: number = forwardVectorY * this._bulletData.speed;
            // bullet.enable(source.x + forwardVectorX * source.arcadeBody.radius, source.y + forwardVectorY * source.arcadeBody.radius,
            //     bulletVelocityX, bulletVelocityY, this._bulletData);
        }
    }
}