import Experience from "./components/Experience.ts";
import type Player from "./entities/Player.ts";
import type {XpCurveData} from "./gameData/DifficultyData.ts";

// The players of a run and what they share: XP and level
export default class Team {
    private readonly _players: Player[] = [];
    public readonly experience: Experience;

    public constructor(xpCurve: XpCurveData) {
        this.experience = new Experience(xpCurve);
    }

    public get players(): readonly Player[] {
        return this._players;
    }

    public addPlayer(player: Player) {
        this._players.push(player);
    }

    // The nearest player still in the fight, null when there's none
    public nearestPlayer(x: number, y: number): Player | null {
        let nearest: Player | null = null;
        let nearestDistanceSq: number = Infinity;
        for (const player of this._players) {
            if (!player.active)
                continue;
            const distanceSq: number = Phaser.Math.Distance.Squared(x, y, player.x, player.y);
            if (distanceSq < nearestDistanceSq) {
                nearest = player;
                nearestDistanceSq = distanceSq;
            }
        }
        return nearest;
    }
}
