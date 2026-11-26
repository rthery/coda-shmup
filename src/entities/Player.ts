import {Input, Scene} from "phaser";
import {PlayerShipData, PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";
import GameConstants from "../GameConstants.ts";
import Invulnerability from "../components/Invulnerability.ts";
import Experience from "../components/Experience.ts";
import Thrusters from "../components/Thrusters.ts";
import WingTrails from "../components/WingTrails.ts";
import Turret from "../components/Turret.ts";
import type {UpgradeData, UpgradeId, UpgradePreview} from "../gameData/UpgradesData.ts";
import type {DifficultyData} from "../gameData/DifficultyData.ts";

export default class Player extends Entity {
    private static readonly WING_TRAILS_SPEED_RATIO: number = 0.5;
    // The turret fires once it points this close to its target
    private static readonly TURRET_AIM_TOLERANCE: number = Phaser.Math.DegToRad(15);
    private static readonly INVULNERABILITY_DURATION: number = 500; // ms
    // Random pitch, in cents, so rapid fire doesn't sound like a machine
    private static readonly LASER_DETUNE: number = 150;
    // Dev cheat, kept across restarts: F toggles the player's firing
    private static _isFiringDisabled: boolean = false;

    private readonly _bulletData: BulletData = {
        scale: 1.8,
        texture: "laserBlue01",
        blink: true,
        speed: 1024,
        range: 800,
        damage: 1,
        pierce: 0,
        body: {
            radius: 5,
            offsetX: 49,
            offsetY: -0.5
        },
        fx: {
            flashTint: 0xffffff,
            sparkTints: [0xffffff, 0x00eeff, 0xaaddff],
            glowTints: [0x00ccff, 0xffffff],
        }
    };

    private _playerShipData: PlayerShipData;
    private _rateOfFire: number;
    private _lastShotTime: number;
    private readonly _moveDirection: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _shootDirection: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _muzzle: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _upgradeRanks: Map<UpgradeId, number> = new Map();
    private _targets: Phaser.Physics.Arcade.Group;
    private _magnetRadius: number = 250;
    private _moveSpeedMultiplier: number = 1;

    public get magnetRadius(): number {
        return this._magnetRadius;
    }

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'sprites');

        if (import.meta.env.DEV && this.scene.input.keyboard) {
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.F).on('down', () => {
                Player._isFiringDisabled = !Player._isFiringDisabled;
                console.log("[Cheat] Player firing " + (Player._isFiringDisabled ? "off" : "on"));
            });
            // L grants the XP missing to reach the next level
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.L).on('down', () => {
                const experience = this.getComponent(Experience);
                if (!experience)
                    return;
                experience.add(experience.xpToNextLevel - experience.xp);
                console.log("[Cheat] Level " + experience.level);
            });
        }
    }

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.addComponent(new Health(3, this));
        this.addComponent(new Invulnerability(Player.INVULNERABILITY_DURATION, this));
        this.addComponent(new Movement());
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));
        this.addComponent(new Experience((this.scene.cache.json.get('difficulty') as DifficultyData).xp));
        this.addComponent(new Thrusters(this));
        this.addComponent(new WingTrails(this));
        this.addComponent(new Turret(this));
        this.getComponent(Health)?.once(Health.DEATH_EVENT, () => {
            this.getComponent(Thrusters)?.hide();
            this.getComponent(WingTrails)?.hide();
            this.getComponent(Turret)?.hide();
        });

        this.angle = -90;

        this.selectPlayerShip(1);

        this._rateOfFire = 0.5;
        this._lastShotTime = 0;

        this.getComponent(Health)?.on(Health.CHANGE_EVENT, (current: number, previous: number) => {
            if (current > previous)
                return;

            this.arcadeBody.setEnable(false);

            this.scene.time.delayedCall(50, () => {
                // A dead player stays disabled
                if (this.active)
                    this.arcadeBody.setEnable(true);
            });
        });
    }

    public selectPlayerShip(playerShipDataId: number) {
        const playerShipsData = this.scene.cache.json.get('playerShips') as PlayerShipsData;
        this._playerShipData = playerShipsData[playerShipDataId];

        this.setTexture('sprites', this._playerShipData.texture);
        const bodyData = this._playerShipData.body;
        this.arcadeBody.setCircle(bodyData.radius, bodyData.offsetX, bodyData.offsetY);

        this.getComponent(Movement)?.setSpeed(this._playerShipData.movementSpeed * this._moveSpeedMultiplier);
        this.getComponent(Movement)?.setAcceleration(this._playerShipData.acceleration, this._playerShipData.deceleration);
        this.getComponent(Thrusters)?.setThrusters(this._playerShipData.thrusters);
        this.getComponent(WingTrails)?.setWingTips(this._playerShipData.wingTips);
        this.getComponent(Turret)?.setTurret(this._playerShipData.turret);
    }

    // Times the upgrade has been picked
    public getUpgradeRank(id: UpgradeId): number {
        return this._upgradeRanks.get(id) ?? 0;
    }

    public getUpgradePreview(upgrade: UpgradeData): UpgradePreview {
        const value: number = upgrade.value;
        switch (upgrade.id) {
            case 'fireRate':
                return Player.preview("FIRE RATE", 1 / this._rateOfFire, 1 / (this._rateOfFire * value), 1, " /S");
            case 'damage':
                return Player.preview("DAMAGE", this._bulletData.damage, this._bulletData.damage + value);
            case 'range':
                return Player.preview("RANGE", this._bulletData.range, this._bulletData.range + value);
            case 'bulletSpeed':
                return Player.preview("LASER SPEED", this._bulletData.speed, this._bulletData.speed * value);
            case 'moveSpeed': {
                const speed: number = this._playerShipData.movementSpeed * this._moveSpeedMultiplier * 1000;
                return Player.preview("SPEED", speed, speed * value);
            }
            case 'maxHealth': {
                const lives: number = this.getComponent(Health)?.max ?? 0;
                return Player.preview("LIVES", lives, lives + value);
            }
            case 'pierce':
                return Player.preview("PIERCE", this._bulletData.pierce, this._bulletData.pierce + value);
            case 'magnet':
                return Player.preview("MAGNET", this._magnetRadius, this._magnetRadius + value);
        }
    }

    private static preview(stat: string, current: number, next: number, decimals: number = 0,
                           unit: string = ""): UpgradePreview {
        return {stat, current: current.toFixed(decimals), next: next.toFixed(decimals) + unit};
    }

    public applyUpgrade(upgrade: UpgradeData) {
        this._upgradeRanks.set(upgrade.id, this.getUpgradeRank(upgrade.id) + 1);
        switch (upgrade.id) {
            case 'fireRate':
                this._rateOfFire *= upgrade.value;
                break;
            case 'damage':
                this._bulletData.damage += upgrade.value;
                break;
            case 'range':
                this._bulletData.range += upgrade.value;
                break;
            case 'bulletSpeed':
                this._bulletData.speed *= upgrade.value;
                break;
            case 'moveSpeed':
                this._moveSpeedMultiplier *= upgrade.value;
                this.getComponent(Thrusters)?.upgrade();
                this.getComponent(Movement)?.setSpeed(this._playerShipData.movementSpeed * this._moveSpeedMultiplier);
                break;
            case 'maxHealth':
                this.getComponent(Health)?.increaseMax(upgrade.value);
                break;
            case 'pierce':
                this._bulletData.pierce += upgrade.value;
                break;
            case 'magnet':
                this._magnetRadius += upgrade.value;
                break;
        }

        console.log("[Player] Upgrade applied: " + upgrade.id);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        // Arrow keys, touch or gamepad
        this._moveDirection.copy(this.scene.gameInputManager.moveDirection);

        this._moveDirection.normalize();
        const movement = this.getComponent(Movement);
        movement?.accelerateInDirection(this, this._moveDirection, deltaTime);

        // Turn progressively toward the move direction
        if (this._moveDirection.lengthSq() > 0) {
            // angle() is in [0, 2PI] but rotation is in [-PI, PI]: wrap it, or RotateTo snaps across the gap
            this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, Phaser.Math.Angle.Wrap(this._moveDirection.angle()),
                this._playerShipData.turnSpeed * deltaTime);
        }

        // Stop player from leaving the arena, and kill the velocity pushing into the wall
        const clampedX = Phaser.Math.Clamp(this.x, this.displayWidth / 2, GameConstants.ARENA_WIDTH - this.displayWidth / 2);
        const clampedY = Phaser.Math.Clamp(this.y, this.displayHeight / 2, GameConstants.ARENA_HEIGHT - this.displayHeight / 2);
        if (movement && clampedX != this.x)
            movement.velocity.x = 0;
        if (movement && clampedY != this.y)
            movement.velocity.y = 0;
        this.x = clampedX;
        this.y = clampedY;

        const speedRatio: number = movement && movement.speed > 0 ? movement.velocity.length() / movement.speed : 0;
        this.getComponent(Thrusters)?.update(this._moveDirection.lengthSq() > 0, speedRatio, deltaTime);
        this.getComponent(WingTrails)?.update(speedRatio > Player.WING_TRAILS_SPEED_RATIO);

        // The turret tracks the nearest enemy, even out of range so it points at the next threat,
        // and shoots it automatically once in range
        const turret = this.getComponent(Turret);
        const nearestTarget = this.findNearestTarget();
        const targetRotation: number | null = nearestTarget
            ? Phaser.Math.Angle.Between(this.x, this.y, nearestTarget.x, nearestTarget.y) : null;
        turret?.aim(targetRotation);
        turret?.update(deltaTime);

        const isInRange: boolean = nearestTarget !== null && Phaser.Math.Distance.Between(this.x, this.y,
            nearestTarget.x, nearestTarget.y) <= (this.getComponent(Weapon)?.range ?? 0);
        if (!Player._isFiringDisabled && targetRotation !== null && isInRange && timeSinceLaunch - this._lastShotTime > this._rateOfFire * 1000
            && turret?.isAimedAt(targetRotation, Player.TURRET_AIM_TOLERANCE)) {
            this._shootDirection.setToPolar(turret.rotation);
            this.getComponent(Weapon)?.shoot(this, this._shootDirection, turret.getMuzzle(this._muzzle));
            turret.playShot(this._bulletData.fx.glowTints[0]);
            this.scene.sound.play('sfx_laser1',
                {detune: Phaser.Math.Between(-Player.LASER_DETUNE, Player.LASER_DETUNE)});

            this._lastShotTime = timeSinceLaunch;
        }
    }

    public setTargets(targets: Phaser.Physics.Arcade.Group) {
        this._targets = targets;
    }

    private findNearestTarget(): Entity | null {
        // No targets yet during the intro
        if (!this._targets)
            return null;

        return this.scene.physics.closest(this, this._targets.getMatching('active', true)) as Entity | null;
    }
}
