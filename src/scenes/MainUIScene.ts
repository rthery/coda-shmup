import {GameObjects, Scenes, Scene} from "phaser";
import Health from "../components/Health.ts";
import Experience from "../components/Experience.ts";
import Player from "../entities/Player.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class MainUIScene extends Scene {
    private _playerHealthText: GameObjects.BitmapText;
    private _scoreText: GameObjects.BitmapText;
    private _comboText: GameObjects.Text;
    private _xpBarFill: GameObjects.Rectangle;
    private _levelText: GameObjects.Text;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_UI);
    }

    // noinspection JSUnusedGlobalSymbols
    init() {
        this.game.events.on(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_COMBO_CHANGE, this.onPlayerComboChanged, this);

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_COMBO_CHANGE, this.onPlayerComboChanged, this);
        }, this);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const playerHealthIcon = this.add.image(64, 64, "sprites", "playerLife1_blue")
            .setOrigin(0, 0).setScale(1.5);
        const playerHealthTextX = playerHealthIcon.x + playerHealthIcon.displayWidth + 16;
        this._playerHealthText = this.add.bitmapText(playerHealthTextX, 64, "future-bmp", "x0", 128);

        let scoreStr: string = "".padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        if (this.registry.has(RegistryConstants.Keys.PLAYER_SCORE))
            scoreStr = this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString()
                .padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText = this.add.bitmapText(this.scale.width - 64, 64, "future-bmp", scoreStr, 128)
            .setOrigin(1, 0);

        const xpBarY: number = 216;
        const xpBarWidth: number = this.scale.width - 128;
        this.add.rectangle(64, xpBarY, xpBarWidth, 24, 0x000000, 0.5)
            .setOrigin(0, 0).setStrokeStyle(4, 0xffffff, 0.8);
        // Gold, like the XP stars
        this._xpBarFill = this.add.rectangle(64, xpBarY, xpBarWidth, 24, 0xffcc00)
            .setOrigin(0, 0).setScale(0, 1);
        this._levelText = this.add.text(64, xpBarY + 40, "LV 1",
            {fontSize: '40px', color: '#fff', fontFamily: 'future'});

        this._comboText = this.add.text(this.scale.width - 64, xpBarY + 40, "",
            {fontSize: '40px', color: '#ffcc00', fontFamily: 'future'}).setOrigin(1, 0);

        this.scene.bringToTop();

        console.log("MainUIScene created");
    }

    private onPlayerScoreChanged(_: any, value: number) {
        const scoreStr: string = value.toString().padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText.setText(scoreStr);
    }

    private onPlayerComboChanged(_: any, combo: number, previousCombo: number) {
        if (combo === previousCombo)
            return;

        // Only worth showing once it multiplies something
        this._comboText.setText(combo > 1 ? "COMBO x" + combo : "");

        if (combo > previousCombo) {
            this.tweens.add({targets: this._comboText, scale: {from: 1.4, to: 1}, duration: 200, ease: 'Back.easeOut'});
        }
    }

    private onPlayerSpawned(player: Player) {
        this._playerHealthText.setText("x" + player.getComponent(Health)?.current);

        player.getComponent(Health)?.on(Health.CHANGE_EVENT, (current: number) => {
            this._playerHealthText.setText("x" + current);
        }, this);

        const experience = player.getComponent(Experience);
        if (experience) {
            // This scene outlives a game restart: reset the bar from the new player
            this.onPlayerXpChanged(experience.xp, experience.xpToNextLevel, experience.level);
            experience.on(Experience.CHANGE_EVENT, this.onPlayerXpChanged, this);
        }
    }

    private onPlayerXpChanged(xp: number, xpToNextLevel: number, level: number) {
        this._xpBarFill.setScale(xp / xpToNextLevel, 1);
        this._levelText.setText("LV " + level);
    }
}