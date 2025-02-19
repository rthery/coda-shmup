import { Scene, GameObjects } from 'phaser';

export class MainGameScene extends Scene
{
    private player: GameObjects.Triangle;
    private playerCenter: GameObjects.Arc;

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
    }

    update (_time: number, _delta: number)
    {

    }
}
