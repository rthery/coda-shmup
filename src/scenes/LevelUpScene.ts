import {GameObjects, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import Player from "../entities/Player.ts";
import type {UpgradeData} from "../gameData/UpgradesData.ts";

export default class LevelUpScene extends Scene {
    private static readonly CHOICE_COUNT: number = 3;
    private static readonly STICK_THRESHOLD: number = 0.5;
    private static readonly CARD_COLOR: number = 0x222244;
    private static readonly SELECTED_CARD_COLOR: number = 0x335599;

    private _player: Player;
    private _upgrades: UpgradeData[];
    private _cards: GameObjects.Rectangle[];
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
        this.add.text(centerX, 520, 'LEVEL UP!',
            {fontSize: '80px', color: '#ffcc00', fontFamily: 'future'}).setOrigin(0.5);

        const allUpgrades = this.cache.json.get('upgrades') as UpgradeData[];
        this._upgrades = Phaser.Utils.Array.Shuffle([...allUpgrades]).slice(0, LevelUpScene.CHOICE_COUNT);

        this._upgrades.forEach((upgrade, index) => {
            const cardY: number = 760 + index * 260;
            const card = this.add.rectangle(centerX, cardY, 840, 220, LevelUpScene.CARD_COLOR)
                .setStrokeStyle(6, 0xffffff, 0.4)
                .setInteractive({useHandCursor: true})
                .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.select(index))
                .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.choose(index));
            this._cards.push(card);

            this.add.text(centerX, cardY - 36, upgrade.title,
                {fontSize: '52px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5);
            this.add.text(centerX, cardY + 44, upgrade.description,
                {fontSize: '34px', color: '#ccc'}).setOrigin(0.5);
        });

        this.select(0);
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
            card.setFillStyle(isSelected ? LevelUpScene.SELECTED_CARD_COLOR : LevelUpScene.CARD_COLOR)
                .setStrokeStyle(6, 0xffffff, isSelected ? 1 : 0.4);
        });
    }

    private choose(index: number) {
        if (this._chosen)
            return;
        this._chosen = true;

        this._player.applyUpgrade(this._upgrades[index]);

        this.scene.stop();
        this.scene.resume(GameConstants.SceneKeys.MAIN_GAME);
    }
}
