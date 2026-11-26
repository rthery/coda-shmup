import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import Player from "../entities/Player.ts";
import type {UpgradeCategory, UpgradeData} from "../gameData/UpgradesData.ts";
import Experience from "../components/Experience.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import UiUtils, {type UiFrame} from "../utils/UiUtils.ts";
import UiLayout from "../utils/UiLayout.ts";
import Sfx from "../audio/Sfx.ts";

export default class LevelUpScene extends Scene {
    private static readonly CHOICE_COUNT: number = 3;
    private static readonly STICK_THRESHOLD: number = 0.5;
    private static readonly CARD_WIDTH: number = 960;
    private static readonly CARD_HEIGHT: number = 320;
    private static readonly CARD_SPACING: number = 360;
    // Below the HUD, which stays on top of this screen
    private static readonly FIRST_CARD_Y: number = 760;
    private static readonly CARD_PADDING: number = 40;
    private static readonly ICON_SCALE: number = 3;
    private static readonly ICON_TEXT_GAP: number = 32;
    // The selected card rises over its shadow, the others stay down and dimmer, like the pause buttons
    private static readonly CARD_LIFT: number = 14;
    // And steps out of the column to the right: a lift alone reads as spacing in a vertical stack
    private static readonly CARD_NUDGE: number = 30;
    private static readonly CARD_SHADOW_ALPHA: number = 0.45;
    private static readonly CARD_SHADOW_RADIUS: number = 18;
    private static readonly CARD_ALPHA: number = 0.8;
    // Rank pips: slanted like the combo pips
    private static readonly PIP_WIDTH: number = 26;
    private static readonly PIP_HEIGHT: number = 20;
    private static readonly PIP_SKEW: number = 7;
    private static readonly PIP_GAP: number = 8;
    // The rank block, top right of the body: "RANK 2/5" level with the title, the pips under it, clear of the stat line
    private static readonly RANK_LABEL_OFFSET_Y: number = -44;
    private static readonly RANK_PIPS_OFFSET_Y: number = -2;
    private static readonly RANK_LABEL_GAP: number = 10;
    private static readonly PIP_OWNED_COLOR: number = 0xf5c542;
    private static readonly PIP_EMPTY_COLOR: number = 0x4a5263;
    private static readonly PIP_EMPTY_ALPHA: number = 0.25;
    private static readonly NEXT_VALUE_COLOR: string = '#2f8f52';
    // Entrance: the title drops in, then the cards slide in from the right one after another
    private static readonly CARDS_DELAY: number = 250;
    private static readonly CARD_STAGGER: number = 90;
    private static readonly CARD_SLIDE_DURATION: number = 400;
    private static readonly CATEGORY_FRAMES: Record<UpgradeCategory, UiFrame> = {
        weapon: 'ui_header_blade_red',
        // Blue like the ship
        ship: 'ui_header_blade_blue',
    };
    private static readonly CATEGORY_ICONS: Record<UpgradeCategory, string> = {
        weapon: 'ui_icon_weapon',
        ship: 'ui_icon_ship',
    };

    private _player: Player;
    private _upgrades: UpgradeData[];
    private _cards: GameObjects.Container[];
    private _hintText: GameObjects.Text;
    private _selectedIndex: number;
    // null until the first update, so a direction held when the screen opens doesn't move the selection
    private _previousMoveY: number | null;
    private _chosen: boolean;
    // Input waits for the entrance, so a key held from the game can't pick a card by accident
    private _isReady: boolean;

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
        this._isReady = false;
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        Sfx.play(this, 'levelUp');
        const centerX: number = UiLayout.WIDTH / 2;

        const dim = this.add.rectangle(0, 0, 1, 1, 0x000000, 0.7).setOrigin(0);
        UiLayout.fitMenu(this, dim);
        this.tweens.add({targets: dim, alpha: {from: 0, to: 1}, duration: 150});
        const title = this.add.text(centerX, 440, 'LEVEL UP!',
            {fontSize: '80px', color: '#ffcc00', fontFamily: 'future'}).setOrigin(0.5);
        this.tweens.add({targets: title, alpha: {from: 0, to: 1}, scale: {from: 2, to: 1}, duration: 350, ease: 'Back.easeOut'});
        this.add.particles(centerX, title.y, 'shapes', {
            frame: 'star_04',
            speed: {min: 200, max: 500},
            angle: {min: 0, max: 360},
            scale: {start: 0.3, end: 0},
            lifespan: {min: 400, max: 700},
            tint: [0xffcc00, 0xffe680, 0xffffff],
            blendMode: 'ADD',
            emitting: false
        }).explode(24);
        const level: number = this._player.getComponent(Experience)?.level ?? 1;
        const levelText = this.add.text(centerX, 530, `LEVEL ${level} REACHED`,
            {fontSize: '36px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);
        this.tweens.add({targets: levelText, alpha: {from: 0, to: 1}, y: {from: levelText.y + 20, to: levelText.y},
            delay: 150, duration: 250, ease: 'Quad.easeOut'});

        // Maxed upgrades aren't offered anymore
        const allUpgrades = this.cache.json.get('upgrades') as UpgradeData[];
        const availableUpgrades = allUpgrades.filter(upgrade => this._player.isUpgradeAvailable(upgrade));
        this._upgrades = Phaser.Utils.Array.Shuffle(availableUpgrades).slice(0, LevelUpScene.CHOICE_COUNT);
        if (this._upgrades.length === 0) {
            this.close();
            return;
        }

        this._upgrades.forEach((upgrade, index) => {
            const cardY: number = LevelUpScene.FIRST_CARD_Y + index * LevelUpScene.CARD_SPACING;
            this._cards.push(this.createCard(upgrade, index, centerX, cardY));
        });

        this._hintText = this.add.text(centerX, UiLayout.HEIGHT - 200,
            this.getHintText(this.gameInputManager.activeInputType),
            {fontSize: '32px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5).setAlpha(0);

        const offscreenX: number = UiLayout.visibleArea(this).right + LevelUpScene.CARD_WIDTH / 2;
        // Off screen right away: a delayed tween only applies its start value once the delay is over
        this._cards.forEach((card, index) => this.tweens.add({
            targets: card.setX(offscreenX),
            x: centerX,
            delay: LevelUpScene.CARDS_DELAY + index * LevelUpScene.CARD_STAGGER,
            duration: LevelUpScene.CARD_SLIDE_DURATION,
            ease: 'Back.easeOut'
        }));
        const entranceDuration: number = LevelUpScene.CARDS_DELAY
            + (this._cards.length - 1) * LevelUpScene.CARD_STAGGER + LevelUpScene.CARD_SLIDE_DURATION;
        this.time.delayedCall(entranceDuration, () => this.onEntranceComplete());
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
        const categoryText = UiUtils.addHeaderTitle(this, -halfWidth, top, upgrade.category.toUpperCase());
        // The category icon on the left of the body, the texts beside it
        const icon = this.add.image(0, bodyCenterY, 'sprites', LevelUpScene.CATEGORY_ICONS[upgrade.category])
            .setScale(LevelUpScene.ICON_SCALE);
        icon.setX(-halfWidth + LevelUpScene.CARD_PADDING + icon.displayWidth / 2);
        const textX: number = icon.x + icon.displayWidth / 2 + LevelUpScene.ICON_TEXT_GAP;
        const titleText = this.add.text(textX, bodyCenterY - 32, upgrade.title,
            {fontSize: '60px', color: UiUtils.INK_COLOR, fontFamily: 'future'}).setOrigin(0, 0.5);
        // The exact change instead of a generic description: "FIRE RATE 2.0 -> 2.4 /S"
        const preview = this._player.getUpgradePreview(upgrade);
        const currentText = this.add.text(textX, bodyCenterY + 44, `${preview.stat} ${preview.current} → `,
            {fontSize: '36px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future'}).setOrigin(0, 0.5);
        const nextText = this.add.text(currentText.x + currentText.width, currentText.y, preview.next,
            {fontSize: '36px', color: LevelUpScene.NEXT_VALUE_COLOR, fontFamily: 'future'}).setOrigin(0, 0.5);

        const rankBlock = this.createRankBlock(upgrade, halfWidth - LevelUpScene.CARD_PADDING, bodyCenterY);
        // Where the card rests: it shows below the card once lifted
        const shadow = this.add.graphics().setVisible(false)
            .fillStyle(0x000000, LevelUpScene.CARD_SHADOW_ALPHA)
            .fillRoundedRect(-halfWidth, top + LevelUpScene.CARD_LIFT, LevelUpScene.CARD_WIDTH, LevelUpScene.CARD_HEIGHT,
                LevelUpScene.CARD_SHADOW_RADIUS);
        return this.add.container(x, y, [shadow, panel, categoryText, icon, titleText, currentText, nextText, ...rankBlock])
            .setData('restX', x).setData('restY', y).setData('shadow', shadow);
    }

    // One pip per rank: gold when owned, the one this pick adds blinks
    // The rank this pick reaches, over one pip per rank. Unranked upgrades have none
    private createRankBlock(upgrade: UpgradeData, right: number, bodyCenterY: number): GameObjects.GameObject[] {
        if (upgrade.maxRank === null)
            return [];
        const labelY: number = bodyCenterY + LevelUpScene.RANK_LABEL_OFFSET_Y;
        const value = this.add.text(right, labelY, `${this._player.getUpgradeRank(upgrade.id) + 1}/${upgrade.maxRank}`,
            {fontSize: '40px', color: UiUtils.INK_COLOR, fontFamily: 'future'}).setOrigin(1, 0.5);
        const label = this.add.text(value.x - value.width - LevelUpScene.RANK_LABEL_GAP, labelY, 'RANK',
            {fontSize: '28px', color: UiUtils.INK_SOFT_COLOR, fontFamily: 'future'}).setOrigin(1, 0.5);
        return [label, value, ...this.createRankPips(upgrade, right, bodyCenterY + LevelUpScene.RANK_PIPS_OFFSET_Y)];
    }

    private createRankPips(upgrade: UpgradeData, right: number, y: number): GameObjects.Polygon[] {
        if (upgrade.maxRank === null)
            return [];
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

    private onEntranceComplete() {
        this._isReady = true;
        // Placed again now the cards have landed
        this.select(this._selectedIndex);
        this.tweens.add({targets: this._hintText, alpha: 1, duration: 250});
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
        if (this._chosen || !this._isReady)
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
        // Not for the first selection, nor the one placed again once the cards land
        if (this._isReady && index !== this._selectedIndex)
            Sfx.play(this, 'cardSelect');
        this._selectedIndex = index;

        this._cards.forEach((card, cardIndex) => {
            const isSelected: boolean = cardIndex === index;
            card.setY(card.getData('restY') - (isSelected ? LevelUpScene.CARD_LIFT : 0))
                .setAlpha(isSelected ? 1 : LevelUpScene.CARD_ALPHA);
            // The entrance slide owns x until the cards land
            if (this._isReady)
                card.setX(card.getData('restX') + (isSelected ? LevelUpScene.CARD_NUDGE : 0));
            (card.getData('shadow') as GameObjects.Graphics).setVisible(isSelected);
        });
    }

    private choose(index: number) {
        if (this._chosen || !this._isReady)
            return;
        this._chosen = true;

        Sfx.play(this, 'cardPick');
        this._player.applyUpgrade(this._upgrades[index]);
        this.close();
    }

    private close() {
        this.scene.stop();
        this.scene.resume(GameConstants.SceneKeys.MAIN_GAME);
        this.game.events.emit(GameConstants.Events.LEVEL_UP_CLOSED_EVENT);
    }
}
