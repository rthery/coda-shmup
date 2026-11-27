import type { BulletData } from '../gameData/BulletData.ts';
import type { EnemyShipsData, EnemyShipData } from '../gameData/EnemyShipsData.ts';
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";

export default class Enemy extends Entity {
    private readonly _bulletData: BulletData = {
        width: 20,
        height: 20,
        color: 0x00e676,
        speed: 752,
        damage: 1,
    };
    private _shootTimerConfig: Phaser.Types.Time.TimerEventConfig;
    private _shootTimer: Phaser.Time.TimerEvent;
    private _isSpecialEnemy: boolean = false;

    private _numberOfBullets: number = 1;
    private _shotRadius: number = 0;

    public init(bulletsGroup: Phaser.Physics.Arcade.Group, shipData?: EnemyShipData): void {
        const enemyShipsData = this.scene.cache.json.get('specialEnemy') as EnemyShipsData | undefined;
        const data: EnemyShipData | undefined = shipData ?? enemyShipsData?.enemies;

        if (!data) {
            return;
        }

        this._isSpecialEnemy = data.texture === 'merluche' || this.frame.name === 'merluche';
        this._numberOfBullets = data.body.numberOfBullets ?? 1;
        this._shotRadius = data.body.shotRadius ?? 0;

        this.angle = 90;

        this.addComponent(new Health(data.body.maxHealth ?? 1, this));
        this.addComponent(new Movement(data.movementSpeed));
        this.addComponent(new Weapon(bulletsGroup, { ...this._bulletData }));

        this.arcadeBody.setCircle(
            data.body.radius,
            data.body.offsetX,
            data.body.offsetY
        );

        const health = this.getComponent(Health);
        if (health) {
            health.removeAllListeners(Health.CHANGE_EVENT);
            health.on(Health.CHANGE_EVENT, () => {
                this.setTintFill(0xffffff);

                if (health.current === 0) {
                    this.disableBody();
                }

                this.scene.time.delayedCall(50, () => {
                    if (!this.scene || !this.active) {
                        return;
                    }

                    this.clearTint();

                    if (health.current === 0) {
                        this.disable();
                    }
                });
            });
        }

        this._shootTimer?.remove(false);
        this._shootTimerConfig = {
            delay: Phaser.Math.Between(500, 1500),
            callback: this.shoot,
            callbackScope: this,
            loop: true,
            paused: true
        };
        this._shootTimer = this.scene.time.addEvent(this._shootTimerConfig);

        if (data.texture === 'ufoRed' && !this.scene.anims.exists('ufoShoot')) {
            this.scene.anims.create({
                key: 'ufoShoot',
                frames: [
                    { key: 'sprites', frame: 'ufoRed' },
                    { key: 'sprites', frame: 'ufoRed-shoot0' },
                    { key: 'sprites', frame: 'ufoRed-shoot1' }
                ],
                frameRate: 4
            });
        }
    }

    public enable(x: number, y: number) {
        this.enableBody(true, x, y - this.displayHeight, true, true);

        // Restore health, in case the enemy is reused from the pool, without emitting events
        const health = this.getComponent(Health);
        health?.heal(health!.max, false);

        if (this._shootTimer && this._shootTimerConfig) {
            this._shootTimer.reset({ ...this._shootTimerConfig, paused: false });
            this._shootTimer.paused = false;
        }
    }

    public disable() {
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);

        this.disableBody(true, true);
        if (this._shootTimer) {
            this._shootTimer.paused = true;
        }
        
    }

    private shoot() {
        console.log("shoot");
        const fire = () => {
            const weapon = this.getComponent(Weapon);
            if (this._isSpecialEnemy) {
                weapon?.shootSpecialEnemy(this, this._numberOfBullets, this._shotRadius);
            } else {
                weapon?.shoot(this);
            }
            this.scene.sound.play('sfx_laser2');
        };

        if (this.scene.anims.exists('ufoShoot') && this.frame.name === 'ufoRed') {
            this.play('ufoShoot');
            this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                this.setTexture('sprites', 'ufoRed');
                fire();
            });
        } else {
            fire();
        }
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime)

        // Destroy entities when out of screen
        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable();
        }
        const effectiveDelta = this.isTinted ? deltaTime * 0.5 : deltaTime;
        const movement = this.getComponent(Movement);

        if (this._isSpecialEnemy) {
            movement?.moveSinusoidal(this, effectiveDelta);
        } else {
            movement?.moveVertically(this, effectiveDelta);
        }
    }
}
