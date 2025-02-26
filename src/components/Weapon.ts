import {Physics, Sound} from 'phaser';
import {Bullet} from "../entities/Bullet";
import {Entity} from "../entities/Entity.ts";

export class Weapon implements IComponent {
    private readonly bullets: Physics.Arcade.Group;
    private readonly shootSound: Sound.BaseSound;
    private readonly bulletWidth: number;
    private readonly bulletHeight: number;
    private readonly bulletColor: number;
    private readonly bulletSpeed: number;

    constructor(bullets: Physics.Arcade.Group, shootSound: Sound.BaseSound, bulletWidth: number, bulletHeight: number, bulletColor: number, bulletSpeed: number) {
        this.bullets = bullets;
        this.shootSound = shootSound;
        this.bulletWidth = bulletWidth;
        this.bulletHeight = bulletHeight;
        this.bulletColor = bulletColor;
        this.bulletSpeed = bulletSpeed;
    }

    shoot(source: Entity) {
        const bullet: Bullet = this.bullets.get() as Bullet;
        if (bullet) {
            // Get forward vector of the source entity
            const forwardVectorX: number = Math.cos(source.rotation);
            const forwardVectorY: number = Math.sin(source.rotation);
            const bulletVelocityX: number = forwardVectorX * this.bulletSpeed;
            const bulletVelocityY: number = forwardVectorY * this.bulletSpeed;
            bullet.enable(source.x + forwardVectorX * source.arcadeBody.radius, source.y + forwardVectorY * source.arcadeBody.radius, this.bulletWidth, this.bulletHeight, this.bulletColor, bulletVelocityX, bulletVelocityY);
            this.shootSound.play();
        }
    }
}