import {Input, Scene} from "phaser";
import {PlayerShipData, PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";
import GameConstants from "../GameConstants.ts";
import Invulnerability from "../components/Invulnerability.ts";

export default class Player extends Entity {
    private readonly _bulletData: BulletData = {
        scale: 1.8,
        texture: "laserBlue01",
        blink: true,
        speed: 1024,
        damage: 1,
        body: {
            radius: 5,
            offsetX: 49,
            offsetY: -0.5
        }
    };

    private readonly _cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    private _playerShipData: PlayerShipData;
    private _rateOfFire: number;
    private _lastShotTime: number;
    private readonly _moveDirection: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _shootDirection: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private _targets: Phaser.Physics.Arcade.Group;

    // Touch: a floating joystick, the first touch sets its center
    private static readonly TOUCH_DEADZONE: number = 24;
    private _touchPointerId: number = -1;
    private readonly _touchOrigin: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _touchDirection: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'sprites');

        if (this.scene.input.keyboard) {
            this._cursorKeys = this.scene.input.keyboard.createCursorKeys();

            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.ONE).on('down', () => this.selectPlayerShip(1));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.TWO).on('down', () => this.selectPlayerShip(2));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.THREE).on('down', () => this.selectPlayerShip(3));
        }

        this._setupTouchInput();
    }

    private _setupTouchInput() {
        this.scene.input.on(Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
            if (!pointer.wasTouch || this._touchPointerId !== -1)
                return;

            this._touchPointerId = pointer.id;
            this._touchOrigin.set(pointer.x, pointer.y);
            this._touchDirection.set(0, 0);
        });

        this.scene.input.on(Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
            if (pointer.id !== this._touchPointerId)
                return;

            this._touchDirection.set(pointer.x - this._touchOrigin.x, pointer.y - this._touchOrigin.y);
            if (this._touchDirection.length() < Player.TOUCH_DEADZONE)
                this._touchDirection.set(0, 0);
        });

        const onTouchEnd = (pointer: Phaser.Input.Pointer) => {
            if (pointer.id !== this._touchPointerId)
                return;

            this._touchPointerId = -1;
            this._touchDirection.set(0, 0);
        };
        this.scene.input.on(Input.Events.POINTER_UP, onTouchEnd);
        this.scene.input.on(Input.Events.POINTER_UP_OUTSIDE, onTouchEnd);
    }

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.addComponent(new Health(3, this));
        this.addComponent(new Invulnerability(250, this));
        this.addComponent(new Movement());
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));

        this.angle = -90;

        this.selectPlayerShip(1);

        this._rateOfFire = 0.5;
        this._lastShotTime = 0;

        this.getComponent(Health)?.on(Health.CHANGE_EVENT, () => {
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

        this.getComponent(Movement)?.setSpeed(this._playerShipData.movementSpeed);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        // Build the move direction from the arrow keys
        this._moveDirection.set(0, 0);
        if (this._cursorKeys.left.isDown)
            this._moveDirection.x -= 1;
        if (this._cursorKeys.right.isDown)
            this._moveDirection.x += 1;
        if (this._cursorKeys.up.isDown)
            this._moveDirection.y -= 1;
        if (this._cursorKeys.down.isDown)
            this._moveDirection.y += 1;

        // Touch: drag from where the finger went down
        if (this._moveDirection.lengthSq() === 0)
            this._moveDirection.copy(this._touchDirection);

        if (this._moveDirection.lengthSq() > 0) {
            this._moveDirection.normalize();
            this.getComponent(Movement)?.move(this, this._moveDirection, deltaTime);

            // Face the move direction
            this.rotation = this._moveDirection.angle();
        }

        // Stop player from leaving the arena
        this.x = Phaser.Math.Clamp(this.x, this.displayWidth / 2, GameConstants.ARENA_WIDTH - this.displayWidth / 2);
        this.y = Phaser.Math.Clamp(this.y, this.displayHeight / 2, GameConstants.ARENA_HEIGHT - this.displayHeight / 2);

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

        return this.scene.physics.closest(this, this._targets.getMatching('active', true)) as Entity | null;
    }
}
