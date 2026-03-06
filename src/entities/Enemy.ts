import type {BulletData} from '../gameData/BulletData.ts';
import { EnemyData, EnemiesData } from '../gameData/EnemyData.ts';
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";

export default class Enemy extends Entity {
    private readonly _bulletData: BulletData = {
        width: 12,
        height: 12,
        color: 0xf25f5c,
        speed: 512,
        damage: 1,
    };
    private _enemyData: EnemyData;
    private _shootTimerConfig: Phaser.Types.Time.TimerEventConfig;
    private _shootTimer: Phaser.Time.TimerEvent;
    private _internTimer: number;
    private _startX: number;

    public getInterTimer() {
        return this._internTimer;
    }

    public getStartX() {
        return this._startX;
    }

    public setInternTimer(internTimer: number) {
        this._internTimer = internTimer
    }

    public setStartX(startX: number) {
        this._startX = startX;
    }

    public randomEnemyType() {
        const enemiesData = this.scene.cache.json.get('enemies') as EnemiesData;
        const enemyKeys = Object.keys(enemiesData);

        const enemyTypeId = Phaser.Math.RND.pick(enemyKeys); 
        this._enemyData = enemiesData[enemyTypeId];
    } 

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.randomEnemyType();

        this.addComponent(new Health(this._enemyData.health, this));
        this.addComponent(new Movement(this._enemyData.movementSpeed));
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));
        
        this.angle = 90;

        this._shootTimerConfig = {
            delay: Phaser.Math.Between(2000, 3000),
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
                    {key: 'sprites', frame: 'ufoRed.png'},
                    {key: 'sprites', frame: 'ufoRed-shoot0.png'},
                    {key: 'sprites', frame: 'ufoRed-shoot1.png'}
                ],
                frameRate: 4,
            });
        }

        this.arcadeBody.setCircle(this.displayWidth / 2);
    }

    public enable(x: number, y: number) {
        this.enableBody(true, x, y - this.displayHeight, true, true);
        this._shootTimer.reset(this._shootTimerConfig);
        this._startX = this.x;
        this._internTimer = 0;
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

        // Restore health, in case the enemy is reused from the pool, without emitting events
        health?.heal(health!.max, false);
    }

    public disable() {
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);

        this.disableBody(true, true);
        this._shootTimer.paused = true;
    }

    private shoot() {
        this.play('ufoShoot');
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.setTexture('sprites', 'ufoRed.png');

            switch (this._enemyData.type) {
                case "base":
                    this.getComponent(Weapon)?.shoot(this);                    
                    break;
                case "spread":
                    this.getComponent(Weapon)?.spreadShoot(this, this._enemyData.shotRate, this._enemyData.shotAngleZone);
                    break;
            }
            this.scene.sound.play('sfx_laser2');
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime)

        // Destroy entities when out of screen
        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable();
        }

        switch (this._enemyData.type) {
            case "base":
                if (!this.isTinted)
                    this.getComponent(Movement)?.moveVertically(this, deltaTime);
                else
                    this.getComponent(Movement)?.moveVertically(this, deltaTime * 0.5);
                break;
            case "spread":
                if (!this.isTinted)
                    this.getComponent(Movement)?.moveSinusoidally(this, deltaTime, this._enemyData.movementAmplitude, this._enemyData.movementFrequency);
                else
                    this.getComponent(Movement)?.moveSinusoidally(this, deltaTime * 0.5, this._enemyData.movementAmplitude, this._enemyData.movementFrequency);
                break;
        }
    }
}