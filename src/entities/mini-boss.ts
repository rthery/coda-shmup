import {Scene} from "phaser";
import Entity from "./Entity.ts";
import Health from "../components/Health.ts";
import Weapon from "../components/Weapon.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import SinusoidalMovement from "../components/SinusiodalMovement.ts";

export default class MiniBoss extends Entity {
    private static readonly HEALTH = 10;
    private static readonly DESCENT_SPEED = 0.05;

    private readonly _bulletData: BulletData = {
            width: 12,
            height: 12,
            color: 0xf25f5c,
            speed: 512,
            damage: 1,
    }; //change bullet data to match the spread shot later
    
    private _shootTimer: Phaser.Time.TimerEvent;
    private _movement: SinusoidalMovement;

    public constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'sprites', 'ufoRed');
        this.setScale(2);
    }

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.addComponent(new Health(MiniBoss.HEALTH, this));
        this._movement = new SinusoidalMovement(MiniBoss.DESCENT_SPEED);
        this.addComponent(this._movement);
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));

        const health = this.getComponent(Health);
        health?.on(Health.CHANGE_EVENT, () => {
            console.debug(`[MiniBoss] Health changed: ${health.current}/${health.max}`);
            this.setTintFill(0xffffff);

            if (health.current === 0) {
                this.disableBody();
            }

            this.scene.time.delayedCall(50, () => {
                this.clearTint();

                if (health.current === 0) {
                    this.disable('health depleted');
                }
            });
        });

        this.angle = 90;
        this.arcadeBody.setCircle(this.displayWidth / 2);

        if (!this.scene.anims.exists('ufoShoot')) {
            this.scene.anims.create({
                key: 'ufoShoot',
                frames: [
                    {key: 'sprites', frame: 'ufoRed'},
                    {key: 'sprites', frame: 'ufoRed-shoot0'},
                    {key: 'sprites', frame: 'ufoRed-shoot1'}
                ],
                frameRate: 4,
            });
        }

        this._shootTimer = this.scene.time.addEvent({
            delay: Phaser.Math.Between(2000, 3000),
            callback: this.shoot,
            callbackScope: this,
            loop: true,
            paused: true
        });

        this.enable(this.x, this.y);
    }

    public enable(x: number, y: number) {
        this.enableBody(true, x, y, true, true);
        this._movement.setSpeed(MiniBoss.DESCENT_SPEED);
        this._movement.reset(this);
        const health = this.getComponent(Health);
        health?.heal(health.max, false);
        console.debug(`[MiniBoss] Enabled at (${this.x.toFixed(1)}, ${this.y.toFixed(1)}), HP ${health?.current}/${health?.max}`);
        this._shootTimer.reset({
            delay: Phaser.Math.Between(2000, 3000),
            callback: this.shoot,
            callbackScope: this,
            loop: true
        });
    }

    public takeBulletDamage(incomingDamage: number) {
        const health = this.getComponent(Health);
        if (!health) {
            console.error('[MiniBoss] Cannot apply bullet damage: Health component is missing');
            return;
        }

        const appliedDamage = Math.min(incomingDamage, 1);
        console.debug(`[MiniBoss] Bullet hit: incoming=${incomingDamage}, applied=${appliedDamage}, HP before=${health.current}/${health.max}`);
        health.damage(appliedDamage);
        console.debug(`[MiniBoss] HP after hit=${health.current}/${health.max}`);
    }

    public disable(reason: string = 'unspecified') {
        console.warn(`[MiniBoss] Disabled: reason=${reason}, HP=${this.getComponent(Health)?.current}, y=${this.y.toFixed(1)}`);
        console.trace('[MiniBoss] Disable call stack');
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);

        this.disableBody(true, true);
        this._shootTimer.paused = true;
    }

    private shoot() {
        this.play('ufoShoot');
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.setTexture('sprites', 'ufoRed');
            this.getComponent(Weapon)?.shoot(this);
            this.scene.sound.play('sfx_laser2');
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable('left screen');
            return;
        }

        const movementDelta = this.isTinted ? deltaTime * 0.5 : deltaTime;
        this._movement.moveSinusoidally(this, movementDelta);
    }
}
