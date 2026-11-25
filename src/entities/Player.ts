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
import type {UpgradeData} from "../gameData/UpgradesData.ts";

export default class Player extends Entity {
    private readonly _bulletData: BulletData = {
        scale: 1.8,
        texture: "laserBlue01",
        blink: true,
        speed: 1024,
        range: 800,
        damage: 1,
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
    private _targets: Phaser.Physics.Arcade.Group;
    private _magnetRadius: number = 250;
    private _moveSpeedMultiplier: number = 1;

    public get magnetRadius(): number {
        return this._magnetRadius;
    }

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'sprites');

        if (this.scene.input.keyboard) {
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.ONE).on('down', () => this.selectPlayerShip(1));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.TWO).on('down', () => this.selectPlayerShip(2));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.THREE).on('down', () => this.selectPlayerShip(3));
        }
    }

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.addComponent(new Health(3, this));
        this.addComponent(new Invulnerability(250, this));
        this.addComponent(new Movement());
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));
        this.addComponent(new Experience());

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
    }

    public applyUpgrade(upgrade: UpgradeData) {
        switch (upgrade.id) {
            case 'fireRate':
                this._rateOfFire *= upgrade.value;
                break;
            case 'range':
                this._bulletData.range += upgrade.value;
                break;
            case 'bulletSpeed':
                this._bulletData.speed *= upgrade.value;
                break;
            case 'moveSpeed':
                this._moveSpeedMultiplier *= upgrade.value;
                this.getComponent(Movement)?.setSpeed(this._playerShipData.movementSpeed * this._moveSpeedMultiplier);
                break;
            case 'maxHealth':
                this.getComponent(Health)?.increaseMax(upgrade.value);
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

        // Shoot automatically at the nearest enemy
        if (timeSinceLaunch - this._lastShotTime > this._rateOfFire * 1000) {
            const nearestTarget = this.findNearestTarget();
            if (nearestTarget) {
                this._shootDirection.set(nearestTarget.x - this.x, nearestTarget.y - this.y).normalize();
                this.getComponent(Weapon)?.shoot(this, this._shootDirection);
                this.scene.sound.play('sfx_laser1');

                this._lastShotTime = timeSinceLaunch;
            }
        }
    }

    public setTargets(targets: Phaser.Physics.Arcade.Group) {
        this._targets = targets;
    }

    private findNearestTarget(): Entity | null {
        // No targets yet during the intro
        if (!this._targets)
            return null;

        const nearestTarget = this.scene.physics.closest(this, this._targets.getMatching('active', true)) as Entity | null;
        const range: number = this.getComponent(Weapon)?.range ?? 0;
        if (!nearestTarget || Phaser.Math.Distance.Between(this.x, this.y, nearestTarget.x, nearestTarget.y) > range)
            return null;

        return nearestTarget;
    }
}
