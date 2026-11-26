import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import Player from "../entities/Player.ts";
import type {UpgradeCategory, UpgradeData} from "../gameData/UpgradesData.ts";
import Experience from "../components/Experience.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import UiUtils, {type UiFrame} from "../utils/UiUtils.ts";

export default class LevelUpScene extends Scene {
    private static readonly CHOICE_COUNT: number = 3;
    private static readonly STICK_THRESHOLD: number = 0.5;
    private static readonly CARD_WIDTH: number = 900;
    private static readonly CARD_HEIGHT: number = 280;
    private static readonly CARD_SPACING: number = 320;
    private static readonly SELECTED_CARD_SCALE: number = 1.04;
    private static readonly CARD_SCALE: number = 0.96;
    private static readonly CARD_ALPHA: number = 0.8;
    // Rank pips in the header, left of the crosshair: slanted like the combo pips
    private static readonly PIP_WIDTH: number = 26;
    private static readonly PIP_HEIGHT: number = 20;
    private static readonly PIP_SKEW: number = 7;
    private static readonly PIP_GAP: number = 8;
    private static readonly PIPS_RIGHT_MARGIN: number = 150;
    private static readonly PIP_OWNED_COLOR: number = 0xf5c542;
    private static readonly PIP_EMPTY_COLOR: number = 0x4a5263;
    private static readonly PIP_EMPTY_ALPHA: number = 0.25;
    private static readonly NEXT_VALUE_COLOR: string = '#2f8f52';
    private static readonly CATEGORY_FRAMES: Record<UpgradeCategory, UiFrame> = {
        weapon: 'ui_header_blade_red',
        ship: 'ui_header_blade_green',
    };

    private _player: Player;
    private _upgrades: UpgradeData[];
    private _cards: GameObjects.Container[];
    private _crosshair: GameObjects.Image;
    private _hintText: GameObjects.Text;
    private _selectedIndex: number;
    // null until the first update, so a direction held when the screen opens doesn't move the selection
    private _previousMoveY: number | null;
    private _chosen: boolean;

    constructor() {
        super(GameConstants.SceneKeys.LEVEL_UP);
    }

    // noinspection JSUnusedGlobalSymbols
    init(data: { player: Player }) {
        this._player = data.player;
        this._cards = [];
        this._selectedIndex = 0;
        this._previousMoveY = null;
        this._chosen = false;
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        const centerX: number = this.scale.width / 2;

        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7).setOrigin(0);
        this.add.text(centerX, 440, 'LEVEL UP!',
            {fontSize: '80px', color: '#ffcc00', fontFamily: 'future'}).setOrigin(0.5);
        const level: number = this._player.getComponent(Experience)?.level ?? 1;
        this.add.text(centerX, 530, `LEVEL ${level} REACHED`,
            {fontSize: '36px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);

        // Maxed upgrades aren't offered anymore
        const allUpgrades = this.cache.json.get('upgrades') as UpgradeData[];
        const availableUpgrades = allUpgrades.filter(upgrade => this._player.getUpgradeRank(upgrade.id) < upgrade.maxRank);
        this._upgrades = Phaser.Utils.Array.Shuffle(availableUpgrades).slice(0, LevelUpScene.CHOICE_COUNT);
        if (this._upgrades.length === 0) {
            this.close();
            return;
        }

        this._upgrades.forEach((upgrade, index) => {
            const cardY: number = 760 + index * LevelUpScene.CARD_SPACING;
            this._cards.push(this.createCard(upgrade, index, centerX, cardY));
        });

        this._crosshair = this.add.image(0, 0, "sprites", "ui_crosshair");

        this._hintText = this.add.text(centerX, this.scale.height - 200,
            this.getHintText(this.gameInputManager.activeInputType),
            {fontSize: '32px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);
        this.game.events.on('input-type-changed', this.onInputTypeChanged, this);
        this.events.once('shutdown', () => {
            this.game.events.off('input-type-changed', this.onInputTypeChanged, this);
        });

        this.select(0);
    }

    private createCard(upgrade: UpgradeData, index: number, x: number, y: number): GameObjects.Container {
        const halfWidth: number = LevelUpScene.CARD_WIDTH / 2;
        const top: number = -LevelUpScene.CARD_HEIGHT / 2;
        const bodyCenterY: number = top + UiUtils.HEADER_HEIGHT + (LevelUpScene.CARD_HEIGHT - UiUtils.HEADER_HEIGHT) / 2;

        const panel = UiUtils.addPanel(this, 0, 0, LevelUpScene.CARD_WIDTH, LevelUpScene.CARD_HEIGHT,
            LevelUpScene.CATEGORY_FRAMES[upgrade.category])
            .setInteractive({useHandCursor: true})
            .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.select(index))
            .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.choose(index));
        const categoryText = this.add.text(-halfWidth + 40, top + UiUtils.HEADER_HEIGHT / 2,
            upgrade.category.toUpperCase(), {fontSize: '32px', color: '#fff', fontFamily: 'future'})
            .setOrigin(0, 0.5);
        const titleText = this.add.text(-halfWidth + 48, bodyCenterY - 28, upgrade.title,
            {fontSize: '52px', color: UiUtils.INK_COLOR, fontFamily: 'future'}).setOrigin(0, 0.5);
        // The exact change instead of a generic description: "FIRE RATE 2.0 -> 2.4 /S"
        const preview = this._player.getUpgradePreview(upgrade);
        const currentText = this.add.text(-halfWidth + 48, bodyCenterY + 40, `${preview.stat} ${preview.current} → `,
            {fontSize: '32px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future'}).setOrigin(0, 0.5);
        const nextText = this.add.text(currentText.x + currentText.width, currentText.y, preview.next,
            {fontSize: '32px', color: LevelUpScene.NEXT_VALUE_COLOR, fontFamily: 'future'}).setOrigin(0, 0.5);

        const pips = this.createRankPips(upgrade, halfWidth - LevelUpScene.PIPS_RIGHT_MARGIN, top + UiUtils.HEADER_HEIGHT / 2);
        return this.add.container(x, y, [panel, categoryText, titleText, currentText, nextText, ...pips]);
    }

    // One pip per rank: gold when owned, the one this pick adds blinks
    private createRankPips(upgrade: UpgradeData, right: number, y: number): GameObjects.Polygon[] {
        const rank: number = this._player.getUpgradeRank(upgrade.id);
        const step: number = LevelUpScene.PIP_WIDTH + LevelUpScene.PIP_GAP;
        const firstX: number = right - LevelUpScene.PIP_WIDTH / 2 - (upgrade.maxRank - 1) * step;
        const shape: number[] = [
            LevelUpScene.PIP_SKEW, 0,
            LevelUpScene.PIP_WIDTH, 0,
            LevelUpScene.PIP_WIDTH - LevelUpScene.PIP_SKEW, LevelUpScene.PIP_HEIGHT,
            0, LevelUpScene.PIP_HEIGHT
        ];

        const pips: GameObjects.Polygon[] = [];
        for (let i = 0; i < upgrade.maxRank; i++) {
            const pip = this.add.polygon(firstX + i * step, y, shape).setOrigin(0.5);
            if (i < rank) {
                pip.setFillStyle(LevelUpScene.PIP_OWNED_COLOR, 1);
            } else if (i === rank) {
                pip.setFillStyle(LevelUpScene.PIP_OWNED_COLOR, 1);
                this.tweens.add({targets: pip, alpha: {from: 1, to: 0.2}, duration: 400, yoyo: true, repeat: -1});
            } else {
                pip.setFillStyle(LevelUpScene.PIP_EMPTY_COLOR, LevelUpScene.PIP_EMPTY_ALPHA);
            }
            pips.push(pip);
        }
        return pips;
    }

    private onInputTypeChanged(type: InputType) {
        this._hintText.setText(this.getHintText(type));
    }

    private getHintText(type: InputType): string {
        switch (type) {
            case 'touch': return 'TAP A CARD TO PICK';
            case 'gamepad': return 'UP / DOWN TO CHOOSE, A TO PICK';
            default: return 'UP / DOWN TO CHOOSE, SPACE TO PICK';
        }
    }

    update() {
        if (this._chosen)
            return;

        const moveDirectionY: number = this.gameInputManager.moveDirection.y;
        const moveY: number = Math.abs(moveDirectionY) > LevelUpScene.STICK_THRESHOLD ? Math.sign(moveDirectionY) : 0;
        if (this._previousMoveY !== null && moveY !== 0 && moveY !== this._previousMoveY) {
            this.select(Phaser.Math.Wrap(this._selectedIndex + moveY, 0, this._cards.length));
        }
        this._previousMoveY = moveY;

        // Touch picks by tapping a card, any tap would otherwise confirm the highlighted one
        if (this.gameInputManager.activeInputType !== 'touch' && this.gameInputManager.confirmJustPressed()) {
            this.choose(this._selectedIndex);
        }
    }

    private select(index: number) {
        this._selectedIndex = index;

        this._cards.forEach((card, cardIndex) => {
            const isSelected: boolean = cardIndex === index;
            card.setScale(isSelected ? LevelUpScene.SELECTED_CARD_SCALE : LevelUpScene.CARD_SCALE)
                .setAlpha(isSelected ? 1 : LevelUpScene.CARD_ALPHA);
        });

        const selectedCard = this._cards[index];
        const crosshairOffset: number = LevelUpScene.CARD_WIDTH / 2 * LevelUpScene.SELECTED_CARD_SCALE - 70;
        this._crosshair.setPosition(selectedCard.x + crosshairOffset, selectedCard.y + UiUtils.HEADER_HEIGHT / 2);
    }

    private choose(index: number) {
        if (this._chosen)
            return;
        this._chosen = true;

        this._player.applyUpgrade(this._upgrades[index]);
        this.close();
    }

    private close() {
        this.scene.stop();
        this.scene.resume(GameConstants.SceneKeys.MAIN_GAME);
        this.game.events.emit(GameConstants.Events.LEVEL_UP_CLOSED_EVENT);
    }
}
