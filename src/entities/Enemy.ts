import type {BulletData} from '../gameData/BulletData.ts';
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";

export default class Enemy extends Entity {
    private static readonly KNOCKBACK_SPEED: number = 0.9; // px/ms
    private static readonly KNOCKBACK_DECAY: number = 0.012; // per ms

    private readonly _bulletData: BulletData = {
        scale: 1.5,
        texture: "laserRed03",
        blink: false,
        speed: 512,
        range: 1200,
        damage: 1,
        pierce: 0,
        body: {
            radius: 5,
            offsetX: 32,
            offsetY: -0.5
        },
        fx: {
            flashTint: 0xffffff,
            sparkTints: [0xffffff, 0xff4400, 0xff9955],
            glowTints: [0xff2200, 0xffffff],
        }
    };
    private _shootTimerConfig: Phaser.Types.Time.TimerEventConfig;
    private _shootTimer: Phaser.Time.TimerEvent | undefined;
    private _target: Entity;
    private readonly _directionToTarget: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _knockback: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    public init(bulletsGroup: Phaser.Physics.Arcade.Group, target: Entity) {
        this._target = target;

        this.addComponent(new Health(1, this));
        this.addComponent(new Movement(0.2));
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));
        // Chasers don't shoot for now
        this.getComponent(Weapon)!.enabled = false;

        // Listen once per enemy, not on every enable(): pooled enemies are reused many times
        const health = this.getComponent(Health);
        // Stop overlapping during the hit flash, or the same hit counts on every frame
        health?.on(Health.DEATH_START_EVENT, () => {
            this.arcadeBody.setEnable(false);
        });
        health?.on(Health.DEATH_EVENT, () => {
            this.disable();
        });

        // Only enemies with an enabled weapon shoot
        if (this.getComponent(Weapon)?.enabled) {
            this._shootTimerConfig = {
                delay: Phaser.Math.Between(2000, 3000),
                callback: this.shoot,
                callbackScope: this,
                loop: true
            };
            this._shootTimer = this.scene.time.addEvent(this._shootTimerConfig);
        }

        // Create animation when enemy is about to shoot in the global animation manager
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

        this.arcadeBody.setCircle(this.displayWidth / 2);
    }

    public enable(x: number, y: number, health: number, speed: number) {
        this.enableBody(true, x, y, true, true);
        this._shootTimer?.reset(this._shootTimerConfig);

        this._knockback.reset();

        // Stats follow the difficulty curve, set again each time the enemy is reused from the pool
        this.getComponent(Health)?.resetMax(health);
        this.getComponent(Movement)?.setSpeed(speed);
    }

    public disable() {
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);

        this.disableBody(true, true);
        if (this._shootTimer)
            this._shootTimer.paused = true;
    }

    // Pushed along the shot, so a hit that doesn't kill still lands
    public playHit(directionX: number, directionY: number) {
        this._knockback.set(directionX, directionY).normalize().scale(Enemy.KNOCKBACK_SPEED);
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
        super.preUpdate(timeSinceLaunch, deltaTime)

        // Direction to the target: (target - me), normalized to keep only the direction
        this._directionToTarget.set(this._target.x - this.x, this._target.y - this.y).normalize();
        this.rotation = this._directionToTarget.angle();

        if (!this.isTinted)
            this.getComponent(Movement)?.move(this, this._directionToTarget, deltaTime);
        else
            this.getComponent(Movement)?.move(this, this._directionToTarget, deltaTime * 0.5);

        if (this._knockback.lengthSq() > 0.0001) {
            this.x += this._knockback.x * deltaTime;
            this.y += this._knockback.y * deltaTime;
            this._knockback.scale(Math.exp(-Enemy.KNOCKBACK_DECAY * deltaTime));
        }
    }
}