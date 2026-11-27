import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super(GameConstants.SceneKeys.GAME_OVER);
    }

    create() {
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);

        const screenCenterX: number = this.scale.width / 2;
        const titleY: number = this.scale.height / 3;
        this.add.image(this.scale.width / 2, this.scale.height / 2, 'accueil')
            .setDisplaySize(this.scale.width, this.scale.height);
        this.add.text(screenCenterX, titleY, 'Lisnard a échoué',
            {
            fontSize: '72px',
            color: '#ffffff',
            fontFamily: 'future',
            stroke: '#000000',
            strokeThickness: 8,
            shadow: {
                offsetX: 0,
                offsetY: 6,
                color: '#000000',
                blur: 10,
                fill: true
            }}).setOrigin(0.5);
        this.add.text(screenCenterX, titleY + 160, "SCORE",
            {fontSize: '48px', align: 'center', stroke: '#000000', fontFamily: 'future', strokeThickness: 8,}).setOrigin(0.5);

        this.add.text(screenCenterX, titleY + 260, this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString(),
            {fontSize: '60px', color: '#fff',stroke: '#000000', fontFamily: 'future', strokeThickness: 8, align: 'center'}).setOrigin(0.5);

        this.add.text(screenCenterX, this.scale.height - 256, 'Press SPACE to play again',
            {fontSize: '32px', fontFamily: 'future', color: '#fff', stroke: '#000000',strokeThickness: 8, align: 'center'}).setOrigin(0.5);

        // Ignore the OS key repeat: SPACE is often still held from shooting when the player dies
        this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
            if (event.repeat)
                return;

            this.scene.start(GameConstants.SceneKeys.HOME);
        });

        console.log("GameOverScene created");
    }
}
