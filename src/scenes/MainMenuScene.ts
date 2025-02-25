import {SceneNames} from "./SceneNames.ts";

export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super(SceneNames.MAIN_MENU_SCENE);
    }

    create() {
        this.cameras.main.setBackgroundColor('#000');
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'Main Menu', {fontSize: '32px', color: '#fff'}).setOrigin(0.5).setScale(2);
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 64, 'Press SPACE to start', {fontSize: '16px', color: '#fff'}).setOrigin(0.5).setScale(2);

        this.input.keyboard?.once('keydown-SPACE', () => {
            this.scene.start(SceneNames.MAIN_GAME_SCENE);
        });
    }
}