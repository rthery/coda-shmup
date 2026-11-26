import {Input, Plugins, Scene} from "phaser";
import Player from "../entities/Player.ts";
import type Team from "../Team.ts";
import type {UpgradeData} from "../gameData/UpgradesData.ts";

export type CheatTargets = {
    team: Team;
    jumpThreatLevel: (step: number) => void;
}

// Dev builds only: keyboard shortcuts acting on the run
export default class CheatManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'CheatManager';
    public static readonly MAPPING_NAME: string = 'cheatManager';

    // Safety net for M, in case an upgrade never stops being available
    private static readonly MAX_PICKS: number = 20;

    private _targets: CheatTargets | null = null;

    constructor(scene: Scene, pluginManager: Plugins.PluginManager) {
        super(scene, pluginManager, CheatManager.PLUGIN_KEY);
    }

    public init(targets: CheatTargets) {
        const keyboard = this.scene?.input.keyboard;
        if (!import.meta.env.DEV || !keyboard)
            return;

        this._targets = targets;
        keyboard.on(Input.Keyboard.Events.ANY_KEY_DOWN, this.onKeyDown, this);
        this.scene!.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard.off(Input.Keyboard.Events.ANY_KEY_DOWN, this.onKeyDown, this);
            this._targets = null;
        });
    }

    // Digits by physical key, so AZERTY needs no Shift. Letters and +/- by character: they move between layouts
    private onKeyDown(event: KeyboardEvent) {
        if (!this._targets || event.repeat)
            return;

        const digit: RegExpMatchArray | null = event.code.match(/^Digit([1-9])$/);
        const key: string = event.key.toLowerCase();
        if (digit)
            this.upgrade(this.upgrades[Number(digit[1]) - 1]);
        else if (key === 'm')
            this.maxUpgrades();
        else if (key === 'l')
            this.levelUp();
        else if (key === 'f')
            this.toggleFiring();
        else if (key === '+' || key === '=')
            this._targets.jumpThreatLevel(1);
        else if (key === '-')
            this._targets.jumpThreatLevel(-1);
    }

    // Upgrade cheats act on player 1
    private get player(): Player {
        return this._targets!.team.players[0];
    }

    private get upgrades(): UpgradeData[] {
        return this.scene!.cache.json.get('upgrades') as UpgradeData[];
    }

    // 1 to 9: a rank to the upgrade at that place in upgrades.json
    private upgrade(upgrade: UpgradeData | undefined) {
        const player = this.player;
        if (!upgrade)
            return;
        if (!player.isUpgradeAvailable(upgrade)) {
            console.log("[Cheat] " + upgrade.title + " not available");
            return;
        }
        player.applyUpgrade(upgrade);
        console.log("[Cheat] " + upgrade.title + " rank " + player.getUpgradeRank(upgrade.id));
    }

    private maxUpgrades() {
        const player = this.player;
        this.upgrades.forEach(upgrade => {
            for (let i = 0; i < CheatManager.MAX_PICKS && player.isUpgradeAvailable(upgrade); i++)
                player.applyUpgrade(upgrade);
        });
    }

    // The XP missing to reach the next level
    private levelUp() {
        const experience = this._targets!.team.experience;
        experience.add(experience.xpToNextLevel - experience.xp);
        console.log("[Cheat] Level " + experience.level);
    }

    // Kept across restarts
    private toggleFiring() {
        Player.isFiringDisabled = !Player.isFiringDisabled;
        console.log("[Cheat] Player firing " + (Player.isFiringDisabled ? "off" : "on"));
    }
}
