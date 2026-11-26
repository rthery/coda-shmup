import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import type SaveManager from "../managers/SaveManager.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import UiUtils from "../utils/UiUtils.ts";
import UiLayout from "../utils/UiLayout.ts";
import Sfx from "../audio/Sfx.ts";

type PauseRow = {
    label: string;
    // Toggles show ON or OFF on the right, actions are centered
    isOn?: () => boolean;
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
    private static readonly HIGHLIGHT_COLOR: number = 0x4a9be0;
    private static readonly HIGHLIGHT_ALPHA: number = 0.2;
    private static readonly ON_COLOR: string = '#2f8f52';

    private _rows: PauseRow[];
    private _highlight: GameObjects.Graphics;
    private _hintText: GameObjects.Text;
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
            {label: 'RESUME', activate: () => this.resume(), y: bodyTop + 330, texts: []},
            {label: 'QUIT RUN', activate: () => this.quit(), y: bodyTop + 430, texts: []},
        ];
        this._rows.forEach((row, index) => this.createRow(row, index));

        this._hintText = this.add.text(centerX, UiLayout.HEIGHT - 200, this.getHintText(this.gameInputManager.activeInputType),
            {fontSize: '32px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);
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
        } else {
            row.texts.push(this.add.text(centerX, row.y, row.label, {...style, fontSize: '44px'}).setOrigin(0.5));
        }

        // The whole row is the touch target
        this.add.zone(centerX, row.y, PauseScene.PANEL_WIDTH - 2 * PauseScene.ROW_PADDING + 40, PauseScene.ROW_HEIGHT)
            .setInteractive({useHandCursor: true})
            .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.select(index))
            .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.activate(index));
        this.refreshRow(row);
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

        const row: PauseRow = this._rows[index];
        const width: number = PauseScene.PANEL_WIDTH - 2 * PauseScene.ROW_PADDING + 40;
        this._highlight.clear().fillStyle(PauseScene.HIGHLIGHT_COLOR, PauseScene.HIGHLIGHT_ALPHA)
            .fillRoundedRect(UiLayout.WIDTH / 2 - width / 2, row.y - PauseScene.ROW_HEIGHT / 2,
                width, PauseScene.ROW_HEIGHT, 12);
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
        this._hintText.setText(this.getHintText(type));
    }

    private getHintText(type: InputType): string {
        switch (type) {
            case 'touch': return 'TAP AN OPTION';
            case 'gamepad': return 'A TO SELECT, START TO RESUME';
            default: return 'SPACE TO SELECT, ESC TO RESUME';
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
