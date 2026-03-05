import {Input, Scene} from "phaser";
import {PlayerShipData, PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import Entity from './Entity.ts';
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";
import Invulnerability from "../components/Invulnerability.ts";

export default class Player extends Entity {
    private readonly _bulletData: BulletData = {
        scale: 1.8,
        texture: "laserBlue01.png",
        blink: true,
        speed: 1024,
        damage: 1,
        body: {
            radius: 5,
            offsetX: 49,
            offsetY: 5
        }
    };

    private readonly _cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    private _playerShipData: PlayerShipData;
    private _rateOfFire: number;
    private _lastShotTime: number;

    // Touch state
    private _touchLeft: boolean = false;
    private _touchRight: boolean = false;
    private _isTouchDevice: boolean = false;

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
        this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.wasTouch) return;
            this._isTouchDevice = true;
            this._updateTouchDirection(pointer);
        });

        this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown || !pointer.wasTouch) return;
            this._updateTouchDirection(pointer);
        });

        this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.wasTouch) return;
            this._clearTouchForPointer(pointer.id);
        });

        this.scene.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.wasTouch) return;
            this._clearTouchForPointer(pointer.id);
        });

        this.scene.input.keyboard?.on('keydown', () => {
            this._isTouchDevice = false;
            this._touchLeft = false;
            this._touchRight = false;
        });
    }

    private _updateTouchDirection(pointer: Phaser.Input.Pointer) {
        const screenMidX = this.scene.cameras.main.width / 2;
        // Track per-pointer so two-finger touch works correctly
        if (pointer.x < screenMidX) {
            this._touchLeft = true;
        } else {
            this._touchRight = true;
        }
    }

    private _clearTouchForPointer(pointerId: number) {
        // Re-evaluate active pointers to set touch state correctly
        this._touchLeft = false;
        this._touchRight = false;

        const screenMidX = this.scene.cameras.main.width / 2;
        this.scene.input.manager.pointers.forEach((p: Phaser.Input.Pointer) => {
            if (p.id !== pointerId && p.isDown && p.wasTouch) {
                if (p.x < screenMidX) this._touchLeft = true;
                else this._touchRight = true;
            }
        });
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

        const movingLeft  = this._cursorKeys?.left.isDown  || this._touchLeft;
        const movingRight = this._cursorKeys?.right.isDown || this._touchRight;

        if (movingLeft) {
            if (this._cursorKeys?.shift.isDown) {
                this.angle -= this._playerShipData.movementSpeed * deltaTime;
            } else {
                this.getComponent(Movement)?.moveHorizontally(this, -deltaTime);
            }
        } else if (movingRight) {
            if (this._cursorKeys?.shift.isDown) {
                this.angle += this._playerShipData.movementSpeed * deltaTime;
            } else {
                this.getComponent(Movement)?.moveHorizontally(this, deltaTime);
            }
        }

        this.x = Phaser.Math.Clamp(this.x, this.displayWidth / 2, this.scene.cameras.main.width - this.displayWidth / 2);

        // Keyboard: shoot on space. Touch: shoot automatically.
        const shouldShoot = this._cursorKeys?.space.isDown || this._isTouchDevice;
        if (shouldShoot) {
            if (timeSinceLaunch - this._lastShotTime > this._rateOfFire * 1000) {
                this.getComponent(Weapon)?.shoot(this);
                this.scene.sound.play('sfx_laser1');
                this._lastShotTime = timeSinceLaunch;
            }
        }
    }
}