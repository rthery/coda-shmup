import type {CoopScalingData, DifficultyData, DifficultyKeyframeData, XpCurveData} from "../gameData/DifficultyData.ts";

export default class DifficultyCurve {
    private readonly _keyframes: DifficultyKeyframeData[];
    private readonly _xp: XpCurveData;
    private readonly _coop: CoopScalingData;
    private readonly _extraPlayers: number;
    private readonly _current: DifficultyKeyframeData = {
        time: 0, spawnInterval: 0, maxEnemies: 0, enemyHealth: 0, enemySpeed: 0
    };

    public constructor(data: DifficultyData, playerCount: number = 1) {
        this._keyframes = data.keyframes;
        this._xp = data.xp;
        this._coop = data.coop;
        this._extraPlayers = playerCount - 1;
    }

    // XP to reach each level, more with each player
    public get xpCurve(): XpCurveData {
        const scale: number = 1 + this._coop.xpPerPlayer * this._extraPlayers;
        return {base: this._xp.base * scale, perLevel: this._xp.perLevel * scale,
            perLevelSquared: this._xp.perLevelSquared * scale};
    }

    // 0 at the start, +1 at each keyframe reached after the first
    public threatLevelAt(time: number): number {
        let level: number = 0;
        for (let i = 1; i < this._keyframes.length; i++) {
            if (this._keyframes[i].time <= time)
                level = i;
        }
        return level;
    }

    // s, when the given threat level starts
    public threatLevelTime(level: number): number {
        return this._keyframes[Phaser.Math.Clamp(level, 0, this._keyframes.length - 1)].time;
    }

    public get maxThreatLevel(): number {
        return this._keyframes.length - 1;
    }

    // 0 to 1, from the start to the last keyframe
    public progressAt(time: number): number {
        const lastTime: number = this._keyframes[this._keyframes.length - 1].time;
        return lastTime > 0 ? Phaser.Math.Clamp(time / lastTime, 0, 1) : 1;
    }

    // Reuses the same object on every call: read it, don't keep it
    public at(time: number): Readonly<DifficultyKeyframeData> {
        const keyframes: DifficultyKeyframeData[] = this._keyframes;
        let nextIndex: number = keyframes.findIndex(keyframe => keyframe.time > time);
        if (nextIndex === -1)
            nextIndex = keyframes.length - 1;
        const previous: DifficultyKeyframeData = keyframes[Math.max(0, nextIndex - 1)];
        const next: DifficultyKeyframeData = keyframes[nextIndex];
        const span: number = next.time - previous.time;
        const t: number = span > 0 ? Phaser.Math.Clamp((time - previous.time) / span, 0, 1) : 1;

        this._current.time = time;
        const coop: CoopScalingData = this._coop;
        const extraPlayers: number = this._extraPlayers;
        this._current.spawnInterval = Phaser.Math.Linear(previous.spawnInterval, next.spawnInterval, t)
            * Math.pow(coop.spawnIntervalPerPlayer, extraPlayers);
        this._current.maxEnemies = Math.round(Phaser.Math.Linear(previous.maxEnemies, next.maxEnemies, t)
            * (1 + coop.maxEnemiesPerPlayer * extraPlayers));
        // Rounded down: enemies only reach a keyframe's health at its time
        this._current.enemyHealth = Math.floor(Phaser.Math.Linear(previous.enemyHealth, next.enemyHealth, t)
            * (1 + coop.enemyHealthPerPlayer * extraPlayers));
        this._current.enemySpeed = Phaser.Math.Linear(previous.enemySpeed, next.enemySpeed, t);
        return this._current;
    }
}
