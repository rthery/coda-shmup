import {GameObjects, Physics, Tweens} from "phaser";
import Player from "./Player.ts";

export default class XpGem extends Physics.Arcade.Sprite {
    private static readonly START_ATTRACT_SPEED: number = 0.4; // px/ms
    private static readonly ATTRACT_ACCELERATION: number = 0.004; // px/ms²
    private static readonly TRAIL_SPACING: number = 6; // px

    public readonly value: number = 1;

    private _target: Player;
    private _attracted: boolean = false;
    private _attractSpeed: number = 0;
    private _tween: Tweens.Tween;
    private _trailFX: GameObjects.Particles.ParticleEmitter;
    private readonly _directionToTarget: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    public init(target: Player, trailFX: GameObjects.Particles.ParticleEmitter) {
        this._target = target;
        this._trailFX = trailFX;
        this.setTexture('sprites', 'star_gold');

        this.scene.physics.add.existing(this);
        const arcadeBody = this.body as Physics.Arcade.Body;
        arcadeBody.allowGravity = false;
        arcadeBody.setCircle(this.width / 2);

        this._tween = this.scene.tweens.add({
            targets: this,
            scale: {from: 1.1, to: 1.4},
            duration: 400,
            ease: 'Sine.easeInOut',
            repeat: -1,
            yoyo: true
        }).pause();
    }

    public enable(x: number, y: number) {
        this.enableBody(true, x, y, true, true);
        this._attracted = false;
        this._attractSpeed = XpGem.START_ATTRACT_SPEED;
        this._tween.restart();
    }

    public disable() {
        this.disableBody(true, true);
        this._tween.pause();
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);

        if (!this.active || !this._target.active)
            return;

        // Once in the player's magnet radius, fly to the player faster and faster
        if (!this._attracted
            && Phaser.Math.Distance.Between(this.x, this.y, this._target.x, this._target.y) < this._target.magnetRadius) {
            this._attracted = true;
        }

        if (this._attracted) {
            this._attractSpeed += XpGem.ATTRACT_ACCELERATION * deltaTime;
            this._directionToTarget.set(this._target.x - this.x, this._target.y - this.y).normalize();
            const step: number = this._attractSpeed * deltaTime;

            // Fill the path covered this frame, so the trail has no gaps at high speed
            for (let distance = 0; distance < step; distance += XpGem.TRAIL_SPACING) {
                this._trailFX.emitParticleAt(this.x + this._directionToTarget.x * distance,
                    this.y + this._directionToTarget.y * distance);
            }

            this.x += this._directionToTarget.x * step;
            this.y += this._directionToTarget.y * step;
        }
    }
}
