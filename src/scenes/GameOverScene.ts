import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super(GameConstants.SceneKeys.GAME_OVER);
    }

    create() {
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);

        const os = this.sys.game.device.os;
        const isMobile = os.android || os.iOS || os.iPad || os.iPhone;

        const screenCenterX: number = this.scale.width / 2;
        const titleY: number = this.scale.height / 3;
        this.add.text(screenCenterX, titleY, 'GAME OVER',
            {fontSize: '96px', color: '#fff', align: 'center'}).setOrigin(0.5);
        this.add.text(screenCenterX, titleY + 160, "SCORE",
            {fontSize: '48px', align: 'center'}).setOrigin(0.5);

        this.add.text(screenCenterX, titleY + 220, this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString(),
            {fontSize: '32px', color: '#fff', align: 'center'}).setOrigin(0.5);

        const promptText = this.add.text(
            screenCenterX,
            this.scale.height - 256,
            isMobile ? 'Tap to play again' : 'Press SPACE to play again',
            {fontSize: '32px', color: '#fff', align: 'center'}
        ).setOrigin(0.5);

        const goHome = () => {
            this.input.keyboard?.removeAllListeners();
            this.input.removeAllListeners();
            this.scene.start(GameConstants.SceneKeys.HOME);
        };

        if (isMobile) {
            this.input.once('pointerdown', () => goHome());
        } else {
            // Ignore the OS key repeat: SPACE is often still held from shooting when the player dies
            this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
                if (!event.repeat)
                    goHome();
            });

            // Touchscreen laptop fallback
            this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                if (pointer.wasTouch) promptText.setText('Tap to play again');
            });
            this.input.keyboard?.on('keydown', () => {
                promptText.setText('Press SPACE to play again');
            });
            this.input.once('pointerdown', (pointer: Phaser.Input.Pointer) => {
                if (pointer.wasTouch) goHome();
            });
        }

        console.log("GameOverScene created");
    }
}