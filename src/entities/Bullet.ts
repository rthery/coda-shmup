import {GameObjects, Physics, Tweens} from "phaser";
import {BulletData} from "../gameData/BulletData.ts";
import GameConstants from "../GameConstants.ts";

export default class Bullet extends Physics.Arcade.Sprite {
    private _arcadeBody: Phaser.Physics.Arcade.Body;

    private _data : BulletData;
    private _tween: Tweens.Tween;
    private readonly _start: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _hitTargets: Set<GameObjects.GameObject> = new Set();
    private _pierceLeft: number = 0;

    public get bulletData(): BulletData {
        return this._data;
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
        this._start.set(x, y);

        this.setOrigin(1, 0.5);
        this.setTexture('sprites', data.texture);
        this.setScale(data.scale);

        this._arcadeBody.setVelocity(velocityX, velocityY);
        this._arcadeBody.setCircle(data.body.radius, data.body.offsetX, data.body.offsetY);
        this._data = data;
        this._pierceLeft = data.pierce;
        this._hitTargets.clear();

        // Rotate the bullet to face the direction it's moving
        this.setRotation(this._arcadeBody.velocity.angle());

        // Maths way
        // this.setRotation(Math.atan2(velocityY, velocityX));

        if (data.blink) {
            this._tween.restart();
        }
    }

    // False when the bullet already went through this target
    public registerHit(target: GameObjects.GameObject): boolean {
        if (this._hitTargets.has(target))
            return false;

        this._hitTargets.add(target);
        return true;
    }

    // Spends one pierce, false when none is left
    public pierce(): boolean {
        if (this._pierceLeft <= 0)
            return false;

        this._pierceLeft--;
        return true;
    }

    public disable() {
        this.disableBody(true, true);
        this._tween.pause();
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);

        // Recycle bullets past their range or when they leave the arena on any side
        if (Phaser.Math.Distance.Between(this._start.x, this._start.y, this.x, this.y) > this._data.range
            || this.x < -this.displayWidth || this.x > GameConstants.ARENA_WIDTH + this.displayWidth
            || this.y < -this.displayHeight || this.y > GameConstants.ARENA_HEIGHT + this.displayHeight) {
            this.disable();
        }
    }
}