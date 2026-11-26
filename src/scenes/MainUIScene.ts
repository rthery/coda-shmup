import {GameObjects, Scenes, Scene} from "phaser";
import Health from "../components/Health.ts";
import Experience from "../components/Experience.ts";
import Player from "../entities/Player.ts";
import type Team from "../Team.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import UiUtils from "../utils/UiUtils.ts";
import UiLayout from "../utils/UiLayout.ts";
import DifficultyCurve from "../utils/DifficultyCurve.ts";
import type {DifficultyData} from "../gameData/DifficultyData.ts";
import Sfx from "../audio/Sfx.ts";

type LifeRow = {
    container: GameObjects.Container;
    icons: GameObjects.Image[];
    hullFrame: string;
}

export default class MainUIScene extends Scene {
    private static readonly MARGIN: number = 64;
    private static readonly LIFE_ICON_SCALE: number = 2;
    private static readonly LIFE_ICON_SPACING: number = 12;
    private static readonly LIFE_ROW_SPACING: number = 64;
    // Smaller and tighter than the hull icons, so 3 hull points and 3 shield cells stay clear of the run clock
    private static readonly SHIELD_ICON_SCALE: number = 1.3;
    private static readonly SHIELD_ICON_SPACING: number = 6;
    private static readonly LOST_LIFE_ALPHA: number = 0.25;
    private static readonly XP_BAR_Y: number = 216;
    private static readonly XP_BAR_X: number = 200;
    // Thinner than the pack's bar, which reads too heavy across a landscape screen
    private static readonly XP_BAR_SCALE_Y: number = 0.7;
    private static readonly BRACKET_INSET: number = 28;
    private static readonly BRACKET_LENGTH: number = 56;
    private static readonly THREAT_BANNER_Y: number = 560;
    private static readonly THREAT_LINE_HEIGHT: number = 4;
    private static readonly THREAT_COLOR: string = '#ffb02e';
    private static readonly MAX_THREAT_COLOR: number = 0xff4a3d;
    private static readonly MAX_THREAT_COLOR_STRING: string = '#ff4a3d';
    private static readonly DAMAGE_VIGNETTE_KEY: string = 'damageVignette';
    private static readonly COMBO_STEP_DETUNE: number = 200; // cents
    private static readonly THREAT_ALARM_GAP: number = 300; // ms
    private static readonly MAX_THREAT_ALARM_DETUNE: number = -400; // cents
    // Stars landing in a row climb in pitch, like coins, back to the base note after a pause
    private static readonly XP_PICKUP_STREAK_RESET: number = 600; // ms
    private static readonly XP_PICKUP_DETUNE_STEP: number = 30; // cents
    private static readonly XP_PICKUP_MAX_DETUNE: number = 400; // cents
    private static readonly DAMAGE_VIGNETTE_DURATION: number = 600;
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

    // One row of lives per player, stacked down from the top left
    private _lifeRows: LifeRow[];
    private _damageVignette: GameObjects.Image;
    private _scoreText: GameObjects.BitmapText;
    private _cornerBrackets: GameObjects.Graphics;
    private _runTimeText: GameObjects.Text;
    private _difficulty: DifficultyCurve;
    private _threatLevel: number = 0;
    private _threatBanner: GameObjects.Container;
    private _threatTitle: GameObjects.Text;
    private _threatLines: GameObjects.Rectangle[];
    private _isThreatBannerOnHold: boolean = false;
    private _comboText: GameObjects.Text;
    private _comboTextX: number;
    private _comboPips: GameObjects.Polygon[];
    private _filledComboPips: number;
    private _comboMaxText: GameObjects.Text;
    private _xpBarTrack: GameObjects.NineSlice;
    private _xpBarFill: GameObjects.NineSlice;
    private _xpBarGhost: GameObjects.NineSlice;
    private _xpBarGhostRatio: number = 0;
    private readonly _xpBarDisplay: { ratio: number } = {ratio: 0};
    private _displayedLevel: number;
    // While the level-up screen is open the bar stays full, the leftover XP shows once it closes
    private _heldXpRatio: number | null = null;
    private _xpStars: GameObjects.Group;
    private _xpPickupStreak: number = 0;
    private _lastXpPickupTime: number = -Infinity; // ms, real time
    // The star just spawned, waiting for the XP change its gem caused
    private _pendingXpStar: GameObjects.Image | null = null;
    private _xpBarWidth: number;
    private _levelText: GameObjects.Text;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_UI);
    }

    // noinspection JSUnusedGlobalSymbols
    init() {
        this.game.events.on(GameConstants.Events.TEAM_CREATED_EVENT, this.onTeamCreated, this);
        this.game.events.on(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
        this.game.events.on(GameConstants.Events.XP_GEM_COLLECTED_EVENT, this.onXpGemCollected, this);
        this.game.events.on(GameConstants.Events.LEVEL_UP_CLOSED_EVENT, this.onLevelUpClosed, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
        this.registry.events.on(RegistryConstants.Events.RUN_TIME_CHANGE, this.onRunTimeChanged, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_COMBO_CHANGE, this.onPlayerComboChanged, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_COMBO_PROGRESS_CHANGE, this.onComboProgressChanged, this);
        this.game.events.on(GameConstants.Events.COMBO_BROKEN_EVENT, this.onComboBroken, this);

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.TEAM_CREATED_EVENT, this.onTeamCreated, this);
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
        // Laid out on the portrait frame's height, across the screen's whole width: see layout()
        UiLayout.fitCamera(this, false);
        this._lifeRows = [];
        this.createDamageVignetteTexture();
        this._damageVignette = this.add.image(0, 0, MainUIScene.DAMAGE_VIGNETTE_KEY).setOrigin(0).setAlpha(0);

        let scoreStr: string = "".padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        if (this.registry.has(RegistryConstants.Keys.PLAYER_SCORE))
            scoreStr = this.registry.get(RegistryConstants.Keys.PLAYER_SCORE).toString()
                .padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText = this.add.bitmapText(0, MainUIScene.MARGIN, "future-bmp", scoreStr, 128).setOrigin(1, 0);

        // Bare HUD: corner brackets frame the play area instead of panels
        this._cornerBrackets = this.add.graphics();

        // The clock that drives the difficulty
        this._runTimeText = this.add.text(0, MainUIScene.MARGIN + 26, "",
            {fontSize: '44px', color: '#fff', fontFamily: 'future'}).setOrigin(0.5).setAlpha(0.8);
        this._difficulty = new DifficultyCurve(this.cache.json.get('difficulty') as DifficultyData);
        this._threatLevel = 0;
        this.createThreatBanner();
        this.onRunTimeChanged(null, 0);

        const xpBarY: number = MainUIScene.XP_BAR_Y;
        this._xpBarWidth = UiLayout.WIDTH - MainUIScene.MARGIN - MainUIScene.XP_BAR_X;
        this._xpBarTrack = UiUtils.addBar(this, MainUIScene.XP_BAR_X, xpBarY, this._xpBarWidth, "ui_bar_track")
            .setOrigin(0, 0);
        // Shows the gain at once, the gold fill catches up
        this._xpBarGhost = UiUtils.addBar(this, MainUIScene.XP_BAR_X, xpBarY, this._xpBarWidth, "ui_bar_fill_yellow")
            .setOrigin(0, 0).setTintFill(0xffffff).setAlpha(0.8);
        this.setXpBarGhostRatio(0);
        // Gold, like the XP stars
        this._xpBarFill = UiUtils.addBar(this, MainUIScene.XP_BAR_X, xpBarY, this._xpBarWidth, "ui_bar_fill_yellow")
            .setOrigin(0, 0);
        UiUtils.setBarFill(this._xpBarFill, this._xpBarWidth, 0);
        // Thinner around the same center line, so the level text and the flying stars still line up
        [this._xpBarTrack, this._xpBarGhost, this._xpBarFill].forEach(bar => bar.setScale(1, MainUIScene.XP_BAR_SCALE_Y)
            .setY(xpBarY + bar.height * (1 - MainUIScene.XP_BAR_SCALE_Y) / 2));
        this._levelText = this.add.text(MainUIScene.MARGIN, xpBarY + this._xpBarTrack.height / 2, "LV 1",
            {fontSize: '40px', color: '#fff', fontFamily: 'future'}).setOrigin(0, 0.5);

        this._xpStars = this.add.group();

        // One slanted pip per kill towards the next combo step, unlike the XP bar, with the combo on their left
        const comboRowY: number = xpBarY + 96;
        this._comboPips = [];
        this._filledComboPips = 0;
        this._comboText = this.add.text(0, comboRowY, "",
            {fontSize: '40px', color: MainUIScene.COMBO_COLOR, fontStyle: 'bold'}).setOrigin(1, 0.5);
        // Under the full row of pips once the combo can't go higher
        this._comboMaxText = this.add.text(0, comboRowY + 36, "MAX",
            {fontSize: '24px', color: MainUIScene.COMBO_COLOR, fontFamily: 'future'}).setOrigin(1, 0.5).setVisible(false);
        this.showCombo(1);

        const pipShape: number[] = [
            MainUIScene.COMBO_PIP_SKEW, 0,
            MainUIScene.COMBO_PIP_WIDTH, 0,
            MainUIScene.COMBO_PIP_WIDTH - MainUIScene.COMBO_PIP_SKEW, MainUIScene.COMBO_PIP_HEIGHT,
            0, MainUIScene.COMBO_PIP_HEIGHT
        ];
        for (let i = 0; i < GameConstants.COMBO_KILLS_PER_STEP; i++) {
            const pip = this.add.polygon(0, comboRowY, pipShape).setOrigin(0.5);
            this.setPipEmpty(pip);
            this._comboPips.push(pip);
        }

        this.scene.bringToTop();
        UiLayout.onResize(this, () => this.layout());

        console.log("MainUIScene created");
    }

    // Pinned to the screen's edges: the HUD stretches over a landscape screen's extra width
    private layout() {
        UiLayout.fitCamera(this, false);
        const area = UiLayout.visibleArea(this);
        const right: number = area.width - MainUIScene.MARGIN;

        this._damageVignette.setDisplaySize(area.width, area.height);
        this._scoreText.setX(right);
        this.drawCornerBrackets(area.width);
        this._runTimeText.setX(area.width / 2);
        this._threatBanner.setX(area.width / 2);
        this._threatLines.forEach(line => line.setSize(area.width - 2 * MainUIScene.MARGIN, MainUIScene.THREAT_LINE_HEIGHT));

        this._xpBarWidth = right - MainUIScene.XP_BAR_X;
        this._xpBarTrack.setSize(this._xpBarWidth, this._xpBarTrack.height);
        this.setXpBarGhostRatio(this._xpBarGhostRatio);
        UiUtils.setBarFill(this._xpBarFill, this._xpBarWidth, this._xpBarDisplay.ratio);

        const pipStep: number = MainUIScene.COMBO_PIP_WIDTH + MainUIScene.COMBO_PIP_GAP;
        const firstPipX: number = right - MainUIScene.COMBO_PIP_WIDTH / 2 - (GameConstants.COMBO_KILLS_PER_STEP - 1) * pipStep;
        this._comboPips.forEach((pip, index) => pip.setX(firstPipX + index * pipStep));
        this._comboTextX = firstPipX - MainUIScene.COMBO_PIP_WIDTH / 2 - 20;
        this._comboText.setX(this._comboTextX);
        this._comboMaxText.setX(right);
    }

    private onRunTimeChanged(_: any, seconds: number) {
        this._runTimeText.setText(UiUtils.formatTime(seconds));

        // The clock warms up with the threat, from white to red
        const threatColor = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(MainUIScene.MAX_THREAT_COLOR),
            100, Math.round(this._difficulty.progressAt(seconds) * 100));
        this._runTimeText.setColor(Phaser.Display.Color.RGBToString(threatColor.r, threatColor.g, threatColor.b));

        const threatLevel: number = this._difficulty.threatLevelAt(seconds);
        if (threatLevel > this._threatLevel)
            this.showThreatBanner(threatLevel);
        this._threatLevel = threatLevel;
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
            // Higher at each step
            Sfx.play(this, 'comboUp', {detune: (combo - 2) * MainUIScene.COMBO_STEP_DETUNE});
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
        Sfx.play(this, 'comboBreak');
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
        const row: LifeRow = {
            container: this.add.container(0, this._lifeRows.length * MainUIScene.LIFE_ROW_SPACING),
            icons: [],
            hullFrame: player.lifeIcon
        };
        this._lifeRows.push(row);
        const health = player.getComponent(Health);
        if (health) {
            this.updateLifeIcons(row, health.current, health.max, health.current);
            health.on(Health.CHANGE_EVENT, (current: number, previous: number) => {
                this.updateLifeIcons(row, current, health.max, previous);
            }, this);
        }
    }

    private onTeamCreated(team: Team) {
        // This scene outlives a game restart: the new players get new rows
        this._lifeRows.forEach(row => row.container.destroy());
        this._lifeRows = [];

        const experience = team.experience;
        // This scene outlives a game restart: reset the bar from the new team
        this.resetXpBar(experience.xp / experience.xpToNextLevel, experience.level);
        experience.on(Experience.CHANGE_EVENT, this.onPlayerXpChanged, this);
    }

    private createThreatBanner() {
        const warning = this.add.text(0, -56, "WARNING",
            {fontSize: '28px', color: MainUIScene.THREAT_COLOR, fontFamily: 'future', letterSpacing: 14}).setOrigin(0.5);
        this._threatTitle = this.add.text(0, 0, "",
            {fontSize: '64px', color: MainUIScene.THREAT_COLOR, fontFamily: 'future'}).setOrigin(0.5)
            .setShadow(0, 6, '#000', 0, false, true);
        this._threatLines = [-100, 52].map(y => this.add.rectangle(0, y, 1, MainUIScene.THREAT_LINE_HEIGHT,
            Phaser.Display.Color.HexStringToColor(MainUIScene.THREAT_COLOR).color));
        this._threatBanner = this.add.container(0, MainUIScene.THREAT_BANNER_Y,
            [...this._threatLines, warning, this._threatTitle]).setAlpha(0);
    }

    // Lines open from the center, the text blinks like an alarm, then it all fades out
    private showThreatBanner(level: number) {
        const isMax: boolean = level >= this._difficulty.maxThreatLevel;
        // A two-beat alarm, lower for the last level
        const alarmDetune: number = isMax ? MainUIScene.MAX_THREAT_ALARM_DETUNE : 0;
        Sfx.play(this, 'threatAlarm', {detune: alarmDetune});
        this.time.delayedCall(MainUIScene.THREAT_ALARM_GAP, () => Sfx.play(this, 'threatAlarm', {detune: alarmDetune}));
        this._threatTitle.setText(isMax ? "MAXIMUM THREAT" : "THREAT LEVEL " + (level + 1))
            .setColor(isMax ? MainUIScene.MAX_THREAT_COLOR_STRING : MainUIScene.THREAT_COLOR);

        this.tweens.killTweensOf([this._threatBanner, ...this._threatLines]);
        this._threatBanner.setAlpha(1);
        this.tweens.add({targets: this._threatLines, scaleX: {from: 0, to: 1}, duration: 300, ease: 'Quad.easeOut'});
        this.tweens.add({
            targets: this._threatBanner,
            alpha: {from: 1, to: 0.25},
            duration: 150,
            yoyo: true,
            repeat: 2,
            onComplete: () => this.tweens.add({
                targets: this._threatBanner,
                alpha: 0,
                delay: 1400,
                duration: 400
            })
        });
    }

    // This HUD draws over the level-up, pause and game over screens: the banner hides and waits behind them
    private holdThreatBannerBehindScreens() {
        const isOnHold: boolean = this.scene.isActive(GameConstants.SceneKeys.LEVEL_UP)
            || this.scene.isActive(GameConstants.SceneKeys.PAUSE)
            || this.scene.isActive(GameConstants.SceneKeys.GAME_OVER);
        if (isOnHold === this._isThreatBannerOnHold)
            return;
        this._isThreatBannerOnHold = isOnHold;

        this._threatBanner.setVisible(!isOnHold);
        this.tweens.getTweensOf([this._threatBanner, ...this._threatLines])
            .forEach(tween => isOnHold ? tween.pause() : tween.resume());
    }

    update() {
        this.holdThreatBannerBehindScreens();
    }

    // Red at the screen edges, clear in the middle, drawn once
    private createDamageVignetteTexture() {
        if (this.textures.exists(MainUIScene.DAMAGE_VIGNETTE_KEY))
            return;

        const width: number = this.scale.width;
        const height: number = this.scale.height;
        const texture = this.textures.createCanvas(MainUIScene.DAMAGE_VIGNETTE_KEY, width, height)!;
        const context: CanvasRenderingContext2D = texture.getContext();
        const gradient: CanvasGradient = context.createRadialGradient(width / 2, height / 2, width * 0.45,
            width / 2, height / 2, Math.hypot(width, height) / 2);
        gradient.addColorStop(0, 'rgba(255, 40, 40, 0)');
        gradient.addColorStop(1, 'rgba(255, 40, 40, 0.75)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        texture.refresh();
    }

    private drawCornerBrackets(width: number) {
        const inset: number = MainUIScene.BRACKET_INSET;
        const length: number = MainUIScene.BRACKET_LENGTH;
        const right: number = width - inset;
        this._cornerBrackets.clear()
            .lineStyle(6, 0xffffff, 0.4)
            .strokePoints([{x: inset, y: inset + length}, {x: inset, y: inset}, {x: inset + length, y: inset}])
            .strokePoints([{x: right - length, y: inset}, {x: right, y: inset}, {x: right, y: inset + length}]);
    }

    // One ship icon per hull point, then one shield badge per shield cell, lost ones dimmed
    private updateLifeIcons(row: LifeRow, current: number, max: number, previous: number) {
        const icons: GameObjects.Image[] = row.icons;
        const isFirstBuild: boolean = icons.length === 0;
        while (icons.length < max) {
            const isHull: boolean = icons.length < Player.HULL_POINTS;
            const scale: number = isHull ? MainUIScene.LIFE_ICON_SCALE : MainUIScene.SHIELD_ICON_SCALE;
            const icon = this.add.image(0, 0, "sprites", isHull ? row.hullFrame : "ui_shield_cell")
                .setScale(scale).setData('baseScale', scale);
            const previousIcon: GameObjects.Image | undefined = icons[icons.length - 1];
            const spacing: number = isHull || icons.length === Player.HULL_POINTS
                ? MainUIScene.LIFE_ICON_SPACING : MainUIScene.SHIELD_ICON_SPACING;
            const left: number = previousIcon
                ? previousIcon.x + previousIcon.displayWidth / 2 + spacing : MainUIScene.MARGIN;
            // Centered on the hull icons' row
            icon.setPosition(left + icon.displayWidth / 2, MainUIScene.MARGIN + 25 * MainUIScene.LIFE_ICON_SCALE / 2);
            row.container.add(icon);
            icons.push(icon);
        }

        icons.forEach((icon, index) => {
            icon.setAlpha(index < current ? 1 : MainUIScene.LOST_LIFE_ALPHA);
            if (isFirstBuild)
                return;
            if (index >= current && index < previous)
                this.playLifeLost(row, icon);
            else if (index < current && index >= previous)
                this.popIcon(icon);
        });

        this.updateLastLifeWarning(row, current);
    }

    private playLifeLost(row: LifeRow, icon: GameObjects.Image) {
        // A white copy breaks off and falls away
        const baseScale: number = icon.getData('baseScale');
        const shard = this.add.image(icon.x, icon.y, "sprites", icon.frame.name)
            .setScale(baseScale).setTintFill(0xffffff);
        row.container.add(shard);
        this.tweens.add({
            targets: shard,
            y: shard.y + 80,
            angle: 35,
            alpha: 0,
            scale: baseScale * 1.4,
            duration: 500,
            ease: 'Quad.easeIn',
            onComplete: () => shard.destroy()
        });

        this.popIcon(icon);
        this.tweens.add({targets: row.container, x: {from: 16, to: 0}, duration: 450, ease: 'Elastic.easeOut'});
        // A hull alarm: the screen edges glow red, twice
        this.tweens.killTweensOf(this._damageVignette);
        this.tweens.add({
            targets: this._damageVignette,
            alpha: {from: 1, to: 0.2},
            duration: MainUIScene.DAMAGE_VIGNETTE_DURATION / 4,
            yoyo: true,
            onComplete: () => this.tweens.add({
                targets: this._damageVignette,
                alpha: 0,
                duration: MainUIScene.DAMAGE_VIGNETTE_DURATION / 2,
                ease: 'Quad.easeIn'
            })
        });
    }

    private popIcon(icon: GameObjects.Image) {
        this.tweens.add({
            targets: icon,
            scale: {from: icon.getData('baseScale') * 1.4, to: icon.getData('baseScale')},
            duration: 300,
            ease: 'Back.easeOut'
        });
    }

    // The last life beats red
    private updateLastLifeWarning(row: LifeRow, current: number) {
        const lastLife: GameObjects.Image = row.icons[0];
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
        this.setXpBarGhostRatio(ratio);
    }

    // The collected star flies from the ship to the bar's end, the bar fills when it lands
    private onXpGemCollected(screenX: number, screenY: number) {
        const start = this.cameras.main.getWorldPoint(screenX, screenY);
        const star: GameObjects.Image = this._xpStars.get(start.x, start.y, "sprites", "star_gold");
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

    private playXpPickup() {
        const now: number = performance.now();
        this._xpPickupStreak = now - this._lastXpPickupTime < MainUIScene.XP_PICKUP_STREAK_RESET
            ? this._xpPickupStreak + 1 : 0;
        this._lastXpPickupTime = now;
        Sfx.play(this, 'xpPickup',
            {detune: Math.min(this._xpPickupStreak * MainUIScene.XP_PICKUP_DETUNE_STEP, MainUIScene.XP_PICKUP_MAX_DETUNE)});
    }

    private landXpStar(star: GameObjects.Image) {
        this.playXpPickup();
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
        this.setXpBarGhostRatio(ratio);
        this.tweenXpBarTo(ratio, MainUIScene.XP_FILL_DELAY);
    }

    // The bar tops up and flashes behind the level-up screen, and stays full until it closes
    private playLevelUp(ratio: number, level: number) {
        this.tweens.killTweensOf(this._xpBarDisplay);
        this._displayedLevel = level;
        this._heldXpRatio = ratio;
        this.setXpBarGhostRatio(1);
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
        this.setXpBarGhostRatio(ratio);
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

    // Shows the gain at once, the gold fill catches up
    private setXpBarGhostRatio(ratio: number) {
        this._xpBarGhostRatio = ratio;
        UiUtils.setBarFill(this._xpBarGhost, this._xpBarWidth, ratio);
    }

    private setXpBarRatio(ratio: number) {
        this._xpBarDisplay.ratio = ratio;
        UiUtils.setBarFill(this._xpBarFill, this._xpBarWidth, ratio);
    }
}
