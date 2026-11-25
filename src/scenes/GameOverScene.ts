import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveConstants from "../SaveConstants.ts";
import type SaveManager from "../managers/SaveManager.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import UiUtils from "../utils/UiUtils.ts";

export default class GameOverScene extends Phaser.Scene {
    private static readonly DIM_ALPHA: number = 0.7;

    private _promptText: Phaser.GameObjects.Text;
    private _started: boolean = false;
    private saveManager: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.GAME_OVER);
    }

    create() {
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);

        this._started = false;

        const centerX: number = this.scale.width / 2;
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, GameOverScene.DIM_ALPHA).setOrigin(0);

        this.add.text(centerX, 560, 'GAME OVER', {fontSize: '120px', color: '#fff', fontFamily: 'future'})
            .setOrigin(0.5).setShadow(0, 8, '#000', 0, false, true);

        this.add.text(centerX, 800, 'SCORE',
            {fontSize: '36px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future', letterSpacing: 12})
            .setOrigin(0.5);
        const scoreStr: string = this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString()
            .padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this.add.text(centerX, 900, scoreStr, {fontSize: '104px', color: '#fff', fontFamily: 'future'})
            .setOrigin(0.5);

        const bestScore: number = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        const isNewBestScore: boolean = this.registry.get(RegistryConstants.Keys.IS_NEW_BEST_SCORE) ?? false;
        const bestStr: string = bestScore.toString().padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this.add.text(centerX, 1040, isNewBestScore ? 'NEW BEST!' : `BEST ${bestStr}`, {
            fontSize: '44px', fontFamily: 'future',
            color: isNewBestScore ? UiUtils.YELLOW_COLOR : UiUtils.INK_SOFT_COLOR
        }).setOrigin(0.5);
        const level: number = this.registry.get(RegistryConstants.Keys.PLAYER_LEVEL) ?? 1;
        this.add.text(centerX, 1120, `LEVEL ${level}`,
            {fontSize: '44px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future'}).setOrigin(0.5);

        this._promptText = UiUtils.addHint(this, centerX, this.scale.height - 220,
            this._getPromptText(this.gameInputManager.activeInputType));

        this.game.events.on('input-type-changed', this._onInputTypeChanged, this);
        this.events.once('shutdown', () => {
            this.game.events.off('input-type-changed', this._onInputTypeChanged, this);
        });

        console.log("GameOverScene created");
    }

    private _onInputTypeChanged(type: InputType): void {
        if (!this._started) {
            this._promptText.setText(this._getPromptText(type));
        }
    }

    private _getPromptText(type: InputType): string {
        switch (type) {
            case 'touch': return 'TAP TO PLAY AGAIN';
            case 'gamepad': return 'A OR START TO PLAY AGAIN';
            default: return 'SPACE TO PLAY AGAIN';
        }
    }

    update() {
        if (!this._started && this.gameInputManager.confirmJustPressed()) {
            this._started = true;
            this.scene.stop(GameConstants.SceneKeys.MAIN_GAME);
            this.scene.start(GameConstants.SceneKeys.HOME);
        }
    }
}
