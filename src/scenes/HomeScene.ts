import {Loader} from "phaser";
import GameConstants from "../GameConstants.ts";

export default class HomeScene extends Phaser.Scene {
    constructor() {
        super(GameConstants.SceneKeys.HOME);
    }

    preload() {
        const width: number = this.scale.width;
        const y: number = this.scale.height / 2;

        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(0, y, width, 64);
        this.load.on(Loader.Events.PROGRESS, function (value: number) { // 0-1
            console.log("Loading : " + value);

            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(0, y, width * value, 64);
        });
        this.load.on(Loader.Events.COMPLETE, function () {
            console.log("Loading complete");

            progressBar.destroy();
            progressBox.destroy();
        });

        this.load.setPath('assets');

        this.load.image('bg', 'Backgrounds/darkPurple.png');
        this.load.image('planet', 'Planets/planet00.png');
        this.load.atlas('sprites', 'Spritesheet/gameSprites.png', 'Spritesheet/gameSprites.json');

        this.load.json('playerShips', 'Data/playerShips.json');
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