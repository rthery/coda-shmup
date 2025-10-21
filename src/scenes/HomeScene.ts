import GameConstants from "../GameConstants.ts";

export default class HomeScene extends Phaser.Scene {
    constructor() {
        super(GameConstants.SceneKeys.HOME);
    }

    create() {
        this.add.text(this.scale.width / 2, this.scale.width / 2, 'CODA SHMUP',
            {fontSize: '64px', color: '#fff'}).setOrigin(0.5);
        this.add.text(this.scale.width / 2, this.scale.width / 2 + 72, 'Press SPACE to start',
            {fontSize: '32px', color: '#fff'}).setOrigin(0.5);

        this.input.keyboard?.once('keydown-SPACE', () => {
            this.scene.launch(GameConstants.SceneKeys.MAIN_UI);
            this.scene.start(GameConstants.SceneKeys.MAIN_GAME);
        });

        console.log("HomeScene created");
    }
}