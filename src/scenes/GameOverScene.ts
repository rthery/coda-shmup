import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveConstants from "../SaveConstants.ts";
import type SaveManager from "../managers/SaveManager.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import UiUtils, {type HintPart} from "../utils/UiUtils.ts";
import UiLayout from "../utils/UiLayout.ts";
import Sfx from "../audio/Sfx.ts";

export default class GameOverScene extends Phaser.Scene {
    private static readonly DIM_ALPHA: number = 0.7;
    private static readonly SCORE_COUNT_DURATION: number = 900;
    private static readonly LINE_STAGGER: number = 150;
    private static readonly LINE_RISE: number = 30;
    // The level-up cards' panel, with a green tab: red and blue mean weapon and ship there
    private static readonly PANEL_WIDTH: number = 880;
    private static readonly PANEL_HEIGHT: number = 600;
    private static readonly PANEL_CENTER_Y: number = 1000;
    // Gold readable on the light panel
    private static readonly NEW_BEST_COLOR: string = '#c78f00';

    private _promptText: Phaser.GameObjects.Container;
    private _started: boolean = false;
    private _revealed: boolean = false;
    // Final state of everything the reveal animates, applied at once when the player skips it
    private _finalStates: { target: object, apply: () => void }[];
    private saveManager: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.GAME_OVER);
    }

    create() {
        Sfx.play(this, 'gameOver');
        // The music steps back behind the results
        Sfx.fadeMusic(this, 0.4, 800);
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);

        this._started = false;
        this._revealed = false;
        this._finalStates = [];

        const centerX: number = UiLayout.WIDTH / 2;
        const dim = this.add.rectangle(0, 0, 1, 1, 0x000000, GameOverScene.DIM_ALPHA).setOrigin(0);
        UiLayout.fitMenu(this, dim);
        this.reveal(dim, 0, {alpha: {from: 0, to: 1}}, 300);

        const title = this.add.text(centerX, 560, 'GAME OVER', {fontSize: '120px', color: '#fff', fontFamily: 'future'})
            .setOrigin(0.5).setShadow(0, 8, '#000', 0, false, true);
        this.reveal(title, 100, {alpha: {from: 0, to: 1}, scale: {from: 1.6, to: 1}}, 400, 'Back.easeOut');

        const panel = UiUtils.addPanel(this, centerX, GameOverScene.PANEL_CENTER_Y, GameOverScene.PANEL_WIDTH,
            GameOverScene.PANEL_HEIGHT, 'ui_header_blade_green');
        this.reveal(panel, 350, {scaleY: {from: 0, to: UiUtils.PANEL_SCALE}, alpha: {from: 0, to: 1}}, 250);
        const panelTop: number = GameOverScene.PANEL_CENTER_Y - GameOverScene.PANEL_HEIGHT / 2;
        const tabText = this.add.text(centerX - GameOverScene.PANEL_WIDTH / 2 + 40, panelTop + UiUtils.HEADER_HEIGHT / 2,
            'RESULTS', {fontSize: '32px', color: '#fff', fontFamily: 'future'}).setOrigin(0, 0.5);
        this.reveal(tabText, 500, {alpha: {from: 0, to: 1}}, 200);

        const scoreLabel = this.add.text(centerX, 850, 'SCORE',
            {fontSize: '36px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future', letterSpacing: 12})
            .setOrigin(0.5);
        this.reveal(scoreLabel, 450, {alpha: {from: 0, to: 1}}, 200);

        const score: number = this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0;
        const scoreText = this.add.text(centerX, 945, GameOverScene.formatScore(0),
            {fontSize: '104px', color: UiUtils.INK_COLOR, fontFamily: 'future'}).setOrigin(0.5);
        this.countScore(scoreText, score, 550);

        const bestScore: number = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        // Best scores saved before coop were solo
        const bestScorePlayers: number = Number(this.saveManager.getData(SaveConstants.Keys.PLAYER_BEST_SCORE_PLAYERS) ?? 1);
        const isNewBestScore: boolean = this.registry.get(RegistryConstants.Keys.IS_NEW_BEST_SCORE) ?? false;
        const linesDelay: number = 550 + GameOverScene.SCORE_COUNT_DURATION + 100;
        const bestText = this.add.text(centerX, 1070, isNewBestScore ? 'NEW BEST!' : `BEST ${GameOverScene.formatScore(bestScore)} (${bestScorePlayers}P)`, {
            fontSize: '44px', fontFamily: 'future',
            color: isNewBestScore ? GameOverScene.NEW_BEST_COLOR : UiUtils.INK_SOFT_COLOR
        }).setOrigin(0.5);
        if (isNewBestScore)
            this.revealNewBest(bestText, linesDelay);
        else
            this.revealLine(bestText, linesDelay);

        const level: number = this.registry.get(RegistryConstants.Keys.PLAYER_LEVEL) ?? 1;
        this.revealLine(this.add.text(centerX, 1150, `LEVEL ${level}`,
            {fontSize: '44px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future'}).setOrigin(0.5),
            linesDelay + GameOverScene.LINE_STAGGER);
        const runTime: number = this.registry.get(RegistryConstants.Keys.RUN_TIME) ?? 0;
        this.revealLine(this.add.text(centerX, 1230, `TIME ${UiUtils.formatTime(runTime)}`,
            {fontSize: '44px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future'}).setOrigin(0.5),
            linesDelay + 2 * GameOverScene.LINE_STAGGER);

        this._promptText = UiUtils.addPulsingButtonHint(this, centerX, UiLayout.HEIGHT - 220,
            this._getPromptText(this.gameInputManager.activeInputType)).setVisible(false);
        this.time.delayedCall(linesDelay + 3 * GameOverScene.LINE_STAGGER + 300, () => this.finishReveal());

        this.game.events.on('input-type-changed', this._onInputTypeChanged, this);
        this.events.once('shutdown', () => {
            this.game.events.off('input-type-changed', this._onInputTypeChanged, this);
        });

        console.log("GameOverScene created");
    }

    private static formatScore(score: number): string {
        return Math.round(score).toString().padStart(GameConstants.MAX_SCORE_DIGITS, "0");
    }

    // Tweens target from the given values to its current ones
    private reveal(target: Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle | Phaser.GameObjects.NineSlice, delay: number,
                   props: Phaser.Types.Tweens.TweenBuilderConfig['props'] | object, duration: number,
                   ease: string = 'Quad.easeOut') {
        const finalAlpha: number = target.alpha;
        const finalScale: number = target.scale;
        const finalY: number = target.y;
        this._finalStates.push({target, apply: () => target.setAlpha(finalAlpha).setScale(finalScale).setY(finalY)});
        target.setAlpha(0);
        this.tweens.add({targets: target, delay, duration, ease, ...props});
    }

    private revealLine(text: Phaser.GameObjects.Text, delay: number) {
        this.reveal(text, delay, {alpha: {from: 0, to: 1}, y: {from: text.y + GameOverScene.LINE_RISE, to: text.y}}, 300);
    }

    // Pops in gold with a burst of stars
    private revealNewBest(text: Phaser.GameObjects.Text, delay: number) {
        this.reveal(text, delay, {alpha: {from: 0, to: 1}, scale: {from: 2, to: 1}}, 450, 'Back.easeOut');
        const stars = this.add.particles(text.x, text.y, 'shapes', {
            frame: 'star_04',
            speed: {min: 250, max: 600},
            angle: {min: 0, max: 360},
            scale: {start: 0.35, end: 0},
            lifespan: {min: 500, max: 900},
            tint: [0xffcc00, 0xffe680, 0xffffff],
            blendMode: 'ADD',
            emitting: false
        });
        this.time.delayedCall(delay + 150, () => {
            stars.explode(32);
            Sfx.play(this, 'newBest');
            this.cameras.main.flash(150, 255, 220, 120);
        });
    }

    private countScore(text: Phaser.GameObjects.Text, score: number, delay: number) {
        const counter = {value: 0};
        this._finalStates.push({target: counter, apply: () => text.setText(GameOverScene.formatScore(score))});
        this._finalStates.push({target: text, apply: () => text.setScale(1)});
        this.tweens.add({
            targets: counter,
            value: score,
            delay,
            duration: GameOverScene.SCORE_COUNT_DURATION,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                text.setText(GameOverScene.formatScore(counter.value));
                Sfx.play(this, 'scoreTick');
            },
            onComplete: () => {
                text.setText(GameOverScene.formatScore(score));
                this.tweens.add({targets: text, scale: {from: 1.15, to: 1}, duration: 200, ease: 'Back.easeOut'});
            }
        });
    }

    // Skipping jumps every animated element to its final state
    private finishReveal() {
        if (this._revealed)
            return;
        this._revealed = true;

        this._finalStates.forEach(state => {
            this.tweens.killTweensOf(state.target);
            state.apply();
        });
        this._promptText.setVisible(true);
    }

    private _onInputTypeChanged(type: InputType): void {
        if (!this._started) {
            UiUtils.setButtonHint(this._promptText, this._getPromptText(type));
        }
    }

    private _getPromptText(type: InputType): HintPart[] {
        const inputManager = this.gameInputManager;
        switch (type) {
            case 'touch': return ['TAP TO PLAY AGAIN'];
            case 'gamepad': return [inputManager.gamepadHintPart('confirm'), 'OR', inputManager.gamepadHintPart('start'),
                'TO PLAY AGAIN'];
            default: return ['SPACE TO PLAY AGAIN'];
        }
    }

    update() {
        if (!this._started && this.gameInputManager.confirmJustPressed()) {
            // The first press only skips the reveal
            if (!this._revealed) {
                this.finishReveal();
                return;
            }
            this._started = true;
            Sfx.play(this, 'uiConfirm');
            this.scene.stop(GameConstants.SceneKeys.MAIN_GAME);
            this.scene.start(GameConstants.SceneKeys.HOME);
        }
    }
}
