import {Physics, Scene, Sound} from 'phaser';
import {Bullet} from "../entities/Bullet";

export class Weapon implements IComponent {
    private readonly bullets: Physics.Arcade.Group;
    private readonly shootSound: Sound.BaseSound;

    constructor(_scene: Scene, bullets: Physics.Arcade.Group, shootSound: Sound.BaseSound) {
        this.bullets = bullets;
        this.shootSound = shootSound;
    }

    shoot(x: number, y: number, width: number, height: number, color: number, velocityY: number) {
        const bullet: Bullet = this.bullets.get() as Bullet;
        if (bullet) {
            bullet.enable(x, y, width, height, color, velocityY);
            this.shootSound.play();
        }
    }
}