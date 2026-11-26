import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import Player from "../entities/Player.ts";
import type {UpgradeCategory, UpgradeData} from "../gameData/UpgradesData.ts";
import type {InputType} from "../managers/GameInputManager.ts";
import type {InputDevice} from "../managers/PlayerInput.ts";
import UiUtils, {type HintPart, type UiFrame} from "../utils/UiUtils.ts";
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
    // Entrance: the title drops in, then the cards slide in from the right one after another
    private static readonly CARDS_DELAY: number = 250;
    private static readonly CARD_STAGGER: number = 90;
    private static readonly CARD_SLIDE_DURATION: number = 400;
    // A bot's pick, once its cards have landed: long enough to see it
    private static readonly BOT_PICK_DELAY: number = 700; // ms
    private static readonly CATEGORY_FRAMES: Record<UpgradeCategory, UiFrame> = {
        weapon: 'ui_header_blade_red',
        // Blue like the ship
        ship: 'ui_header_blade_blue',
    };
    private static readonly CATEGORY_ICONS: Record<UpgradeCategory, string> = {
        weapon: 'ui_icon_weapon',
        ship: 'ui_icon_ship',
    };

    private _players: readonly Player[];
    private _level: number;
    // Coop: every player picks in turn, on their own device
    private _pickIndex: number;
    private _player: Player;
    private _upgrades: UpgradeData[];
    private _cards: GameObjects.Container[];
    private _levelText: GameObjects.Text;
    private _crosshair: GameObjects.Image;
    private _hintText: GameObjects.Container;
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
    init(data: { players: readonly Player[], level: number }) {
        this._players = data.players;
        this._level = data.level;
        this._pickIndex = 0;
        this._cards = [];
    }

    private get isCoop(): boolean {
        return this._players.length > 1;
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
        this._levelText = this.add.text(centerX, 530, '',
            {fontSize: '36px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);
        this.tweens.add({targets: this._levelText, alpha: {from: 0, to: 1}, y: {from: this._levelText.y + 20, to: this._levelText.y},
            delay: 150, duration: 250, ease: 'Quad.easeOut'});

        this._crosshair = this.add.image(0, 0, "sprites", "ui_crosshair").setVisible(false);
        this._hintText = UiUtils.addButtonHint(this, centerX, UiLayout.HEIGHT - 200, []).setAlpha(0);

        this.game.events.on('input-type-changed', this.onInputTypeChanged, this);
        this.events.once('shutdown', () => {
            this.game.events.off('input-type-changed', this.onInputTypeChanged, this);
        });

        this.startPick();
    }

    // The cards of the player whose turn it is slide in
    private startPick() {
        this._player = this._players[this._pickIndex];
        this._cards.forEach(card => card.destroy());
        this._cards = [];
        this._selectedIndex = 0;
        this._previousMoveY = null;
        this._chosen = false;
        this._isReady = false;
        this._crosshair.setVisible(false);
        UiUtils.setButtonHint(this._hintText.setAlpha(0), this.getHintText());
        const picker: string = this.isBotPicking ? 'BOT' : `PLAYER ${this._pickIndex + 1}`;
        this._levelText.setText(this.isCoop ? `LEVEL ${this._level}, ${picker} PICKS` : `LEVEL ${this._level} REACHED`);

        // Maxed upgrades aren't offered anymore
        const allUpgrades = this.cache.json.get('upgrades') as UpgradeData[];
        const availableUpgrades = allUpgrades.filter(upgrade => this._player.isUpgradeAvailable(upgrade));
        this._upgrades = Phaser.Utils.Array.Shuffle(availableUpgrades).slice(0, LevelUpScene.CHOICE_COUNT);
        if (this._upgrades.length === 0) {
            this.nextPick();
            return;
        }

        const centerX: number = UiLayout.WIDTH / 2;
        this._upgrades.forEach((upgrade, index) => {
            const cardY: number = LevelUpScene.FIRST_CARD_Y + index * LevelUpScene.CARD_SPACING;
            this._cards.push(this.createCard(upgrade, index, centerX, cardY));
        });

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

        this.select(0);
    }

    private nextPick() {
        this._pickIndex++;
        if (this._pickIndex < this._players.length)
            this.startPick();
        else
            this.close();
    }

    private createCard(upgrade: UpgradeData, index: number, x: number, y: number): GameObjects.Container {
        const halfWidth: number = LevelUpScene.CARD_WIDTH / 2;
        const top: number = -LevelUpScene.CARD_HEIGHT / 2;
        const bodyCenterY: number = top + UiUtils.HEADER_HEIGHT + (LevelUpScene.CARD_HEIGHT - UiUtils.HEADER_HEIGHT) / 2;

        const panel = UiUtils.addPanel(this, 0, 0, LevelUpScene.CARD_WIDTH, LevelUpScene.CARD_HEIGHT,
            LevelUpScene.CATEGORY_FRAMES[upgrade.category])
            .setInteractive({useHandCursor: true})
            // The bot's cards aren't for the mouse
            .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
                if (!this.isBotPicking)
                    this.select(index);
            })
            .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
                if (!this.isBotPicking)
                    this.choose(index);
            });
        const categoryText = this.add.text(-halfWidth + 40, top + UiUtils.HEADER_HEIGHT / 2,
            upgrade.category.toUpperCase(), {fontSize: '32px', color: '#fff', fontFamily: 'future'})
            .setOrigin(0, 0.5);
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

        const pips = this.createRankPips(upgrade, halfWidth - LevelUpScene.PIPS_RIGHT_MARGIN, top + UiUtils.HEADER_HEIGHT / 2);
        return this.add.container(x, y, [panel, categoryText, icon, titleText, currentText, nextText, ...pips]);
    }

    // One pip per rank: gold when owned, the one this pick adds blinks
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
        this._crosshair.setVisible(true);
        this.tweens.add({targets: this._crosshair, scale: {from: 2, to: 1}, angle: {from: -90, to: 0}, duration: 250,
            ease: 'Back.easeOut'});
        this.tweens.add({targets: this._hintText, alpha: 1, duration: 250});

        if (this.isBotPicking) {
            const pickIndex: number = this._pickIndex;
            const cardIndex: number = Phaser.Math.Between(0, this._cards.length - 1);
            this.time.delayedCall(LevelUpScene.BOT_PICK_DELAY / 2, () => this.select(cardIndex));
            this.time.delayedCall(LevelUpScene.BOT_PICK_DELAY, () => {
                if (this._pickIndex === pickIndex)
                    this.choose(cardIndex);
            });
        }
    }

    private get isBotPicking(): boolean {
        return this._player.playerInput.device.type === 'bot';
    }

    private onInputTypeChanged() {
        UiUtils.setButtonHint(this._hintText, this.getHintText());
    }

    // Solo follows the last device used, coop the device of the player picking
    private getHintText(): HintPart[] {
        const device: InputDevice = this._player.playerInput.device;
        if (device.type === 'bot')
            return ['THE BOT PICKS'];
        const type: InputType = device.type === 'any' ? this.gameInputManager.activeInputType
            : device.type === 'gamepad' ? 'gamepad' : 'keyboard';
        switch (type) {
            case 'touch': return ['TAP A CARD TO PICK'];
            case 'gamepad': {
                // Coop: the icons of the picking player's own pad
                const padIndex: number | undefined = device.type === 'gamepad' ? device.index : undefined;
                const inputManager = this.gameInputManager;
                return [inputManager.gamepadHintPart('dpadVertical', padIndex), 'TO CHOOSE,',
                    inputManager.gamepadHintPart('confirm', padIndex), 'TO PICK'];
            }
        }
        const inputManager = this.gameInputManager;
        const key = (code: string): HintPart => inputManager.keyHintPart(code);
        if (device.type === 'keyboard' && device.keys === 'arrows')
            return [key('ArrowUp'), key('ArrowDown'), 'TO CHOOSE,', key('Enter'), 'TO PICK'];
        // Player 1 reads WASD and the arrows: the arrows are the hint, unless player 2 took them
        const areArrowsTaken: boolean = device.type === 'keyboard'
            || (device.type === 'any' && !!device.excluded?.some(owned => owned.type === 'keyboard' && owned.keys === 'arrows'));
        return areArrowsTaken ? [key('KeyW'), key('KeyS'), 'TO CHOOSE,', key('Space'), 'TO PICK']
            : [key('ArrowUp'), key('ArrowDown'), 'TO CHOOSE,', key('Space'), 'TO PICK'];
    }

    update() {
        if (this._chosen || !this._isReady)
            return;

        const input = this._player.playerInput;
        const moveDirectionY: number = input.moveDirection.y;
        const moveY: number = Math.abs(moveDirectionY) > LevelUpScene.STICK_THRESHOLD ? Math.sign(moveDirectionY) : 0;
        if (this._previousMoveY !== null && moveY !== 0 && moveY !== this._previousMoveY) {
            this.select(Phaser.Math.Wrap(this._selectedIndex + moveY, 0, this._cards.length));
        }
        this._previousMoveY = moveY;

        // Touch picks by tapping a card, any tap would otherwise confirm the highlighted one
        const isTouch: boolean = input.device.type === 'any' && this.gameInputManager.activeInputType === 'touch';
        if (!isTouch && input.confirmJustPressed()) {
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
            card.setScale(isSelected ? LevelUpScene.SELECTED_CARD_SCALE : LevelUpScene.CARD_SCALE)
                .setAlpha(isSelected ? 1 : LevelUpScene.CARD_ALPHA);
        });

        const selectedCard = this._cards[index];
        const crosshairOffset: number = LevelUpScene.CARD_WIDTH / 2 * LevelUpScene.SELECTED_CARD_SCALE - 70;
        this._crosshair.setPosition(selectedCard.x + crosshairOffset, selectedCard.y + UiUtils.HEADER_HEIGHT / 2);
    }

    private choose(index: number) {
        if (this._chosen || !this._isReady)
            return;
        this._chosen = true;

        Sfx.play(this, 'cardPick');
        this._player.applyUpgrade(this._upgrades[index]);
        this.nextPick();
    }

    private close() {
        this.scene.stop();
        this.scene.resume(GameConstants.SceneKeys.MAIN_GAME);
        this.game.events.emit(GameConstants.Events.LEVEL_UP_CLOSED_EVENT);
    }
}
