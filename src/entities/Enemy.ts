import type {BulletData} from '../gameData/BulletData.ts';
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";

export default class Enemy extends Entity {
    private readonly _bulletData: BulletData = {
        width: 24,
        height: 24,
        color: 0xf25f5c,
        speed: 512,
        damage: 1,
    };
    private _shootTimerConfig: Phaser.Types.Time.TimerEventConfig;
    private _shootTimer: Phaser.Time.TimerEvent;
    private _type: 'strafer' | 'diver' | 'fast' | 'boss' = 'strafer';
    private _horizontalDirection: number = 1;
    private _elapsedTime: number = 0;
    private _bossIndex: number = -1;
    private _baseX: number = 0;
    private _patternRotation: number = 0;

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.addComponent(new Health(20, this));
        this.addComponent(new Movement(0.2));
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));

        // Listen once per enemy, not on every enable(): pooled enemies are reused many times
        const health = this.getComponent(Health);
        health?.on(Health.CHANGE_EVENT, () => {
            this.setTintFill(0xffffff);

            if (health?.current == 0)
            {
                this.disableBody();
            }

            this.scene.time.delayedCall(50, () => {
                this.clearTint();

                if (health?.current == 0)
                {
                    this.disable();
                }
            });
        });

        this.angle = 90;

        this._shootTimerConfig = {
            delay: Phaser.Math.Between(1200, 1900),
            callback: this.shoot,
            callbackScope: this,
            loop: true
        };
        this._shootTimer = this.scene.time.addEvent(this._shootTimerConfig);

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

    public enable(x: number, y: number) {
        this.enableBody(true, x, y - this.displayHeight, true, true);
        this._type = Phaser.Math.RND.pick(['strafer', 'diver', 'fast']);
        this._horizontalDirection = Phaser.Math.RND.pick([-1, 1]);
        this._elapsedTime = 0;

        if (this._type === 'diver')
            this.setTexture('sprites', 'ufoRed-shoot0');
        else if (this._type === 'fast')
            this.setTexture('sprites', 'ufoRed-shoot1');
        else
            this.setTexture('sprites', 'ufoRed');

        this._shootTimer.reset(this._shootTimerConfig);

        // Restore health, in case the enemy is reused from the pool, without emitting events
        const health = this.getComponent(Health);
        health?.heal(health.max, false);
    }

    public enableBoss(index: number, x: number, y: number) {
        this.enableBody(true, x, y, true, true);
        this._type = 'boss';
        this._bossIndex = index;
        this._baseX = x;
        this._elapsedTime = 0;
        this._patternRotation = index * Math.PI / 11;
        this.setScale(1.8);
        this.setTexture('sprites', index % 2 === 0 ? 'ufoRed-shoot0' : 'ufoRed');

        const health = this.getComponent(Health);
        health?.heal(health.max, false);
        this._shootTimer.reset(this._shootTimerConfig);
    }

    public disable() {
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);
        this.disableBody(true, true);
        this._shootTimer.paused = true;
        this.setScale(1);
    }

    private shoot() {
        this.play('ufoShoot');
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.setTexture('sprites', this._type === 'boss' && this._bossIndex % 2 === 0
                ? 'ufoRed-shoot0'
                : 'ufoRed');

            if (this._type === 'boss') {
                const groupDelay = this._bossIndex < 6 ? 0 : 750;
                this.scene.time.delayedCall(groupDelay, () => {
                    if (this.active)
                        this.shootBossPattern();
                });
            } else if (this._type === 'fast') {
                this.shootBeam(Math.PI / 2);
            } else {
                this.shootVariantBullet(Math.PI / 2);
            }

            this.scene.sound.play('sfx_laser2');
        });
    }

    private shootBossPattern() {
        const weapon = this.getComponent(Weapon);
        const pattern = this.scene.registry.get('bossPatternPhase') as number ?? 0;

        if (pattern === 0) {
            const ringData: BulletData = {
                width: 24,
                height: 24,
                color: this._bossIndex % 2 === 0 ? 0x66ccff : 0xff9933,
                speed: 360,
                damage: 1
            };
            weapon?.shootRadialWithData(this, 12, ringData, this._patternRotation);
            this._patternRotation += Math.PI / 18;
        } else if (pattern === 1) {
            const activeLane = this._bossIndex % 4;

            if (activeLane !== 1 && activeLane !== 3) {
                weapon?.shootBeam(this, {
                    width: 32,
                    height: 300,
                    color: activeLane === 0 ? 0xff55cc : 0x55aaff,
                    speed: 460,
                    damage: 1
                }, Math.PI / 2);
            }
        } else {
            for (let lane = -2; lane <= 2; lane++) {
                weapon?.shootWithData(this, {
                    width: 20,
                    height: 20,
                    color: lane % 2 === 0 ? 0xffff55 : 0xff55ff,
                    speed: 400,
                    damage: 1
                }, Math.PI / 2 + lane * 0.10);
            }
        }
    }

    private shootBeam(angle: number = Math.PI / 2) {
        this.getComponent(Weapon)?.shootBeam(
            this,
            {
                width: 18,
                height: 220,
                color: 0xff3333,
                speed: 620,
                damage: 1
            },
            angle
        );
    }

    private shootVariantBullet(angle: number = this.rotation) {
        this.getComponent(Weapon)?.shootWithData(this, this.getBulletData(), angle);
    }

    private getBulletData(): BulletData {
        if (this._type === 'diver')
            return {...this._bulletData, color: 0x55ccff, speed: 620};
        if (this._type === 'fast')
            return {...this._bulletData, color: 0xff55ff};
        return {...this._bulletData, color: 0xffaa33};
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime)

        // Destroy entities when out of screen
        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable();
        }

        if (this._type === 'boss') {
            this.y = 130 + Math.sin(this._elapsedTime * 1.1 + this._bossIndex * 0.3) * 12;
            this._elapsedTime += deltaTime / 1000;
            this.x = this._baseX + Math.sin(this._elapsedTime * 1.2 + this._bossIndex * 0.22) * 90;
            this.x = Phaser.Math.Clamp(this.x, this.displayWidth / 2, this.scene.cameras.main.width - this.displayWidth / 2);
            this.y = Phaser.Math.Clamp(this.y, 118, 180);
        } else if (this._type === 'strafer') {
            this._elapsedTime += deltaTime / 1000;
            this.x += Math.sin(this._elapsedTime * 2) * 0.18 * deltaTime;
        } else if (this._type === 'diver') {
            this.x += this._horizontalDirection * 0.16 * deltaTime;
        } else {
            this.x += this._horizontalDirection * 0.08 * deltaTime;
        }

        if (!this.isTinted && this._type !== 'boss') {
            const fallSpeed = this._type === 'fast' ? 0.48 : this._type === 'diver' ? 0.38 : 0.28;
            this.getComponent(Movement)?.moveVertically(this, deltaTime * fallSpeed);
        } else {
            this.getComponent(Movement)?.moveVertically(this, deltaTime * 0.1);
        }
    }
}