import Entity from './Entity.ts';
import Weapon from "../components/Weapon.ts";

export default class Enemy extends Entity {
    private _shootTimerConfig: Phaser.Types.Time.TimerEventConfig;
    private _shootTimer: Phaser.Time.TimerEvent;

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.addComponent(new Weapon(bulletsGroup));

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
    }

    public enable(x: number, y: number) {
        this.enableBody(true, x, y - this.displayHeight, true, true);
        this._shootTimer.reset(this._shootTimerConfig);
        this.arcadeBody.setVelocityY(256);
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

            this.getComponent(Weapon)?.shoot(this.x, this.y + this.displayHeight / 2, 12, 12,
                0xf25f5c, 512);
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime)

        // Destroy entities when out of screen
        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable();
        }
    }
}