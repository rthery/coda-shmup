import {Scene} from "phaser";
import Entity from "./Entity.ts";
import Health from "../components/Health.ts";
import Weapon from "../components/Weapon.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import SinusoidalMovement from "../components/SinusiodalMovement.ts";

export default class MiniBoss extends Entity {
    private readonly _bulletData: BulletData = {
            width: 12,
            height: 12,
            color: 0xf25f5c,
            speed: 512,
            damage: 1,
    }; //change bullet data to match the spread shot later
    
    private _shootTimer: Phaser.Time.TimerEvent;

    public constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'sprites', 'cofeemove');
    }

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.addComponent(new Health(10, this));
        const movement = new SinusoidalMovement(0.2);
        this.addComponent(movement);
        movement.reset(this);
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));

        const health = this.getComponent(Health);
        health?.on(Health.CHANGE_EVENT, () => {
            this.setTintFill(0xffffff);

            if (health.current === 0) {
                this.disableBody();
            }

            this.scene.time.delayedCall(50, () => {
                this.clearTint();

                if (health.current === 0) {
                    this.disable();
                }
            });
        });

        this.angle = 90;
        this.arcadeBody.setCircle(this.displayWidth / 2);

        this._shootTimer = this.scene.time.addEvent({
            delay: Phaser.Math.Between(2000, 3000),
            callback: this.shoot,
            callbackScope: this,
            loop: true
        });
    }

    public disable() {
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);

        this.disableBody(true, true);
        this._shootTimer.paused = true;
    }

    private shoot() {
        this.setTexture('sprites', 'cofeeshoot');
        this.getComponent(Weapon)?.shoot(this);

        this.scene.time.delayedCall(250, () => {
            if (this.active) {
                this.setTexture('sprites', 'cofeemove');
            }
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);
        this.getComponent(SinusoidalMovement)?.moveSinusoidally(this, deltaTime);
    }
}
