import {Physics, Tweens} from "phaser";
import {BulletData} from "../gameData/BulletData.ts";

export default class Bullet extends Physics.Arcade.Sprite {
    private _arcadeBody: Phaser.Physics.Arcade.Body;

    private _damage: number = 0;
    private _tween: Tweens.Tween;

    public get damage(): number {
        return this._damage;
    }

    public init() {
        this.scene.physics.add.existing(this);

        this._arcadeBody = this.body as Phaser.Physics.Arcade.Body;
        this._arcadeBody.allowGravity = false;
        this._arcadeBody.setFriction(0, 0);

        this._tween = this.scene.tweens.add(
            {
                targets: this,
                alpha: {from: 1, to: 0.6},
                duration: 100,
                ease: 'Power1',
                repeat: -1,
                yoyo: true
            }
        ).pause();
    }

    public enable(x: number, y: number, velocityX: number, velocityY: number, data: BulletData) {
        this.enableBody(true, x, y, true, true);

        this.setOrigin(1, 0.5);
        this.setTexture("sprites", data.texture);
        this.setScale(data.scale);

        this._arcadeBody.setVelocity(velocityX, velocityY);
        this._arcadeBody.setCircle(data.body.radius, data.body.offsetX, data.body.offsetY);
        this._damage = data.damage;

        // Rotate the bullet to face the direction it's moving
        this.setRotation(this._arcadeBody.velocity.angle());

        // Maths way
        // this.setRotation(Math.atan2(velocityY, velocityX));

        if (data.blink) {
            this._tween.restart();
        }
    }

    public disable() {
        this.disableBody(true, true);
        this._tween.pause();
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);

        if (this.y > this.scene.cameras.main.height + this.displayHeight || this.y < -this.displayHeight) {
            this.disable();
        }
    }
}