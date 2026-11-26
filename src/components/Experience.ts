import {Events} from "phaser";
import IComponent from "./IComponent.ts";
import type {XpCurveData} from "../gameData/DifficultyData.ts";

export default class Experience extends Events.EventEmitter implements IComponent {
    public enabled: boolean = true;

    public static readonly CHANGE_EVENT: string = 'change';
    public static readonly LEVEL_UP_EVENT: string = 'levelUp';

    private _curve: XpCurveData;
    private _xp: number = 0;
    private _level: number = 1;

    public constructor(curve: XpCurveData) {
        super();
        this._curve = curve;
    }

    // Coop: a player joining raises the XP each level takes
    public setCurve(curve: XpCurveData) {
        this._curve = curve;
    }

    public get xp(): number {
        return this._xp;
    }

    public get level(): number {
        return this._level;
    }

    public get xpToNextLevel(): number {
        const levelsGained: number = this._level - 1;
        return this._curve.base + this._curve.perLevel * levelsGained
            + this._curve.perLevelSquared * levelsGained * levelsGained;
    }

    public add(amount: number): void {
        if (!this.enabled || amount <= 0) return;

        this._xp += amount;

        if (this._xp >= this.xpToNextLevel) {
            // Keep the overflow for the next level
            this._xp -= this.xpToNextLevel;
            this._level++;
            this.emit(Experience.CHANGE_EVENT, this._xp, this.xpToNextLevel, this._level);
            this.emit(Experience.LEVEL_UP_EVENT, this._level);
            return;
        }

        this.emit(Experience.CHANGE_EVENT, this._xp, this.xpToNextLevel, this._level);
    }
}
