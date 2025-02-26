import {Entity} from './Entity';
import {Weapon} from '../components/Weapon.ts';
import {Movement} from "../components/Movement.ts";

export class Enemy extends Entity {
    private shootTimerConfig: Phaser.Types.Time.TimerEventConfig;
    private shootTimer: Phaser.Time.TimerEvent;

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.angle = 90;

        this.addComponent(new Weapon(bulletsGroup, this.scene.sound.add('sfx_laser2'), 4, 12, 0xf25f5c, 512));

        this.shootTimerConfig = {
            delay: Phaser.Math.Between(2000, 3000),
            callback: this.shoot,
            callbackScope: this,
            loop: true
        };
        this.shootTimer = this.scene.time.addEvent(this.shootTimerConfig);

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
        this.shootTimer.reset(this.shootTimerConfig);
        this.shootTimer.paused = false;
        this.arcadeBody.setVelocityY(256);
    }

    public disable() {
        this.disableBody(true, true);
        this.shootTimer.paused = true;
    }

    private shoot() {
        this.play('ufoShoot');
        this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.setTexture('sprites', 'ufoRed.png');

            this.getComponent(Weapon)?.shoot(this);
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        // Destroy entities when out of screen
        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable();
        }

        this.getComponent(Movement)?.moveVertically(this, deltaTime);
    }
}