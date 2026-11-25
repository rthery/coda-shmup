import {Events} from "phaser";
import IComponent from "./IComponent.ts";

export default class Experience extends Events.EventEmitter implements IComponent {
    public enabled: boolean = true;

    public static readonly CHANGE_EVENT: string = 'change';
    public static readonly LEVEL_UP_EVENT: string = 'levelUp';

    private static readonly FIRST_LEVEL_XP: number = 5;
    private static readonly XP_PER_LEVEL: number = 5;

    private _xp: number = 0;
    private _level: number = 1;

    public get xp(): number {
        return this._xp;
    }

    public get level(): number {
        return this._level;
    }

    public get xpToNextLevel(): number {
        return Experience.FIRST_LEVEL_XP + (this._level - 1) * Experience.XP_PER_LEVEL;
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
