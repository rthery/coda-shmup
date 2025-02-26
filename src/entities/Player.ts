import {Scene} from "phaser";
import {PlayerShipData, PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import Entity from './Entity.ts';
import Bullet from "./Bullet.ts";

export default class Player extends Entity {
    private readonly _cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    private _playerShipData: PlayerShipData;
    private _rateOfFire: number;
    private _lastShotTime: number;

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'sprites');

        if (this.scene.input.keyboard) {
            this._cursorKeys = this.scene.input.keyboard.createCursorKeys();
        }
    }

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.bullets = bulletsGroup;

        this.selectPlayerShip(1);

        this._rateOfFire = 0.5;
        this._lastShotTime = 0;
    }

    public selectPlayerShip(playerShipDataId: number) {
        const playerShipsData = this.scene.cache.json.get('playerShips') as PlayerShipsData;
        this._playerShipData = playerShipsData[playerShipDataId];

        this.setTexture('sprites', this._playerShipData.texture);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        // Press left or right arrow keys to move the player smoothly horizontally using deltaTime
        if (this._cursorKeys.left.isDown) {
            this.x -= this._playerShipData.movementSpeed * deltaTime;
        } else if (this._cursorKeys.right.isDown) {
            this.x += this._playerShipData.movementSpeed * deltaTime;
        }
        // Stop player from going offscreen
        this.x = Phaser.Math.Clamp(this.x, this.displayWidth / 2, this.scene.cameras.main.width - this.displayWidth / 2);

        // Press space to shoot
        if (this._cursorKeys.space.isDown) {
            if (timeSinceLaunch - this._lastShotTime > this._rateOfFire * 1000) {
                const bullet: Bullet = this.bullets.get() as Bullet;
                if (bullet) {
                    bullet.enable(this.x, this.y - this.displayHeight / 2, 4, 12, 0xffe066, -1024);

                    this._lastShotTime = timeSinceLaunch;
                }
            }
        }
    }
}