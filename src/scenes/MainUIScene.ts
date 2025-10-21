import {GameObjects, Scenes, Scene} from "phaser";
import Health from "../components/Health.ts";
import Player from "../entities/Player.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class MainUIScene extends Scene {
    private _playerHealthText: GameObjects.Text;
    private _scoreText: GameObjects.Text;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_UI);
    }

    // noinspection JSUnusedGlobalSymbols
    init() {
        this.game.events.on(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
        }, this);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const textStyle = {fontSize: "32px", color: '#FFFFFF'};
        this._playerHealthText = this.add.text(16, 16, "HP: ?", textStyle);

        const scoreStr: string = "Score: " + (this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) || "0");
        this._scoreText = this.add.text(this.scale.width - 16, 16, scoreStr, textStyle).setOrigin(1, 0);

        this.scene.bringToTop();

        console.log("MainUIScene created");
    }

    private onPlayerScoreChanged(_: any, value: number) {
        this._scoreText.setText("Score: " + value);
    }

    private onPlayerSpawned(player: Player) {
        this._playerHealthText.setText("HP: " + player.getComponent(Health)?.current);

        player.getComponent(Health)?.on(Health.CHANGE_EVENT, (current: number) => {
            this._playerHealthText.setText("HP: " + current);
        }, this);
    }
}