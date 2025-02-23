import {GameObjects, Scene} from "phaser";
import {Entity} from './Entity';
import {Weapon} from '../components/Weapon.ts';

export class Player extends Entity {
    private readonly rateOfFire: number;
    private readonly cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    private playerShipData: PlayerShipData;
    private lastShotTime: number;

    private forwardDebugLine: GameObjects.Line;

    constructor(scene: Scene, x: number, y: number, texture: string, playerShipData: PlayerShipData, bulletsGroup: Phaser.Physics.Arcade.Group) {
        super(scene, x, y, texture, playerShipData.texture);

        this.addComponent(new Weapon(scene, bulletsGroup, scene.sound.add('sfx_laser1'), 4, 12, 0xffe066, 1024));

        this.rateOfFire = 0.5;
        this.lastShotTime = 0;
        // Rotate the player ship to face upwards, allowing us to calculate its forward vector when shooting
        this.angle = -90;

        this.setPlayerShipData(playerShipData);

        if (this.scene.input.keyboard) {
            this.cursorKeys = this.scene.input.keyboard.createCursorKeys();
        }

        this.forwardDebugLine = this.scene.add.line(this.x, this.y, 0, 0, 0, 32, 0xff00ff).setOrigin(0, 0).setLineWidth(2);
    }

    public setPlayerShipData(playerShipData: PlayerShipData) {
        this.playerShipData = playerShipData;
        this.setTexture(this.texture.key, playerShipData.texture);
        this.body.setCircle(playerShipData.body.radius, playerShipData.body.offsetX, playerShipData.body.offsetY);
        this.body.updateCenter();
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        // Press left or right arrow keys to move the player smoothly horizontally using deltaTime
        if (this.cursorKeys.left.isDown) {
            if (this.cursorKeys.shift.isDown) {
                this.angle -= this.playerShipData.movementSpeed * deltaTime;
            } else {
                this.x -= this.playerShipData.movementSpeed * deltaTime;
            }
        } else if (this.cursorKeys.right.isDown) {
            if (this.cursorKeys.shift.isDown) {
                this.angle += this.playerShipData.movementSpeed * deltaTime;
            } else {
                this.x += this.playerShipData.movementSpeed * deltaTime;
            }
        }

        // Stop player from going offscreen
        this.x = Phaser.Math.Clamp(this.x, this.displayWidth / 2, this.scene.cameras.main.width - this.displayWidth / 2);

        // Press space to shoot
        if (this.cursorKeys.space.isDown) {
            if (timeSinceLaunch - this.lastShotTime > this.rateOfFire * 1000) {
                this.getComponent(Weapon)?.shoot(this);
                this.lastShotTime = timeSinceLaunch;
            }
        }

        // Draw a debug line to show the player forward direction
        this.forwardDebugLine.x = this.x;
        this.forwardDebugLine.y = this.y;
        this.forwardDebugLine.setTo(0, 0, Math.cos(this.rotation) * 64, Math.sin(this.rotation) * 64);
    }
}