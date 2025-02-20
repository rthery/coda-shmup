import { Scene, GameObjects } from 'phaser';

export class MainGameScene extends Scene
{
    private player: GameObjects.Triangle;
    private playerCenter: GameObjects.Arc;
    private playerMovementSpeed: number = 0.9;
    private cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    private leftKey: Phaser.Input.Keyboard.Key;
    private rightKey: Phaser.Input.Keyboard.Key;

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
        this.playerCenter = this.add.circle(this.player.x, this.player.y, 5, 0xf25f5c).setDepth(102);

        if (this.input.keyboard)
        {
            this.cursorKeys = this.input.keyboard.createCursorKeys();
            this.leftKey = this.input.keyboard.addKey('LEFT');
            this.rightKey = this.input.keyboard.addKey('RIGHT');
        }
        else
        {
            console.error('No keyboard input');
        }
    }

    update (_timeSinceLaunch: number, deltaTime: number)
    {
        // Press left or right arrow keys to move the player smoothly horizontally using deltaTime
        if (this.leftKey.isDown || this.cursorKeys.left.isDown)
        {
            this.player.x -= this.playerMovementSpeed * deltaTime;
        }
        else if (this.rightKey.isDown || this.cursorKeys.right.isDown)
        {
            this.player.x += this.playerMovementSpeed * deltaTime;
        }

        // Stop player from going offscreen
        this.player.x = Phaser.Math.Clamp(this.player.x, this.player.displayWidth / 2, this.cameras.main.width - this.player.displayWidth / 2);

        // Sync playerCenter position with player
        this.playerCenter.setPosition(this.player.x, this.player.y);
    }
}
