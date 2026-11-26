import {GameObjects} from "phaser";
import IComponent from "./IComponent.ts";

// A sprite or an image: the in-game player and the home menu ship
type Ship = GameObjects.Image | GameObjects.Sprite;

// Kenney shield arcs around the ship, stronger with each shield cell left.
// Its brightness breathes, and now and then a band of light sweeps across it
export default class ShieldBubble implements IComponent {
    public enabled: boolean = true;

    // One frame per shield cell: the upgrade can't go past the number of frames
    public static readonly FRAMES: string[] = ['shield1', 'shield2', 'shield3'];
    private static readonly TINT: number = 0x5ad2ff;
    private static readonly ALPHA: number = 0.45;
    // Brightness swings this much around ALPHA, over a slow period
    private static readonly PULSE_AMOUNT: number = 0.12;
    private static readonly PULSE_PERIOD: number = 2400; // ms
    private static readonly SWEEP_MIN_DELAY: number = 3000; // ms
    private static readonly SWEEP_MAX_DELAY: number = 6000; // ms
    private static readonly SWEEP_DURATION: number = 600; // ms
    private static readonly SWEEP_WIDTH: number = 26; // px
    private static readonly SWEEP_ALPHA: number = 0.8;
    // Across the bubble, from one edge to the other
    private static readonly SWEEP_REACH: number = 80; // px

    private readonly _ship: Ship;
    private readonly _image: GameObjects.Image;
    // White copy of the arc, only seen through the moving band
    private readonly _sheen: GameObjects.Image;
    private readonly _sheenMask: GameObjects.Graphics;
    private readonly _sweep = {progress: 0};
    private _isSweeping: boolean = false;
    private _cells: number = 0;

    constructor(ship: Ship) {
        this._ship = ship;
        this._image = ship.scene.add.image(0, 0, 'sprites', ShieldBubble.FRAMES[0])
            .setTint(ShieldBubble.TINT).setBlendMode(Phaser.BlendModes.ADD).setAlpha(ShieldBubble.ALPHA).setVisible(false);
        this._sheenMask = ship.scene.make.graphics({}, false);
        this._sheen = ship.scene.add.image(0, 0, 'sprites', ShieldBubble.FRAMES[0])
            .setBlendMode(Phaser.BlendModes.ADD).setAlpha(ShieldBubble.SWEEP_ALPHA).setVisible(false)
            .setMask(this._sheenMask.createGeometryMask());
        this.scheduleSweep();
    }

    private scheduleSweep() {
        const scene = this._ship.scene;
        scene.time.delayedCall(Phaser.Math.Between(ShieldBubble.SWEEP_MIN_DELAY, ShieldBubble.SWEEP_MAX_DELAY), () => {
            if (!this.enabled)
                return;
            this._isSweeping = true;
            scene.tweens.add({
                targets: this._sweep,
                progress: {from: 0, to: 1},
                duration: ShieldBubble.SWEEP_DURATION,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    this._isSweeping = false;
                    this.scheduleSweep();
                }
            });
        });
    }

    // A lost cell flares before the bubble shrinks
    public setCells(cells: number) {
        const lostCell: boolean = cells < this._cells;
        this._cells = Phaser.Math.Clamp(cells, 0, ShieldBubble.FRAMES.length);
        if (this._cells > 0)
            this._image.setFrame(ShieldBubble.FRAMES[this._cells - 1]);

        const scene = this._ship.scene;
        scene.tweens.killTweensOf(this._image);
        this._image.setScale(1).setAlpha(ShieldBubble.ALPHA);
        if (lostCell) {
            this._image.setVisible(true);
            scene.tweens.add({
                targets: this._image,
                scale: {from: 1.3, to: 1},
                alpha: {from: 1, to: this._cells > 0 ? ShieldBubble.ALPHA : 0},
                duration: 300,
                ease: 'Quad.easeOut',
                onComplete: () => this._image.setVisible(this._cells > 0)
            });
        } else {
            this._image.setVisible(this._cells > 0);
        }
    }

    public hide() {
        this.enabled = false;
        this._ship.scene.tweens.killTweensOf(this._image);
        this._image.setVisible(false);
        this._sheen.setVisible(false);
    }

    public update() {
        const scene = this._ship.scene;
        this._image.setPosition(this._ship.x, this._ship.y).setRotation(this._ship.rotation)
            .setDepth(this._ship.depth + 3);
        // The hit flare owns the alpha while it plays
        if (this._image.visible && !scene.tweens.isTweening(this._image)) {
            const pulse: number = Math.sin(scene.time.now / ShieldBubble.PULSE_PERIOD * Math.PI * 2);
            this._image.setAlpha(ShieldBubble.ALPHA + pulse * ShieldBubble.PULSE_AMOUNT);
        }
        this.updateSweep();
    }

    // A diagonal band, in the ship's frame, crossing the bubble: only the sheen inside it shows
    private updateSweep() {
        const isVisible: boolean = this._isSweeping && this._image.visible && this._cells > 0;
        this._sheen.setVisible(isVisible);
        this._sheenMask.clear();
        if (!isVisible)
            return;

        this._sheen.setFrame(this._image.frame.name).setPosition(this._image.x, this._image.y)
            .setRotation(this._image.rotation).setDepth(this._image.depth + 1);

        const angle: number = this._ship.rotation + Math.PI / 4;
        const offset: number = Phaser.Math.Linear(-ShieldBubble.SWEEP_REACH, ShieldBubble.SWEEP_REACH, this._sweep.progress);
        // Band center, moved across along its normal
        const cx: number = this._ship.x + Math.cos(angle) * offset;
        const cy: number = this._ship.y + Math.sin(angle) * offset;
        const halfWidth: number = ShieldBubble.SWEEP_WIDTH / 2;
        const halfLength: number = ShieldBubble.SWEEP_REACH * 1.5;
        const nx: number = Math.cos(angle), ny: number = Math.sin(angle);
        const tx: number = -ny, ty: number = nx;
        this._sheenMask.fillStyle(0xffffff).fillPoints([
            {x: cx + nx * halfWidth + tx * halfLength, y: cy + ny * halfWidth + ty * halfLength},
            {x: cx - nx * halfWidth + tx * halfLength, y: cy - ny * halfWidth + ty * halfLength},
            {x: cx - nx * halfWidth - tx * halfLength, y: cy - ny * halfWidth - ty * halfLength},
            {x: cx + nx * halfWidth - tx * halfLength, y: cy + ny * halfWidth - ty * halfLength},
        ], true);
    }
}
