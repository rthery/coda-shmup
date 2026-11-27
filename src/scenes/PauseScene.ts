import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import type SaveManager from "../managers/SaveManager.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import UiUtils, {type HintPart} from "../utils/UiUtils.ts";
import UiLayout from "../utils/UiLayout.ts";
import Sfx from "../audio/Sfx.ts";

type ButtonColors = { fill: number, shade: number };

type PauseRow = {
    label: string;
    // Toggles show ON or OFF on the right, actions are solid buttons
    isOn?: () => boolean;
    button?: ButtonColors;
    // A button's face, redrawn lifted or flat
    buttonFace?: GameObjects.Graphics;
    activate: () => void;
    y: number;
    texts: GameObjects.Text[];
};

// Freezes the run behind the level-up cards' panel: sound settings, resume and quit
export default class PauseScene extends Scene {
    private static readonly STICK_THRESHOLD: number = 0.5;
    private static readonly PANEL_WIDTH: number = 820;
    private static readonly PANEL_HEIGHT: number = 640;
    private static readonly PANEL_CENTER_Y: number = 960;
    private static readonly ROW_HEIGHT: number = 92;
    private static readonly ROW_PADDING: number = 64;
    // A selected toggle row: a lighter strip with an ink bar on its left
    private static readonly ROW_HIGHLIGHT_ALPHA: number = 0.5;
    private static readonly ROW_BAR_WIDTH: number = 8;
    private static readonly ON_COLOR: string = '#2f8f52';
    private static readonly BUTTON_HEIGHT: number = 84;
    private static readonly BUTTON_RADIUS: number = 12;
    // The selected button rises by this much and shows its darker edge underneath, the others sit flat and dimmer
    private static readonly BUTTON_LIFT: number = 8;
    private static readonly SELECTED_BUTTON_LIGHTEN: number = 6; // %
    private static readonly IDLE_BUTTON_DARKEN: number = 8; // %
    private static readonly RESUME_COLORS: ButtonColors = {fill: 0x1fbf75, shade: 0x15955a};
    private static readonly QUIT_COLORS: ButtonColors = {fill: 0xe5534b, shade: 0xb23a33};

    private _rows: PauseRow[];
    private _highlight: GameObjects.Graphics;
    private _hintText: GameObjects.Container;
    private _selectedIndex: number;
    // null until the first update, so a direction held when the screen opens doesn't move the selection
    private _previousMoveY: number | null;
    private _isClosing: boolean;
    private saveManager: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.PAUSE);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this._selectedIndex = 0;
        this._previousMoveY = null;
        this._isClosing = false;
        // Above the HUD, which stays on top of the game
        this.scene.bringToTop();

        const centerX: number = UiLayout.WIDTH / 2;
        UiLayout.fitMenu(this, this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0));

        const width: number = PauseScene.PANEL_WIDTH;
        const panelTop: number = PauseScene.PANEL_CENTER_Y - PauseScene.PANEL_HEIGHT / 2;
        UiUtils.addPanel(this, centerX, PauseScene.PANEL_CENTER_Y, width, PauseScene.PANEL_HEIGHT, 'ui_header_blade_green');
        UiUtils.addHeaderTitle(this, centerX - width / 2, panelTop, 'PAUSED');

        this._highlight = this.add.graphics();
        const bodyTop: number = panelTop + UiUtils.HEADER_HEIGHT;
        this._rows = [
            {label: 'MUSIC', isOn: () => Sfx.isMusicOn,
                activate: () => Sfx.setMusicOn(this, this.saveManager, !Sfx.isMusicOn), y: bodyTop + 90, texts: []},
            {label: 'SOUND EFFECTS', isOn: () => Sfx.areEffectsOn,
                activate: () => Sfx.setEffectsOn(this.saveManager, !Sfx.areEffectsOn), y: bodyTop + 190, texts: []},
            {label: 'RESUME', button: PauseScene.RESUME_COLORS, activate: () => this.resume(), y: bodyTop + 330, texts: []},
            {label: 'QUIT RUN', button: PauseScene.QUIT_COLORS, activate: () => this.quit(), y: bodyTop + 430, texts: []},
        ];
        this._rows.forEach((row, index) => this.createRow(row, index));

        this._hintText = UiUtils.addButtonHint(this, centerX, UiLayout.HEIGHT - 200,
            this.getHintText(this.gameInputManager.activeInputType));
        this.game.events.on('input-type-changed', this.onInputTypeChanged, this);
        this.events.once('shutdown', () => {
            this.game.events.off('input-type-changed', this.onInputTypeChanged, this);
        });

        this.select(0);
    }

    private createRow(row: PauseRow, index: number) {
        const centerX: number = UiLayout.WIDTH / 2;
        const left: number = centerX - PauseScene.PANEL_WIDTH / 2 + PauseScene.ROW_PADDING;
        const right: number = centerX + PauseScene.PANEL_WIDTH / 2 - PauseScene.ROW_PADDING;
        const style = {fontSize: '40px', color: UiUtils.INK_COLOR, fontFamily: 'future'};
        if (row.isOn) {
            row.texts.push(this.add.text(left, row.y, row.label, style).setOrigin(0, 0.5));
            row.texts.push(this.add.text(right, row.y, '', style).setOrigin(1, 0.5));
        } else if (row.button) {
            row.buttonFace = this.add.graphics();
            row.texts.push(this.add.text(centerX, row.y, row.label, {...style, color: '#fff'}).setOrigin(0.5));
        }

        // The whole row is the touch target
        this.add.zone(centerX, row.y, PauseScene.rowWidth(), PauseScene.ROW_HEIGHT)
            .setInteractive({useHandCursor: true})
            .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.select(index))
            .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.activate(index));
        this.refreshRow(row);
    }

    // A solid rounded button across the row: lifted over its darker edge when selected, flat otherwise
    private drawButton(row: PauseRow, isSelected: boolean) {
        if (!row.button || !row.buttonFace)
            return;
        const width: number = PauseScene.rowWidth();
        const left: number = UiLayout.WIDTH / 2 - width / 2;
        const top: number = row.y - PauseScene.BUTTON_HEIGHT / 2;
        const lift: number = isSelected ? PauseScene.BUTTON_LIFT : 0;
        const face = Phaser.Display.Color.ValueToColor(row.button.fill);
        const faceColor: number = isSelected ? face.lighten(PauseScene.SELECTED_BUTTON_LIGHTEN).color
            : face.darken(PauseScene.IDLE_BUTTON_DARKEN).color;

        row.buttonFace.clear();
        if (isSelected)
            row.buttonFace.fillStyle(row.button.shade)
                .fillRoundedRect(left, top, width, PauseScene.BUTTON_HEIGHT, PauseScene.BUTTON_RADIUS);
        row.buttonFace.fillStyle(faceColor)
            .fillRoundedRect(left, top - lift, width, PauseScene.BUTTON_HEIGHT, PauseScene.BUTTON_RADIUS);
        row.texts[0].setY(row.y - lift);
    }

    private static rowWidth(): number {
        return PauseScene.PANEL_WIDTH - 2 * PauseScene.ROW_PADDING + 40;
    }

    private refreshRow(row: PauseRow) {
        if (!row.isOn)
            return;
        const isOn: boolean = row.isOn();
        row.texts[1].setText(isOn ? 'ON' : 'OFF').setColor(isOn ? PauseScene.ON_COLOR : UiUtils.INK_SOFT_COLOR);
    }

    private select(index: number) {
        if (index !== this._selectedIndex)
            Sfx.play(this, 'cardSelect');
        this._selectedIndex = index;

        this._rows.forEach((row, rowIndex) => this.drawButton(row, rowIndex === index));

        const row: PauseRow = this._rows[index];
        this._highlight.clear();
        if (row.button)
            return;
        const left: number = UiLayout.WIDTH / 2 - PauseScene.rowWidth() / 2;
        const top: number = row.y - PauseScene.ROW_HEIGHT / 2;
        this._highlight.fillStyle(0xffffff, PauseScene.ROW_HIGHLIGHT_ALPHA)
            .fillRect(left, top, PauseScene.rowWidth(), PauseScene.ROW_HEIGHT)
            .fillStyle(Phaser.Display.Color.HexStringToColor(UiUtils.INK_COLOR).color)
            .fillRect(left, top, PauseScene.ROW_BAR_WIDTH, PauseScene.ROW_HEIGHT);
    }

    private activate(index: number) {
        if (this._isClosing)
            return;
        this.select(index);
        const row: PauseRow = this._rows[index];
        // Toggling sound effects off would silence its own click: play it first
        Sfx.play(this, 'uiConfirm');
        row.activate();
        this.refreshRow(row);
    }

    private resume() {
        this._isClosing = true;
        this.scene.stop();
        this.scene.resume(GameConstants.SceneKeys.MAIN_GAME);
    }

    private quit() {
        this._isClosing = true;
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);
        this.scene.stop(GameConstants.SceneKeys.MAIN_GAME);
        this.scene.start(GameConstants.SceneKeys.HOME);
    }

    private onInputTypeChanged(type: InputType) {
        UiUtils.setButtonHint(this._hintText, this.getHintText(type));
    }

    private getHintText(type: InputType): HintPart[] {
        const inputManager = this.gameInputManager;
        switch (type) {
            case 'mouse': return [];
            case 'touch': return ['TAP AN OPTION'];
            case 'gamepad': return [inputManager.gamepadHintPart('confirm'), 'TO SELECT,',
                inputManager.gamepadHintPart('start'), 'TO RESUME'];
            default: return [inputManager.keyHintPart('Space'), 'TO SELECT,', inputManager.keyHintPart('Escape'),
                'TO RESUME'];
        }
    }

    update() {
        if (this._isClosing)
            return;

        if (this.gameInputManager.pauseJustPressed()) {
            this.resume();
            return;
        }

        const moveDirectionY: number = this.gameInputManager.moveDirection.y;
        const moveY: number = Math.abs(moveDirectionY) > PauseScene.STICK_THRESHOLD ? Math.sign(moveDirectionY) : 0;
        if (this._previousMoveY !== null && moveY !== 0 && moveY !== this._previousMoveY)
            this.select(Phaser.Math.Wrap(this._selectedIndex + moveY, 0, this._rows.length));
        this._previousMoveY = moveY;

        // Touch activates by tapping a row, any tap would otherwise activate the highlighted one
        if (this.gameInputManager.activeInputType !== 'touch' && this.gameInputManager.confirmJustPressed())
            this.activate(this._selectedIndex);
    }
}
