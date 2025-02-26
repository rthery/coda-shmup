import {SceneNames} from "./SceneNames.ts";
import {GameDataKeys} from "../GameDataKeys.ts";

export class GameOverScene extends Phaser.Scene {
    constructor() {
        super(SceneNames.GAME_OVER_SCENE);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this.cameras.main.setBackgroundColor('#000');
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'GAME OVER', {
            fontSize: '128px',
            color: '#fff'
        }).setOrigin(0.5);

        this.add.text(this.cameras.main.centerX, 32, "SCORE", {fontSize: '32px', align: 'center'}).setOrigin(0.5);
        this.add.text(this.cameras.main.centerX, 72, this.registry.get(GameDataKeys.PLAYER_SCORE).toString(),
            {fontSize: '32px', align: 'center'}).setOrigin(0.5);

        this.add.text(this.cameras.main.centerX, this.cameras.main.height - 256, 'Press SPACE to play again', {
            fontSize: '32px',
            color: '#fff'
        }).setOrigin(0.5);

        this.input.keyboard?.once('keydown-SPACE', () => {
            this.scene.start(SceneNames.MAIN_GAME_SCENE);
        });
    }
}