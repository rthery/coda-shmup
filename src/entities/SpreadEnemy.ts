import type {BulletData} from '../gameData/BulletData.ts';
import type {SpreadBulletData, SpreadEnemyData} from '../gameData/SpreadEnemyData.ts';
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import SineMovement from "../components/SineMovement.ts";
import Weapon from "../components/Weapon.ts";

// Green UFO: moves down in a sine wave and fires a spread shot (fan of bullets).
// Spawn rate, movement and spread shot are all read from public/assets/Data/spreadEnemy.json
export default class SpreadEnemy extends Entity {
    public static readonly IDLE_FRAME: string = 'ufoGreen';
    private static readonly SHOOT_ANIMATION_KEY: string = 'ufoGreenShoot';

    private _data: SpreadEnemyData;
    private _shootTimer?: Phaser.Time.TimerEvent;

    public init(bulletsGroup: Phaser.Physics.Arcade.Group, data: SpreadEnemyData) {
        this._data = data;

        this.addComponent(new Health(Math.max(1, data.health), this));
        this.addComponent(new Movement(data.movement.speedY));
        this.addComponent(new SineMovement(data.movement.amplitude, data.movement.frequency, data.movement.phase));
        this.addComponent(new Weapon(bulletsGroup, SpreadEnemy.toBulletData(data.attack.bullet)));

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

        // Create animation when enemy is about to shoot in the global animation manager
        if (!this.scene.anims.exists(SpreadEnemy.SHOOT_ANIMATION_KEY)) {
            this.scene.anims.create({
                key: SpreadEnemy.SHOOT_ANIMATION_KEY,
                frames: [
                    {key: 'sprites', frame: SpreadEnemy.IDLE_FRAME},
                    {key: 'sprites', frame: 'ufoGreen-shoot0'},
                    {key: 'sprites', frame: 'ufoGreen-shoot1'}
                ],
                frameRate: 4,
            });
        }

        this.arcadeBody.setCircle(this.displayWidth / 2);
    }

    public enable(x: number, y: number) {
        // Keep the whole oscillation on screen: shrink the amplitude if needed, then move the center line of the wave
        const screenWidth: number = this.scene.cameras.main.width;
        const amplitude: number = Math.min(this._data.movement.amplitude, (screenWidth - this.displayWidth) / 2);
        const margin: number = this.displayWidth / 2 + amplitude;
        const anchorX: number = Phaser.Math.Clamp(x, margin, screenWidth - margin);

        // Start exactly where the wave starts (matters when the phase is not 0)
        const sineMovement = this.getComponent(SineMovement);
        sineMovement?.reset(anchorX, amplitude);

        this.enableBody(true, sineMovement ? sineMovement.getX() : anchorX, y - this.displayHeight, true, true);
        this.setTexture('sprites', SpreadEnemy.IDLE_FRAME);

        // Restore health, in case the enemy is reused from the pool, without emitting events
        const health = this.getComponent(Health);
        health?.heal(health!.max, false);

        this.scheduleNextShot();
    }

    public disable() {
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);
        this._shootTimer?.remove(false);

        this.disableBody(true, true);
    }

    private scheduleNextShot() {
        this._shootTimer?.remove(false);

        const shootDelay = this._data.attack.shootDelay;
        this._shootTimer = this.scene.time.delayedCall(Phaser.Math.Between(shootDelay.min, shootDelay.max), this.shoot, [], this);
    }

    private shoot() {
        this.play(SpreadEnemy.SHOOT_ANIMATION_KEY);
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.setTexture('sprites', SpreadEnemy.IDLE_FRAME);

            // The enemy may have been shot down while charging
            if (!this.arcadeBody.enable)
                return;

            this.getComponent(Weapon)?.shootSpread(this, this._data.attack.spread);
            this.scene.sound.play('sfx_laser2');
            this.scheduleNextShot();
        });
    }

    private static toBulletData(bullet: SpreadBulletData): BulletData {
        return {
            width: bullet.width,
            height: bullet.height,
            color: Phaser.Display.Color.HexStringToColor(bullet.color).color,
            speed: bullet.speed,
            damage: bullet.damage,
        };
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime)

        // Destroy entities when out of screen
        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable();
        }

        // Slowed down while flashing after a hit, like the other enemy
        const scaledDeltaTime: number = this.isTinted ? deltaTime * 0.5 : deltaTime;
        this.getComponent(Movement)?.moveVertically(this, scaledDeltaTime);
        this.getComponent(SineMovement)?.moveHorizontally(this, scaledDeltaTime);
    }
}