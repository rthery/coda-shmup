import type {BulletData} from '../gameData/BulletData.ts';
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";
import {EnemyShipData, EnemyShipsData} from "../gameData/EnemyShipData.tx.ts";

export default class Enemy extends Entity {
    private readonly _bulletData: BulletData = {
        width: 12,
        height: 12,
        color: 0xf25f5c,
        speed: 512,
        damage: 1,
    };
    private _shootTimerConfig: Phaser.Types.Time.TimerEventConfig;
    private _shootTimer: Phaser.Time.TimerEvent;
    private _enemyShipData: EnemyShipData;

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        const enemyShipsData = this.scene.cache.json.get('enemyShips') as EnemyShipsData;
        this._enemyShipData = enemyShipsData[1];
        this.addComponent(new Health(1, this));
        this.addComponent(new Movement(this._enemyShipData.movement));
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));

        this.selectEnemyShip(1);

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
            delay: Phaser.Math.Between(2000, 3000),
            callback: this.shoot,
            callbackScope: this,
            loop: true
        };
        this._shootTimer = this.scene.time.addEvent(this._shootTimerConfig);

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
    }

    public selectEnemyShip(enemyShipDataId: number) {
        const enemyShipsData = this.scene.cache.json.get('enemyShips') as EnemyShipsData;
        this._enemyShipData = enemyShipsData[enemyShipDataId];

        this.setTexture('sprites', this._enemyShipData.texture);
        const bodyData = this._enemyShipData.body;
        const movementData = this._enemyShipData.movement;
        this.arcadeBody.setCircle(bodyData.radius, bodyData.offsetX, bodyData.offsetY);

        this.getComponent(Movement)?.setSpeed(movementData.speedMovement);
    }

    public enable(x: number, y: number) {
        this.enableBody(true, x, y - this.displayHeight, true, true);
        this.getComponent(Movement)?.reset(this.x);

        this._shootTimer.reset(this._shootTimerConfig);

        const health = this.getComponent(Health);
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
            this.setTexture('sprites', 'ufoRed');

            this.getComponent(Weapon)?.shoot(this);
            this.scene.sound.play('sfx_laser2');
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime)

        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable();
        }

        if (!this.isTinted)
            this.getComponent(Movement)?.move(this, deltaTime);
        else
            this.getComponent(Movement)?.move(this, deltaTime * 0.5);
    }
}