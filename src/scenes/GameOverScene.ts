import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import type {InputType} from "../managers/GameInputManager.ts";

export default class GameOverScene extends Phaser.Scene {
    private _promptText: Phaser.GameObjects.Text;
    private _started: boolean = false;

    constructor() {
        super(GameConstants.SceneKeys.GAME_OVER);
    }

    create() {
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);

        this._started = false;

        const screenCenterX: number = this.scale.width / 2;
        this.add.text(screenCenterX, this.scale.width / 2, 'GAME OVER',
            {fontSize: '96px', color: '#fff', align: 'center'}).setOrigin(0.5);
        this.add.text(screenCenterX, 32, "SCORE",
            {fontSize: '48px', align: 'center'}).setOrigin(0.5);
        this.add.text(screenCenterX, 72, this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString(),
            {fontSize: '32px', color: '#fff', align: 'center'}).setOrigin(0.5);

        this._promptText = this.add.text(
            screenCenterX,
            this.scale.height - 256,
            this._getPromptText(this.gameInputManager.activeInputType),
            {fontSize: '32px', color: '#fff', align: 'center'}
        ).setOrigin(0.5);

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
            case 'touch': return 'Tap to play again';
            case 'gamepad': return 'Press A or START to play again';
            default: return 'Press SPACE to play again';
        }
    }

    update() {
        if (!this._started && this.gameInputManager.confirmJustPressed()) {
            this._started = true;
            this.scene.start(GameConstants.SceneKeys.HOME);
        }
    }
}
