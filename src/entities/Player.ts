import {Scene} from "phaser";
import {PlayerShipData, PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";
import GameConstants from "../GameConstants.ts";
import Invulnerability from "../components/Invulnerability.ts";
import Thrusters from "../components/Thrusters.ts";
import WingTrails from "../components/WingTrails.ts";
import Turret from "../components/Turret.ts";
import ShieldBubble from "../components/ShieldBubble.ts";
import MagnetField from "../components/MagnetField.ts";
import type {UpgradeData, UpgradeId, UpgradePreview} from "../gameData/UpgradesData.ts";
import Sfx from "../audio/Sfx.ts";
import type PlayerInput from "../managers/PlayerInput.ts";

export default class Player extends Entity {
    // Lives the ship starts with: shield cells come on top and are lost first
    public static readonly HULL_POINTS: number = 3;
    private static readonly WING_TRAILS_SPEED_RATIO: number = 0.5;
    // The turret fires once it points this close to its target
    private static readonly TURRET_AIM_TOLERANCE: number = Phaser.Math.DegToRad(15);
    private static readonly INVULNERABILITY_DURATION: number = 500; // ms
    // HEAVY LASERS: the bolt's look by rank, from the thin default to a white-hot core.
    // The body follows each texture's height: the circle stays centered on the bolt's tip
    private static readonly HEAVY_LASER_LOOKS = [
        {fromRank: 0, texture: 'laserBlue01', scale: 1.8, offsetX: 49, offsetY: -0.5, impactSize: 1},
        {fromRank: 1, texture: 'laserBlue12', scale: 1.8, offsetX: 52, offsetY: 1.5, impactSize: 1.4},
        {fromRank: 3, texture: 'laserBlue12', scale: 2.1, offsetX: 52, offsetY: 1.5, impactSize: 1.8},
        {fromRank: 5, texture: 'laserBlue16', scale: 2.2, offsetX: 49, offsetY: 1.5, impactSize: 2.5},
    ];
    // FAST LASERS: trail dot lifespan per rank
    private static readonly TRAIL_LIFESPAN_PER_RANK: number = 40; // ms
    // PIERCING at the max rank: the bolt stretches into a lance
    private static readonly LANCE_LENGTH_SCALE: number = 2.2;
    // Random pitch, in cents, so rapid fire doesn't sound like a machine
    private static readonly LASER_DETUNE: number = 150;
    // Dev cheat, kept across restarts
    public static isFiringDisabled: boolean = false;

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
    private _xpGems: Phaser.Physics.Arcade.Group | null = null;
    private _magnetRadius: number = 250;
    private _moveSpeedMultiplier: number = 1;
    private _input: PlayerInput;

    public get magnetRadius(): number {
        return this._magnetRadius;
    }

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'sprites');
    }

    public init(bulletsGroup: Phaser.Physics.Arcade.Group, input: PlayerInput) {
        this._input = input;
        this.addComponent(new Health(Player.HULL_POINTS, this));
        this.addComponent(new Invulnerability(Player.INVULNERABILITY_DURATION, this));
        this.addComponent(new Movement());
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));
        this.addComponent(new Thrusters(this));
        this.addComponent(new WingTrails(this));
        this.addComponent(new Turret(this));
        this.addComponent(new ShieldBubble(this));
        this.addComponent(new MagnetField(this));
        this.getComponent(Health)?.on(Health.CHANGE_EVENT, (current: number, previous: number) => {
            this.updateShieldBubble();
            this.playHealthSound(current, previous);
        });
        this.getComponent(Health)?.once(Health.DEATH_EVENT, () => {
            this.getComponent(Thrusters)?.hide();
            this.getComponent(WingTrails)?.hide();
            this.getComponent(Turret)?.hide();
            this.getComponent(ShieldBubble)?.hide();
            this.getComponent(MagnetField)?.hide();
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

    // Offered until their max rank
    public isUpgradeAvailable(upgrade: UpgradeData): boolean {
        return upgrade.maxRank === null || this.getUpgradeRank(upgrade.id) < upgrade.maxRank;
    }

    // Lives left in the hull, once the shield cells are gone
    public get hullPoints(): number {
        return Math.min(this.getComponent(Health)?.current ?? 0, Player.HULL_POINTS);
    }

    public get isHullDamaged(): boolean {
        return this.hullPoints < Player.HULL_POINTS;
    }

    // REPAIR pickup
    public repair(hullPoints: number) {
        this.getComponent(Health)?.heal(hullPoints);
        Sfx.play(this.scene, 'repair');
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
            case 'shieldCell': {
                const cells: number = (this.getComponent(Health)?.max ?? 0) - Player.HULL_POINTS;
                return Player.preview("SHIELD CELLS", cells, cells + value);
            }
            case 'pierce':
                return Player.preview("PIERCE", this._bulletData.pierce, this._bulletData.pierce + value);
            case 'magnet':
                return Player.preview("MAGNET", this._magnetRadius, this._magnetRadius + value);
        }
    }

    // What each upgrade shows on the ship, its turret or its lasers
    private updateUpgradeLook(upgrade: UpgradeData) {
        const rank: number = this.getUpgradeRank(upgrade.id);
        const maxRank: number = upgrade.maxRank ?? rank;
        switch (upgrade.id) {
            case 'fireRate':
                this.getComponent(Turret)?.setRapidFire(rank / maxRank, rank >= maxRank);
                break;
            case 'range':
                this.getComponent(Turret)?.setAimGuide(rank / maxRank);
                break;
            case 'bulletSpeed':
                this._bulletData.trailLifespan = rank * Player.TRAIL_LIFESPAN_PER_RANK;
                this.getComponent(Turret)?.setSpeedRing(rank >= maxRank);
                break;
            case 'magnet':
                this.getComponent(MagnetField)?.setLevel(rank / maxRank);
                break;
            case 'pierce':
                this._bulletData.lengthScale = rank >= maxRank ? Player.LANCE_LENGTH_SCALE : 1;
                break;
            case 'damage': {
                const look = Player.HEAVY_LASER_LOOKS.filter(look => rank >= look.fromRank).pop()!;
                this._bulletData.texture = look.texture;
                this._bulletData.scale = look.scale;
                this._bulletData.body = {...this._bulletData.body, offsetX: look.offsetX, offsetY: look.offsetY};
                this._bulletData.fx = {...this._bulletData.fx, impactSize: look.impactSize};
                break;
            }
        }
    }

    // A lost shield cell, a hull hit or the last hit
    private playHealthSound(current: number, previous: number) {
        if (current >= previous)
            return;
        if (previous > Player.HULL_POINTS)
            Sfx.play(this.scene, 'shieldDown');
        else if (current > 0)
            Sfx.play(this.scene, 'hullHit');
        else
            Sfx.play(this.scene, 'playerDeath');
    }

    // Health above the hull is shield: hits take it first
    private updateShieldBubble() {
        const current: number = this.getComponent(Health)?.current ?? 0;
        this.getComponent(ShieldBubble)?.setCells(Math.max(0, current - Player.HULL_POINTS));
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
                this.getComponent(Thrusters)?.upgrade(
                    upgrade.maxRank ? this.getUpgradeRank(upgrade.id) / upgrade.maxRank : 1);
                this.getComponent(Movement)?.setSpeed(this._playerShipData.movementSpeed * this._moveSpeedMultiplier);
                break;
            case 'shieldCell':
                this.getComponent(Health)?.increaseMax(upgrade.value);
                Sfx.play(this.scene, 'shieldUp');
                break;
            case 'pierce':
                this._bulletData.pierce += upgrade.value;
                break;
            case 'magnet':
                this._magnetRadius += upgrade.value;
                break;
        }

        this.updateUpgradeLook(upgrade);
        console.log("[Player] Upgrade applied: " + upgrade.id);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        this._moveDirection.copy(this._input.moveDirection);

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
        const isInRange: boolean = nearestTarget !== null && Phaser.Math.Distance.Between(this.x, this.y,
            nearestTarget.x, nearestTarget.y) <= (this.getComponent(Weapon)?.range ?? 0);
        turret?.aim(targetRotation);
        turret?.setGuideTarget(isInRange ? nearestTarget : null);
        turret?.update(deltaTime);
        this.getComponent(ShieldBubble)?.update();
        this.getComponent(MagnetField)?.update(this._magnetRadius, this._xpGems, deltaTime);
        if (!Player.isFiringDisabled && targetRotation !== null && isInRange && timeSinceLaunch - this._lastShotTime > this._rateOfFire * 1000
            && turret?.isAimedAt(targetRotation, Player.TURRET_AIM_TOLERANCE)) {
            this._shootDirection.setToPolar(turret.rotation);
            this.getComponent(Weapon)?.shoot(this, this._shootDirection, turret.getMuzzle(this._muzzle));
            turret.playShot(this._bulletData.fx.glowTints[0]);
            Sfx.play(this.scene, 'laser',
                {detune: Phaser.Math.Between(-Player.LASER_DETUNE, Player.LASER_DETUNE)});

            this._lastShotTime = timeSinceLaunch;
        }
    }

    public setTargets(targets: Phaser.Physics.Arcade.Group) {
        this._targets = targets;
    }

    // The magnet field tethers the stars it pulls
    public setXpGems(xpGems: Phaser.Physics.Arcade.Group) {
        this._xpGems = xpGems;
    }

    private findNearestTarget(): Entity | null {
        // No targets yet during the intro
        if (!this._targets)
            return null;

        return this.scene.physics.closest(this, this._targets.getMatching('active', true)) as Entity | null;
    }
}
