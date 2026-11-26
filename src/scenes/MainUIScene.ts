import {GameObjects, Scenes, Scene} from "phaser";
import Health from "../components/Health.ts";
import Player from "../entities/Player.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class MainUIScene extends Scene {
    private _playerHealthBar: GameObjects.Rectangle;
    private _playerHealthText: GameObjects.BitmapText;
    private _scoreText: GameObjects.BitmapText;
    private _bossHealthBar: GameObjects.Rectangle;
    private _bossHealthText: GameObjects.BitmapText;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_UI);
    }

    // noinspection JSUnusedGlobalSymbols
    init() {
        this.game.events.on(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
        this.registry.events.on('changedata-bossHealth', this.onBossHealthChanged, this);

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
            this.registry.events.off('changedata-bossHealth', this.onBossHealthChanged, this);
        }, this);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        let scoreStr: string = "".padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        if (this.registry.has(RegistryConstants.Keys.PLAYER_SCORE))
            scoreStr = this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString()
                .padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText = this.add.bitmapText(this.scale.width - 64, 64, "future-bmp", scoreStr, 128)
            .setOrigin(1, 0);

        this.add.rectangle(64, 64, 200, 24, 0x333333).setOrigin(0, 0);
        this._playerHealthBar = this.add.rectangle(64, 64, 200, 24, 0x55cc55).setOrigin(0, 0);
        this._playerHealthText = this.add.bitmapText(272, 64, "future-bmp", "100%", 64).setOrigin(0, 0);

        this.add.rectangle(this.scale.width / 2 - 200, 24, 400, 20, 0x333333).setOrigin(0, 0);
        this._bossHealthBar = this.add.rectangle(this.scale.width / 2 - 200, 24, 400, 20, 0xff55aa).setOrigin(0, 0);
        this._bossHealthText = this.add.bitmapText(this.scale.width / 2, 48, "future-bmp", "BOSS 220/220", 48).setOrigin(0.5, 0);

        this.updateBossHealth(
            Number(this.registry.get('bossHealth') ?? 220),
            Number(this.registry.get('bossMaxHealth') ?? 220)
        );

        this.scene.bringToTop();

        console.log("MainUIScene created");
    }

    private onPlayerScoreChanged(_: any, value: number) {
        const scoreStr: string = value.toString().padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText.setText(scoreStr);
    }

    private onPlayerSpawned(player: Player) {
        const health = player.getComponent(Health);
        this.updatePlayerHealth(health?.current ?? 0, health?.max ?? 1);

        health?.on(Health.CHANGE_EVENT, (current: number) => {
            this.updatePlayerHealth(current, health.max);
        }, this);
    }

    private onBossHealthChanged(_: any, value: number) {
        const max = Number(this.registry.get('bossMaxHealth') ?? value);
        this.updateBossHealth(Number(value), max);
    }

    private updatePlayerHealth(current: number, max: number) {
        const percentage = max > 0 ? Math.round(current / max * 100) : 0;
        this._playerHealthBar.setDisplaySize(200 * percentage / 100, 24);
        this._playerHealthText.setText(`${percentage}%`);

        if (percentage <= 25)
            this._playerHealthBar.setFillStyle(0xff5555);
        else if (percentage <= 50)
            this._playerHealthBar.setFillStyle(0xffaa55);
        else
            this._playerHealthBar.setFillStyle(0x55cc55);
    }

    private updateBossHealth(current: number, max: number) {
        const percentage = max > 0 ? Math.max(0, current / max) : 0;
        this._bossHealthBar.setDisplaySize(400 * percentage, 20);
        this._bossHealthText.setText(`BOSS ${current}/${max}`);

        if (percentage <= 0.25)
            this._bossHealthBar.setFillStyle(0xff5555);
        else if (percentage <= 0.5)
            this._bossHealthBar.setFillStyle(0xffaa55);
        else
            this._bossHealthBar.setFillStyle(0xff55aa);
    }
}