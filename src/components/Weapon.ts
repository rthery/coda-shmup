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

        const bullet: Bullet = this._bullets.get() as Bullet;
        if (bullet) {
            // Get forward vector of the source entity
            const sourceForward: Phaser.Math.Vector2 = new Phaser.Math.Vector2(1, 0).rotate(source.rotation);
            const bulletVelocity: Phaser.Math.Vector2 = sourceForward.clone().scale(this._bulletData.speed);
            bullet.enable(source.x + sourceForward.x * source.arcadeBody.radius, source.y + sourceForward.y * source.arcadeBody.radius,
                bulletVelocity.x, bulletVelocity.y, this._bulletData);

            // Maths way
            // const forwardVectorX: number = Math.cos(source.rotation);
            // const forwardVectorY: number = Math.sin(source.rotation);
            // const bulletVelocityX: number = forwardVectorX * this._bulletData.speed;
            // const bulletVelocityY: number = forwardVectorY * this._bulletData.speed;
            // bullet.enable(source.x + forwardVectorX * source.arcadeBody.radius, source.y + forwardVectorY * source.arcadeBody.radius,
            //     bulletVelocityX, bulletVelocityY, this._bulletData);
        }
    }

    //spreadhost logic here
    public shootSpread(source: Entity, spreadAngle: number, numBullets: number, angleOffset: number = 0) {
        if (!this.enabled)
            return;
        
        if (!this._bullets || numBullets < 1)
            return;

        const angleStep = numBullets > 1 ? spreadAngle / (numBullets - 1) : 0;
        const startAngle = source.rotation + angleOffset - spreadAngle / 2;

        for (let i = 0; i < numBullets; i++) {
            const bullet: Bullet = this._bullets.get() as Bullet;
            if (bullet) {
                const bulletAngle = startAngle + i * angleStep;
                const bulletVelocityX = Math.cos(bulletAngle) * this._bulletData.speed;
                const bulletVelocityY = Math.sin(bulletAngle) * this._bulletData.speed;

                bullet.enable(source.x + Math.cos(bulletAngle) * source.arcadeBody.radius,
                    source.y + Math.sin(bulletAngle) * source.arcadeBody.radius,
                    bulletVelocityX, bulletVelocityY, this._bulletData);
            }
        }
    }

    public shootRadial(source: Entity, numBullets: number, rotation: number = 0) {
        if (!this.enabled || !this._bullets || numBullets < 1)
            return;

        const angleStep = Math.PI * 2 / numBullets;
        for (let i = 0; i < numBullets; i++) {
            const bullet = this._bullets.get() as Bullet;
            if (!bullet)
                continue;

            this.fireAtAngle(source, bullet, i * angleStep + rotation);
        }
    }

    private fireAtAngle(source: Entity, bullet: Bullet, angle: number) {
        const velocityX = Math.cos(angle) * this._bulletData.speed;
        const velocityY = Math.sin(angle) * this._bulletData.speed;

        bullet.enable(
            source.x + Math.cos(angle) * source.arcadeBody.radius,
            source.y + Math.sin(angle) * source.arcadeBody.radius,
            velocityX,
            velocityY,
            this._bulletData
        );
    }

    public shootBeam(source: Entity, beamData?: BulletData, angle: number = source.rotation) {
        if (!this.enabled || !this._bullets)
            return;

        const bullet = this._bullets.get() as Bullet;
        if (!bullet)
            return;

        const data: BulletData = beamData ?? {
            width: 8,
            height: 220,
            color: 0x66ffff,
            speed: 1280,
            damage: 2
        };
        const sourceForward = new Phaser.Math.Vector2(1, 0).rotate(angle);
        const velocity = sourceForward.clone().scale(data.speed);

        bullet.enable(
            source.x + sourceForward.x * source.arcadeBody.radius,
            source.y + sourceForward.y * source.arcadeBody.radius,
            velocity.x,
            velocity.y,
            data
        );
    }

    public shootWithData(source: Entity, data: BulletData, angle: number = source.rotation) {
        if (!this.enabled || !this._bullets)
            return;

        const bullet = this._bullets.get() as Bullet;
        if (!bullet)
            return;

        const direction = new Phaser.Math.Vector2(1, 0).rotate(angle);
        const velocity = direction.clone().scale(data.speed);

        bullet.enable(
            source.x + direction.x * source.arcadeBody.radius,
            source.y + direction.y * source.arcadeBody.radius,
            velocity.x,
            velocity.y,
            data
        );
    }

    public shootRadialWithData(source: Entity, numBullets: number, data: BulletData, rotation: number = 0) {
        if (!this.enabled || !this._bullets || numBullets < 1)
            return;

        const angleStep = Math.PI * 2 / numBullets;
        for (let i = 0; i < numBullets; i++) {
            const bullet = this._bullets.get() as Bullet;
            if (!bullet)
                continue;

            this.fireAtAngleWithData(source, bullet, i * angleStep + rotation, data);
        }
    }

    private fireAtAngleWithData(source: Entity, bullet: Bullet, angle: number, data: BulletData) {
        const velocityX = Math.cos(angle) * data.speed;
        const velocityY = Math.sin(angle) * data.speed;

        bullet.enable(
            source.x + Math.cos(angle) * source.arcadeBody.radius,
            source.y + Math.sin(angle) * source.arcadeBody.radius,
            velocityX,
            velocityY,
            data
        );
    }
}