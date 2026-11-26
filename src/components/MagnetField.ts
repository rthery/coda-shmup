import {GameObjects, Physics} from "phaser";
import IComponent from "./IComponent.ts";
import XpGem from "../entities/XpGem.ts";

// A sprite or an image: the in-game player and the home menu ship
type Ship = GameObjects.Image | GameObjects.Sprite;

// MAGNET: faint rings leave the pickup radius and fade a little way in. The radius grows with each rank,
// and the field is tethered to the stars it pulls at the max rank
export default class MagnetField implements IComponent {
    public enabled: boolean = true;

    private static readonly COLOR: number = 0xffd23c;
    // A pulse only travels this fraction of the radius inward, far from the ship
    private static readonly PULSE_DEPTH: number = 0.12;
    private static readonly PULSE_PERIOD: number = 1800; // ms
    // Peak opacity of a pulse, the same at every rank: the radius already shows the rank
    private static readonly PEAK_ALPHA: number = 0.12;
    private static readonly LINE_WIDTH: number = 2;
    private static readonly TETHER_ALPHA: number = 0.12;
    private static readonly TETHER_WIDTH: number = 1.5;

    private readonly _ship: Ship;
    private readonly _graphics: GameObjects.Graphics;
    // 0: hidden, up to 1 at the max rank
    private _level: number = 0;
    private _time: number = 0; // ms

    constructor(ship: Ship) {
        this._ship = ship;
        this._graphics = ship.scene.add.graphics();
    }

    public setLevel(level: number) {
        this._level = level;
    }

    public hide() {
        this.enabled = false;
        this._graphics.clear();
    }

    public update(radius: number, gems: Physics.Arcade.Group | null, deltaTime: number) {
        this._graphics.clear();
        if (!this.enabled || this._level <= 0)
            return;

        const isMax: boolean = this._level >= 1;
        const x: number = this._ship.x;
        const y: number = this._ship.y;
        this._time = (this._time + deltaTime) % MagnetField.PULSE_PERIOD;
        this._graphics.setDepth(this._ship.depth - 2);

        // Two staggered pulses at the max rank, one before
        const pulses: number = isMax ? 2 : 1;
        for (let i = 0; i < pulses; i++) {
            const phase: number = (this._time / MagnetField.PULSE_PERIOD + i / pulses) % 1;
            // Fades in fast at the radius, then out as it moves in
            const alpha: number = MagnetField.PEAK_ALPHA * Math.min(1, phase * 5) * (1 - phase);
            this._graphics.lineStyle(MagnetField.LINE_WIDTH, MagnetField.COLOR, alpha)
                .strokeCircle(x, y, radius * (1 - MagnetField.PULSE_DEPTH * phase));
        }

        if (!isMax || !gems)
            return;
        this._graphics.lineStyle(MagnetField.TETHER_WIDTH, MagnetField.COLOR, MagnetField.TETHER_ALPHA);
        gems.getChildren().forEach(child => {
            const gem = child as XpGem;
            if (gem.active && gem.isAttracted)
                this._graphics.lineBetween(x, y, gem.x, gem.y);
        });
    }
}
