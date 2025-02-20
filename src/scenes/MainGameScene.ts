import { Scene, GameObjects, Physics } from 'phaser';

export class MainGameScene extends Scene
{
    private player: GameObjects.Triangle;
    private playerMovementSpeed: number = 0.9;
    private playerRateOfFire: number = 0.5;
    private lastShotTime: number = 0;
    private cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor ()
    {
        super('MainGameScene');
    }

    preload ()
    {
        this.load.setPath('assets');
    }

    create ()
    {
        // https://coolors.co/palette/50514f-f25f5c-ffe066-247ba0-70c1b3
        const colorPalette: string[] = ["#50514f","#f25f5c","#ffe066",
            "#247ba0","#70c1b3"];
        this.cameras.main.setBackgroundColor(colorPalette[0]);

        this.player = this.add.triangle(this.cameras.main.centerX, this.cameras.main.height - 128, -1, 1, 1, 1, 0, -2, 0x247ba0).setScale(32).setDepth(100).setOrigin(0);

        if (this.input.keyboard)
        {
            this.cursorKeys = this.input.keyboard.createCursorKeys();
        }
        else
        {
            console.error('No keyboard input');
        }
    }

    update (_timeSinceLaunch: number, deltaTime: number)
    {
        // Press left or right arrow keys to move the player smoothly horizontally using deltaTime
        if (this.cursorKeys.left.isDown)
        {
            this.player.x -= this.playerMovementSpeed * deltaTime;
        }
        else if (this.cursorKeys.right.isDown)
        {
            this.player.x += this.playerMovementSpeed * deltaTime;
        }

        // Press space to shoot
        if (this.cursorKeys.space.isDown && _timeSinceLaunch - this.lastShotTime > this.playerRateOfFire * 1000)
        {
            let bullet: GameObjects.Rectangle = this.add.rectangle(this.player.x, this.player.y - this.player.displayHeight / 2, 4, 12, 0xffe066).setOrigin(0.5);
            this.physics.add.existing(bullet);
            let bulletBody: Physics.Arcade.Body = bullet.body as Physics.Arcade.Body;
            bulletBody.allowGravity = false;
            bulletBody.setFriction(0, 0);
            bulletBody.setVelocityY(-1024);

            this.lastShotTime = _timeSinceLaunch;
        }

        // Stop player from going offscreen
        this.player.x = Phaser.Math.Clamp(this.player.x, this.player.displayWidth / 2, this.cameras.main.width - this.player.displayWidth / 2);
    }
}
