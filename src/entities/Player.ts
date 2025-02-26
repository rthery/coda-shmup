import {Entity} from './Entity';
import {Weapon} from '../components/Weapon.ts';
import {Movement} from "../components/Movement.ts";
import {Health} from "../components/Health.ts";

export class Player extends Entity {
    private rateOfFire: number;
    private cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    private playerShipData: PlayerShipData;
    private lastShotTime: number;

    public init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        this.addComponent(new Weapon(bulletsGroup, this.scene.sound.add('sfx_laser1'), 4, 12, 0xffe066, 1024));
        this.addComponent(new Movement());
        this.addComponent(new Health(1));

        this.rateOfFire = 0.5;
        this.lastShotTime = 0;
        this.angle = -90; // Rotate the player ship to face upwards, to calculate its forward vector when shooting

        this.selectPlayerShip(1);

        if (this.scene.input.keyboard) {
            this.cursorKeys = this.scene.input.keyboard.createCursorKeys();
        }
    }

    public selectPlayerShip(playerShipDataId: number) {
        this.playerShipData = (this.scene.cache.json.get('playerShips') as PlayerShipsData)[playerShipDataId];
        this.setTexture(this.texture.key, this.playerShipData.texture);
        this.arcadeBody.setCircle(this.playerShipData.body.radius,
            this.playerShipData.body.offsetX, this.playerShipData.body.offsetY);
        this.getComponent(Movement)?.setSpeed(this.playerShipData.movementSpeed);

        if (playerShipDataId == 1) { // We only have an idle animation for the first ship for now
            this.play('playerShipIdle');
        }
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        // Press left or right arrow keys to move the player smoothly horizontally using deltaTime
        if (this.cursorKeys.left.isDown) {
            if (this.cursorKeys.shift.isDown) {
                this.angle -= this.playerShipData.movementSpeed * deltaTime;
            } else {
                this.getComponent(Movement)?.moveHorizontally(this, -deltaTime);
            }
        } else if (this.cursorKeys.right.isDown) {
            if (this.cursorKeys.shift.isDown) {
                this.angle += this.playerShipData.movementSpeed * deltaTime;
            } else {
                this.getComponent(Movement)?.moveHorizontally(this, deltaTime);
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
    }
}