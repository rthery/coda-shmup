import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";
import type {SinusoidalEnemyConfig} from "../gameData/SinusoidalEnemyConfig.ts";
import Enemy from "./Enemy.ts";

export default class SinusoidalEnemy extends Enemy {
    private _config?: SinusoidalEnemyConfig;
    private _originX: number = 0;
    private _spawnTime: number = 0;
    private _phase: number = 0;

    public configure(config: SinusoidalEnemyConfig) {
        const maxAmplitude = (this.scene.cameras.main.width - this.displayWidth) / 2;
        if (config.movement.amplitude > maxAmplitude) {
            throw new RangeError("Sinusoidal enemy amplitude is too large for the game width");
        }

        this._config = config;
    }

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        const config = this.getConfig();
        super.init(bulletsGroup, config.spreadShot.intervalMs);
        this.getComponent(Movement)?.setSpeed(config.movement.verticalSpeed);
        this.setTint(config.visualTint);
    }

    public enable(x: number, y: number) {
        super.enable(x, y);

        const config = this.getConfig();
        this._originX = x;
        this._spawnTime = this.scene.time.now;
        this._phase = Phaser.Math.FloatBetween(0, Math.PI * 2);
        this.getComponent(Movement)?.setSpeed(config.movement.verticalSpeed);
        this.setTint(config.visualTint);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);
        if (!this.active) {
            return;
        }

        const {amplitude, frequencyHz} = this.getConfig().movement;
        const elapsedSeconds = (timeSinceLaunch - this._spawnTime) / 1000;
        this.x = this._originX
            + amplitude * Math.sin(elapsedSeconds * frequencyHz * Math.PI * 2 + this._phase);
    }

    protected restoreAppearance() {
        this.setTint(this.getConfig().visualTint);
    }

    protected fireWeapon() {
        const spreadShot = this.getConfig().spreadShot;
        this.getComponent(Weapon)?.shootSpread(this, spreadShot.bulletCount, spreadShot.angleDegrees);
    }

    private getConfig(): SinusoidalEnemyConfig {
        if (!this._config) {
            throw new Error("SinusoidalEnemy must be configured before initialization");
        }

        return this._config;
    }
}
