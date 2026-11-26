import {GameObjects, Scenes, Scene} from "phaser";
import Health from "../components/Health.ts";
import Experience from "../components/Experience.ts";
import Player from "../entities/Player.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import UiUtils from "../utils/UiUtils.ts";

export default class MainUIScene extends Scene {
    private static readonly MARGIN: number = 64;
    private static readonly LIFE_ICON_SCALE: number = 2;
    private static readonly LIFE_ICON_SPACING: number = 12;
    private static readonly LOST_LIFE_ALPHA: number = 0.25;
    private static readonly XP_BAR_Y: number = 216;
    private static readonly XP_BAR_X: number = 200;
    private static readonly BRACKET_INSET: number = 28;
    private static readonly BRACKET_LENGTH: number = 56;
    private static readonly DAMAGE_FLASH_COLOR: number = 0xff3030;
    private static readonly DAMAGE_FLASH_ALPHA: number = 0.25;
    private static readonly LAST_LIFE_TINT: number = 0xff6060;
    private static readonly XP_FILL_DELAY: number = 120;
    private static readonly XP_FILL_DURATION: number = 300;
    private static readonly XP_STAR_FLIGHT_DURATION: number = 450;
    private static readonly LEVEL_UP_FILL_DURATION: number = 200;
    private static readonly COMBO_PIP_WIDTH: number = 22;
    private static readonly COMBO_PIP_HEIGHT: number = 18;
    private static readonly COMBO_PIP_SKEW: number = 6;
    private static readonly COMBO_PIP_GAP: number = 6;
    private static readonly COMBO_PIP_COLOR: number = 0xffcc00;
    private static readonly COMBO_PIP_EMPTY_ALPHA: number = 0.15;
    private static readonly COMBO_IDLE_ALPHA: number = 0.5;
    private static readonly COMBO_COLOR: string = '#ffcc00';
    private static readonly COMBO_BROKEN_COLOR: string = '#ff4040';
    private static readonly COMBO_BROKEN_FILL: number = 0xff4040;

    private _lifeIcons: GameObjects.Image[];
    private _lifeRow: GameObjects.Container;
    private _damageFlash: GameObjects.Rectangle;
    private _scoreText: GameObjects.BitmapText;
    private _runTimeText: GameObjects.Text;
    private _comboText: GameObjects.Text;
    private _comboTextX: number;
    private _comboPips: GameObjects.Polygon[];
    private _filledComboPips: number;
    private _comboMaxText: GameObjects.Text;
    private _xpBarFill: GameObjects.NineSlice;
    private _xpBarGhost: GameObjects.NineSlice;
    private readonly _xpBarDisplay: { ratio: number } = {ratio: 0};
    private _displayedLevel: number;
    // While the level-up screen is open the bar stays full, the leftover XP shows once it closes
    private _heldXpRatio: number | null = null;
    private _xpStars: GameObjects.Group;
    // The star just spawned, waiting for the XP change its gem caused
    private _pendingXpStar: GameObjects.Image | null = null;
    private _xpBarWidth: number;
    private _levelText: GameObjects.Text;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_UI);
    }

    // noinspection JSUnusedGlobalSymbols
    init() {
        this.game.events.on(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
        this.game.events.on(GameConstants.Events.XP_GEM_COLLECTED_EVENT, this.onXpGemCollected, this);
        this.game.events.on(GameConstants.Events.LEVEL_UP_CLOSED_EVENT, this.onLevelUpClosed, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
        this.registry.events.on(RegistryConstants.Events.RUN_TIME_CHANGE, this.onRunTimeChanged, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_COMBO_CHANGE, this.onPlayerComboChanged, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_COMBO_PROGRESS_CHANGE, this.onComboProgressChanged, this);
        this.game.events.on(GameConstants.Events.COMBO_BROKEN_EVENT, this.onComboBroken, this);

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
            this.game.events.off(GameConstants.Events.XP_GEM_COLLECTED_EVENT, this.onXpGemCollected, this);
            this.game.events.off(GameConstants.Events.LEVEL_UP_CLOSED_EVENT, this.onLevelUpClosed, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
            this.registry.events.off(RegistryConstants.Events.RUN_TIME_CHANGE, this.onRunTimeChanged, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_COMBO_CHANGE, this.onPlayerComboChanged, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_COMBO_PROGRESS_CHANGE, this.onComboProgressChanged, this);
            this.game.events.off(GameConstants.Events.COMBO_BROKEN_EVENT, this.onComboBroken, this);
        }, this);
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this._lifeIcons = [];
        this._damageFlash = this.add.rectangle(0, 0, this.scale.width, this.scale.height,
            MainUIScene.DAMAGE_FLASH_COLOR).setOrigin(0).setAlpha(0);
        this._lifeRow = this.add.container(0, 0);

        let scoreStr: string = "".padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        if (this.registry.has(RegistryConstants.Keys.PLAYER_SCORE))
            scoreStr = this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString()
                .padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText = this.add.bitmapText(this.scale.width - MainUIScene.MARGIN, MainUIScene.MARGIN,
            "future-bmp", scoreStr, 128).setOrigin(1, 0);

        this.addCornerBrackets();

        // The clock that drives the difficulty
        this._runTimeText = this.add.text(this.scale.width / 2, MainUIScene.MARGIN + 26, "",
            {fontSize: '44px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5).setAlpha(0.8);
        this.onRunTimeChanged(null, 0);

        const xpBarY: number = MainUIScene.XP_BAR_Y;
        this._xpBarWidth = this.scale.width - MainUIScene.MARGIN - MainUIScene.XP_BAR_X;
        const xpBarTrack = UiUtils.addBar(this, MainUIScene.XP_BAR_X, xpBarY, this._xpBarWidth, "ui_bar_track")
            .setOrigin(0, 0);
        // Shows the gain at once, the gold fill catches up
        this._xpBarGhost = UiUtils.addBar(this, MainUIScene.XP_BAR_X, xpBarY, this._xpBarWidth, "ui_bar_fill_yellow")
            .setOrigin(0, 0).setTintFill(0xffffff).setAlpha(0.8);
        UiUtils.setBarFill(this._xpBarGhost, this._xpBarWidth, 0);
        // Gold, like the XP stars
        this._xpBarFill = UiUtils.addBar(this, MainUIScene.XP_BAR_X, xpBarY, this._xpBarWidth, "ui_bar_fill_yellow")
            .setOrigin(0, 0);
        UiUtils.setBarFill(this._xpBarFill, this._xpBarWidth, 0);
        this._levelText = this.add.text(MainUIScene.MARGIN, xpBarY + xpBarTrack.height / 2, "LV 1",
            {fontSize: '40px', color: '#fff', fontFamily: 'future'}).setOrigin(0, 0.5);

        this._xpStars = this.add.group();

        // One slanted pip per kill towards the next combo step, unlike the XP bar, with the combo on their left
        const comboRowY: number = xpBarY + 96;
        this._comboPips = [];
        this._filledComboPips = 0;
        const pipStep: number = MainUIScene.COMBO_PIP_WIDTH + MainUIScene.COMBO_PIP_GAP;
        const firstPipX: number = this.scale.width - MainUIScene.MARGIN - MainUIScene.COMBO_PIP_WIDTH / 2
            - (GameConstants.COMBO_KILLS_PER_STEP - 1) * pipStep;

        this._comboTextX = firstPipX - MainUIScene.COMBO_PIP_WIDTH / 2 - 20;
        this._comboText = this.add.text(this._comboTextX, comboRowY, "",
            {fontSize: '40px', color: MainUIScene.COMBO_COLOR, fontStyle: 'bold'}).setOrigin(1, 0.5);
        // Under the full row of pips once the combo can't go higher
        this._comboMaxText = this.add.text(this.scale.width - MainUIScene.MARGIN, comboRowY + 36, "MAX",
            {fontSize: '24px', color: MainUIScene.COMBO_COLOR, fontFamily: 'future'}).setOrigin(1, 0.5).setVisible(false);
        this.showCombo(1);

        const pipShape: number[] = [
            MainUIScene.COMBO_PIP_SKEW, 0,
            MainUIScene.COMBO_PIP_WIDTH, 0,
            MainUIScene.COMBO_PIP_WIDTH - MainUIScene.COMBO_PIP_SKEW, MainUIScene.COMBO_PIP_HEIGHT,
            0, MainUIScene.COMBO_PIP_HEIGHT
        ];
        for (let i = 0; i < GameConstants.COMBO_KILLS_PER_STEP; i++) {
            const pip = this.add.polygon(firstPipX + i * pipStep, comboRowY, pipShape).setOrigin(0.5);
            this.setPipEmpty(pip);
            this._comboPips.push(pip);
        }

        this.scene.bringToTop();

        console.log("MainUIScene created");
    }

    private onRunTimeChanged(_: any, seconds: number) {
        this._runTimeText.setText(UiUtils.formatTime(seconds));
    }

    private onPlayerScoreChanged(_: any, value: number) {
        const scoreStr: string = value.toString().padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText.setText(scoreStr);
    }

    private onPlayerComboChanged(_: any, combo: number, previousCombo: number) {
        if (combo === previousCombo)
            return;

        this.showCombo(combo);

        if (combo > previousCombo) {
            this.tweens.add({targets: this._comboText, scale: {from: 1.4, to: 1}, duration: 200, ease: 'Back.easeOut'});
        }
    }

    // Dim at X1, it only multiplies the score from X2
    private showCombo(combo: number) {
        this._comboText.setText("COMBO X" + combo).setAlpha(combo > 1 ? 1 : MainUIScene.COMBO_IDLE_ALPHA);

        const isMax: boolean = combo === GameConstants.MAX_COMBO;
        if (isMax === this._comboMaxText.visible)
            return;
        this.tweens.killTweensOf(this._comboMaxText);
        this._comboMaxText.setVisible(isMax).setScale(1).setAlpha(1);
        if (!isMax)
            return;
        this.tweens.add({targets: this._comboMaxText, scale: {from: 1.8, to: 1}, duration: 300, ease: 'Back.easeOut'});
        this.tweens.add({
            targets: this._comboMaxText,
            alpha: 0.4,
            delay: 300,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    private onComboProgressChanged(_: any, progress: number) {
        const filled: number = Math.round(progress * GameConstants.COMBO_KILLS_PER_STEP);
        if (filled > this._filledComboPips) {
            for (let i = this._filledComboPips; i < filled; i++) {
                const pip = this._comboPips[i];
                pip.setFillStyle(MainUIScene.COMBO_PIP_COLOR, 1);
                this.tweens.add({targets: pip, scale: {from: 1.6, to: 1}, duration: 250, ease: 'Back.easeOut'});
            }
        } else if (filled < this._filledComboPips) {
            // Next combo step: the full row flashes white and empties
            this._comboPips.forEach((pip, index) => {
                pip.setFillStyle(0xffffff, 1);
                this.time.delayedCall(150, () => this.emptyPipIfUnfilled(pip, index));
            });
        }
        this._filledComboPips = filled;
    }

    // A kill may have refilled the pip while it was animating
    private emptyPipIfUnfilled(pip: GameObjects.Polygon, index: number) {
        if (index >= this._filledComboPips)
            this.setPipEmpty(pip);
    }

    private setPipEmpty(pip: GameObjects.Polygon) {
        pip.setFillStyle(0xffffff, MainUIScene.COMBO_PIP_EMPTY_ALPHA);
    }

    // Sent before the reset, so the text still shows the lost combo
    private onComboBroken() {
        const shard = this.add.text(this._comboText.x, this._comboText.y, this._comboText.text,
            {fontSize: '40px', color: MainUIScene.COMBO_BROKEN_COLOR, fontStyle: 'bold'}).setOrigin(1, 0.5);
        this.tweens.add({
            targets: shard,
            y: shard.y + 70,
            angle: -12,
            alpha: 0,
            duration: 550,
            ease: 'Quad.easeIn',
            onComplete: () => shard.destroy()
        });

        this.tweens.add({
            targets: this._comboText,
            x: {from: this._comboTextX + 18, to: this._comboTextX},
            duration: 450,
            ease: 'Elastic.easeOut'
        });

        // The filled pips turn red and drop out from the right
        for (let i = this._filledComboPips - 1; i >= 0; i--) {
            const pip = this._comboPips[i];
            pip.setFillStyle(MainUIScene.COMBO_BROKEN_FILL, 1);
            this.tweens.add({
                targets: pip,
                scale: {from: 1.4, to: 1},
                delay: (this._filledComboPips - 1 - i) * 30,
                duration: 200,
                onComplete: () => this.emptyPipIfUnfilled(pip, i)
            });
        }
        this._filledComboPips = 0;
    }

    private onPlayerSpawned(player: Player) {
        const health = player.getComponent(Health);
        if (health) {
            this.updateLifeIcons(health.current, health.max, health.current);
            health.on(Health.CHANGE_EVENT, (current: number, previous: number) => {
                this.updateLifeIcons(current, health.max, previous);
            }, this);
        }

        const experience = player.getComponent(Experience);
        if (experience) {
            // This scene outlives a game restart: reset the bar from the new player
            this.resetXpBar(experience.xp / experience.xpToNextLevel, experience.level);
            experience.on(Experience.CHANGE_EVENT, this.onPlayerXpChanged, this);
        }
    }

    // Bare HUD: corner brackets frame the play area instead of panels
    private addCornerBrackets() {
        const inset: number = MainUIScene.BRACKET_INSET;
        const length: number = MainUIScene.BRACKET_LENGTH;
        const right: number = this.scale.width - inset;
        this.add.graphics()
            .lineStyle(6, 0xffffff, 0.4)
            .strokePoints([{x: inset, y: inset + length}, {x: inset, y: inset}, {x: inset + length, y: inset}])
            .strokePoints([{x: right - length, y: inset}, {x: right, y: inset}, {x: right, y: inset + length}]);
    }

    // One icon per max life, lost lives dimmed
    private updateLifeIcons(current: number, max: number, previous: number) {
        const isFirstBuild: boolean = this._lifeIcons.length === 0;
        while (this._lifeIcons.length < max) {
            const icon = this.add.image(0, 0, "sprites", "playerLife3_blue").setScale(MainUIScene.LIFE_ICON_SCALE);
            icon.setPosition(
                MainUIScene.MARGIN + icon.displayWidth / 2 +
                this._lifeIcons.length * (icon.displayWidth + MainUIScene.LIFE_ICON_SPACING),
                MainUIScene.MARGIN + icon.displayHeight / 2);
            this._lifeRow.add(icon);
            this._lifeIcons.push(icon);
        }

        this._lifeIcons.forEach((icon, index) => {
            icon.setAlpha(index < current ? 1 : MainUIScene.LOST_LIFE_ALPHA);
            if (isFirstBuild)
                return;
            if (index >= current && index < previous)
                this.playLifeLost(icon);
            else if (index < current && index >= previous)
                this.popIcon(icon);
        });

        this.updateLastLifeWarning(current);
    }

    private playLifeLost(icon: GameObjects.Image) {
        // A white copy breaks off and falls away
        const shard = this.add.image(icon.x, icon.y, "sprites", "playerLife3_blue")
            .setScale(MainUIScene.LIFE_ICON_SCALE).setTintFill(0xffffff);
        this._lifeRow.add(shard);
        this.tweens.add({
            targets: shard,
            y: shard.y + 80,
            angle: 35,
            alpha: 0,
            scale: MainUIScene.LIFE_ICON_SCALE * 1.4,
            duration: 500,
            ease: 'Quad.easeIn',
            onComplete: () => shard.destroy()
        });

        this.popIcon(icon);
        this.tweens.add({targets: this._lifeRow, x: {from: 16, to: 0}, duration: 450, ease: 'Elastic.easeOut'});
        this.tweens.add({targets: this._damageFlash, alpha: {from: MainUIScene.DAMAGE_FLASH_ALPHA, to: 0}, duration: 350});
    }

    private popIcon(icon: GameObjects.Image) {
        this.tweens.add({
            targets: icon,
            scale: {from: MainUIScene.LIFE_ICON_SCALE * 1.4, to: MainUIScene.LIFE_ICON_SCALE},
            duration: 300,
            ease: 'Back.easeOut'
        });
    }

    // The last life beats red
    private updateLastLifeWarning(current: number) {
        const lastLife: GameObjects.Image = this._lifeIcons[0];
        this.tweens.killTweensOf(lastLife);
        lastLife.setScale(MainUIScene.LIFE_ICON_SCALE);
        if (current !== 1) {
            lastLife.clearTint();
            return;
        }

        lastLife.setTint(MainUIScene.LAST_LIFE_TINT);
        this.tweens.add({
            targets: lastLife,
            scale: MainUIScene.LIFE_ICON_SCALE * 1.15,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    private resetXpBar(ratio: number, level: number) {
        this.tweens.killTweensOf(this._xpBarDisplay);
        this._xpStars.getMatching('active', true).forEach((star: GameObjects.Image) => this.releaseXpStar(star));
        this._pendingXpStar = null;
        this._heldXpRatio = null;
        this._displayedLevel = level;
        this._levelText.setText("LV " + level);
        this.setXpBarRatio(ratio);
        UiUtils.setBarFill(this._xpBarGhost, this._xpBarWidth, ratio);
    }

    // The collected star flies from the ship to the bar's end, the bar fills when it lands
    private onXpGemCollected(screenX: number, screenY: number) {
        const star: GameObjects.Image = this._xpStars.get(screenX, screenY, "sprites", "star_gold");
        star.setActive(true).setVisible(true).setAlpha(1).setScale(1.4).setAngle(0);
        this._pendingXpStar = star;

        const barHeadX: number = MainUIScene.XP_BAR_X + this._xpBarWidth * this._xpBarDisplay.ratio;
        const barCenterY: number = MainUIScene.XP_BAR_Y + this._xpBarFill.height / 2;
        this.tweens.add({
            targets: star,
            // Different eases on each axis curve the path
            x: {value: barHeadX, ease: 'Sine.easeIn'},
            y: {value: barCenterY, ease: 'Quad.easeOut'},
            scale: 0.9,
            angle: 360,
            duration: MainUIScene.XP_STAR_FLIGHT_DURATION,
            onComplete: () => this.landXpStar(star)
        });
    }

    private landXpStar(star: GameObjects.Image) {
        this.applyXp(star.getData('ratio'), star.getData('level'));
        this.tweens.add({
            targets: star,
            scale: 2.2,
            alpha: 0,
            duration: 150,
            onComplete: () => this.releaseXpStar(star)
        });
    }

    private releaseXpStar(star: GameObjects.Image) {
        this.tweens.killTweensOf(star);
        this._xpStars.killAndHide(star);
    }

    private onPlayerXpChanged(xp: number, xpToNextLevel: number, level: number) {
        const ratio: number = xp / xpToNextLevel;
        // The level-up screen opens right away: the bar can't wait for the star
        if (level > this._displayedLevel)
            this.playLevelUp(ratio, level);

        if (this._pendingXpStar) {
            this._pendingXpStar.setData('ratio', ratio).setData('level', level);
            this._pendingXpStar = null;
            return;
        }

        this.applyXp(ratio, level);
    }

    private applyXp(ratio: number, level: number) {
        // Stars collected before the level up are already counted in the full bar
        if (level < this._displayedLevel)
            return;

        if (this._heldXpRatio !== null) {
            this._heldXpRatio = ratio;
            return;
        }

        this.tweens.killTweensOf(this._xpBarDisplay);
        UiUtils.setBarFill(this._xpBarGhost, this._xpBarWidth, ratio);
        this.tweenXpBarTo(ratio, MainUIScene.XP_FILL_DELAY);
    }

    // The bar tops up and flashes behind the level-up screen, and stays full until it closes
    private playLevelUp(ratio: number, level: number) {
        this.tweens.killTweensOf(this._xpBarDisplay);
        this._displayedLevel = level;
        this._heldXpRatio = ratio;
        UiUtils.setBarFill(this._xpBarGhost, this._xpBarWidth, 1);
        this.tweenXpBarTo(1, 0, () => {
            this._xpBarFill.setTintFill(0xffffff);
            this.time.delayedCall(120, () => this._xpBarFill.clearTint());
        }, MainUIScene.LEVEL_UP_FILL_DURATION);

        this._levelText.setText("LV " + level).setColor(UiUtils.YELLOW_COLOR);
        this.tweens.add({
            targets: this._levelText,
            scale: {from: 1.8, to: 1},
            duration: 450,
            ease: 'Back.easeOut',
            onComplete: () => this._levelText.setColor('#fff')
        });
    }

    // The bar refills from empty with the XP left over after the level up
    private onLevelUpClosed() {
        if (this._heldXpRatio === null)
            return;

        const ratio: number = this._heldXpRatio;
        this._heldXpRatio = null;
        this.setXpBarRatio(0);
        UiUtils.setBarFill(this._xpBarGhost, this._xpBarWidth, ratio);
        this.tweenXpBarTo(ratio, MainUIScene.XP_FILL_DELAY);
    }

    private tweenXpBarTo(ratio: number, delay: number, onComplete?: () => void,
                         duration: number = MainUIScene.XP_FILL_DURATION) {
        this.tweens.add({
            targets: this._xpBarDisplay,
            ratio: ratio,
            delay: delay,
            duration: duration,
            ease: 'Quad.easeOut',
            onUpdate: () => UiUtils.setBarFill(this._xpBarFill, this._xpBarWidth, this._xpBarDisplay.ratio),
            onComplete: onComplete
        });
    }

    private setXpBarRatio(ratio: number) {
        this._xpBarDisplay.ratio = ratio;
        UiUtils.setBarFill(this._xpBarFill, this._xpBarWidth, ratio);
    }
}
