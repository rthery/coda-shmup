import {GameObjects} from "phaser";
import IComponent from "./IComponent.ts";
import type {WingTipData} from "../gameData/WingTipData.ts";

// A sprite or an image: the in-game player and the home menu ship
type Ship = GameObjects.Image | GameObjects.Sprite;

// Light streaks behind the wing tips, like wingtip vortices at speed
export default class WingTrails implements IComponent {
    public enabled: boolean = true;

    private static readonly SPACING: number = 3; // px

    private readonly _ship: Ship;
    private readonly _trailFX: GameObjects.Particles.ParticleEmitter;
    private _wingTips: WingTipData[] = [];
    // Last emitted point per wing tip, null when the trail is off
    private _previousPoints: (Phaser.Math.Vector2 | null)[] = [];
    private readonly _point: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    // trailSpeedY: drift of the particles in px/s, to follow a scrolling background
    constructor(ship: Ship, trailSpeedY: number = 0) {
        this._ship = ship;

        this._trailFX = ship.scene.add.particles(0, 0, 'shapes', {
            maxParticles: 1000,
            frame: 'circle_05',
            speedX: 0,
            speedY: trailSpeedY,
            scale: {start: 0.08, end: 0.02},
            alpha: {start: 0.35, end: 0},
            tint: 0xffffff,
            lifespan: 350,
            emitting: false
        }).setDepth(ship.depth - 1);
    }

    // Replaces the wing tips, e.g. when the ship changes
    public setWingTips(wingTips: WingTipData[]) {
        this._wingTips = wingTips;
        this._previousPoints = wingTips.map(() => null);
    }

    // Existing streaks fade out on their own
    public hide() {
        this.enabled = false;
    }

    public show() {
        this.enabled = true;
    }

    public update(isOn: boolean) {
        if (!this.enabled)
            return;

        const ship = this._ship;

        this._wingTips.forEach((wingTip, index) => {
            if (!isOn || !ship.visible) {
                this._previousPoints[index] = null;
                return;
            }

            this._point.set(wingTip.x, wingTip.y).rotate(ship.rotation).add(ship);

            // Fill the path since the last frame, so the streak has no gaps at high speed
            const previousPoint = this._previousPoints[index] ?? this._point.clone();
            const distance: number = Phaser.Math.Distance.BetweenPoints(previousPoint, this._point);
            const steps: number = Math.max(1, Math.ceil(distance / WingTrails.SPACING));
            for (let step = 0; step < steps; step++) {
                const t: number = step / steps;
                this._trailFX.emitParticleAt(Phaser.Math.Linear(previousPoint.x, this._point.x, t),
                    Phaser.Math.Linear(previousPoint.y, this._point.y, t));
            }

            this._previousPoints[index] = previousPoint.copy(this._point);
        });
    }
}
