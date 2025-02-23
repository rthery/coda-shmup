import {Scene} from "phaser";
import {Entity} from './Entity';
import {Weapon} from '../components/Weapon.ts';

export class Player extends Entity {
    private readonly rateOfFire: number;
    private readonly cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    private playerShipData: PlayerShipData;
    private lastShotTime: number;

    constructor(scene: Scene, x: number, y: number, texture: string, playerShipData: PlayerShipData, bulletsGroup: Phaser.Physics.Arcade.Group) {
        super(scene, x, y, texture, playerShipData.texture);

        this.addComponent(new Weapon(scene, bulletsGroup, scene.sound.add('sfx_laser1')));

        this.playerShipData = playerShipData;
        this.rateOfFire = 0.5;
        this.lastShotTime = 0;

        if (this.scene.input.keyboard) {
            this.cursorKeys = this.scene.input.keyboard.createCursorKeys();
        }
    }

    public setPlayerShipData(playerShipData: PlayerShipData) {
        this.playerShipData = playerShipData;
        this.setTexture(this.texture.key, playerShipData.texture);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime)

        // Press left or right arrow keys to move the player smoothly horizontally using deltaTime
        if (this.cursorKeys.left.isDown) {
            this.x -= this.playerShipData.movementSpeed * deltaTime;
        } else if (this.cursorKeys.right.isDown) {
            this.x += this.playerShipData.movementSpeed * deltaTime;
        }
        // Stop player from going offscreen
        this.x = Phaser.Math.Clamp(this.x, this.displayWidth / 2, this.scene.cameras.main.width - this.displayWidth / 2);

        // Press space to shoot
        if (this.cursorKeys.space.isDown) {
            if (timeSinceLaunch - this.lastShotTime > this.rateOfFire * 1000) {
                this.getComponent(Weapon)?.shoot(this.x, this.y - this.displayHeight / 2, 4, 12, 0xffe066, -1024);
                this.lastShotTime = timeSinceLaunch;
            }
        }
    }
}