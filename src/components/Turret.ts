import {GameObjects} from "phaser";
import IComponent from "./IComponent.ts";
import type {TurretData} from "../gameData/TurretData.ts";

// A sprite or an image: the in-game player and the home menu ship
type Ship = GameObjects.Image | GameObjects.Sprite;
// The enemy the aim guide points at
type GuideTarget = { x: number; y: number; displayWidth: number };

// Turns on its own toward a target, on top of the ship
export default class Turret implements IComponent {
    public enabled: boolean = true;

    // Twin barrels sit this far either side of the turret's axis
    private static readonly TWIN_BARREL_OFFSET: number = 5;
    private static readonly HEAT_GLOW_TINT: number = 0x00ccff;
    private static readonly HEAT_GLOW_DURATION: number = 250;
    private static readonly SPEED_RING_DURATION: number = 200;
    private static readonly GUIDE_COLOR: number = 0x8cf0ff;
    private static readonly GUIDE_DASH: number = 14;
    private static readonly GUIDE_GAP: number = 10;
    // Fraction of the way to the target the guide covers at the first rank
    private static readonly GUIDE_MIN_LENGTH: number = 0.25;
    // Lock-on brackets at the max rank: four corners that snap in on a new target, then hold
    private static readonly BRACKET_MARGIN: number = 10; // px around the target
    private static readonly BRACKET_LENGTH: number = 16; // px
    private static readonly BRACKET_LOCK_DISTANCE: number = 40; // px they start out from
    private static readonly BRACKET_LOCK_DURATION: number = 250; // ms
    // The frame points right, its pivot is the center of the round base
    private static readonly BASE_RADIUS: number = 13;
    private static readonly TRACK_TURN_SPEED: number = 0.012; // rad/ms
    // With no target, it holds its aim for a moment, then slowly turns back to the ship's heading
    private static readonly RETURN_DELAY: number = 500; // ms
    private static readonly RETURN_TURN_SPEED: number = 0.004; // rad/ms
    private static readonly RECOIL_DISTANCE: number = 7;
    private static readonly RECOIL_DURATION: number = 120;
    private static readonly FLASH_FRAMES: string[] = ['muzzle_02', 'muzzle_03', 'muzzle_04', 'muzzle_05'];
    private static readonly FLASH_DURATION: number = 70;

    private readonly _ship: Ship;
    private readonly _image: GameObjects.Image;
    private readonly _flash: GameObjects.Image;
    private readonly _heatGlow: GameObjects.Image;
    private readonly _guide: GameObjects.Graphics;
    private readonly _speedRing: GameObjects.Image;
    private _hasSpeedRing: boolean = false;
    private readonly _pivot: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _muzzle: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _recoil = {distance: 0};
    private _data: TurretData = {x: 0, y: 0, frame: 'playerTurret', twinFrame: 'playerTurretTwin'};
    private _isTwin: boolean = false;
    private _targetRotation: number | null = null;
    private _timeWithoutTarget: number = 0; // ms
    // 0 on a single barrel, alternates between -1 and 1 on twin barrels
    private _barrelSide: number = 0;
    private _flashSide: number = 0;
    private _heat: number = 0;
    // 0: no guide, up to 1: full laser sight
    private _guideLevel: number = 0;
    private _guideTarget: GuideTarget | null = null;
    private _lockStartTime: number = 0; // ms, scene time

    public get rotation(): number {
        return this._image.rotation;
    }

    constructor(ship: Ship) {
        this._ship = ship;
        this._image = ship.scene.add.image(0, 0, 'sprites', this._data.frame);
        this._image.setOrigin(Turret.BASE_RADIUS / this._image.width, 0.5).setRotation(ship.rotation);
        // Flame shapes point up, their base on the barrel's end
        this._flash = ship.scene.add.image(0, 0, 'shapes', Turret.FLASH_FRAMES[0])
            .setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        this._heatGlow = ship.scene.add.image(0, 0, 'shapes', 'circle_05').setScale(0.5)
            .setTint(Turret.HEAT_GLOW_TINT).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this._guide = ship.scene.add.graphics();
        this._speedRing = ship.scene.add.image(0, 0, 'shapes', 'circle_02').setTint(Turret.HEAT_GLOW_TINT)
            .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    }

    // RAPID FIRE: a hotter barrel after each shot, twin barrels at the max rank
    public setRapidFire(heat: number, isTwin: boolean) {
        this._heat = heat;
        this._isTwin = isTwin;
        this._image.setFrame(isTwin ? this._data.twinFrame : this._data.frame);
        this._barrelSide = isTwin ? 1 : 0;
    }

    // FAST LASERS at the max rank: a ring bursts from the muzzle at each shot
    public setSpeedRing(hasSpeedRing: boolean) {
        this._hasSpeedRing = hasSpeedRing;
    }

    // LONG RANGE: 0 for none, up to 1 for a full laser sight
    public setAimGuide(level: number) {
        this._guideLevel = level;
    }

    // The target the guide points at, null when none is in range
    public setGuideTarget(target: GuideTarget | null) {
        // A new target restarts the lock-on
        if (target !== this._guideTarget)
            this._lockStartTime = this._ship.scene.time.now;
        this._guideTarget = target;
    }

    // Kicks the barrel back and flashes at its end, tinted like the laser
    public playShot(flashTint: number) {
        const scene = this._ship.scene;
        // The flash stays on the barrel that fired, the next shot uses the other one
        this._flashSide = this._barrelSide;
        this._barrelSide = -this._barrelSide;

        if (this._hasSpeedRing)
            this.playSpeedRing();

        if (this._heat > 0) {
            scene.tweens.killTweensOf(this._heatGlow);
            scene.tweens.add({targets: this._heatGlow, alpha: {from: this._heat, to: 0},
                duration: Turret.HEAT_GLOW_DURATION});
        }
        scene.tweens.killTweensOf(this._recoil);
        scene.tweens.add({
            targets: this._recoil,
            distance: {from: Turret.RECOIL_DISTANCE, to: 0},
            duration: Turret.RECOIL_DURATION,
            ease: 'Quad.easeOut'
        });

        scene.tweens.killTweensOf(this._flash);
        this._flash.setFrame(Phaser.Utils.Array.GetRandom(Turret.FLASH_FRAMES)).setTint(flashTint)
            .setVisible(true).setAlpha(1).setScale(Phaser.Math.FloatBetween(0.6, 0.9));
        scene.tweens.add({
            targets: this._flash,
            alpha: 0,
            scaleX: 0.3,
            duration: Turret.FLASH_DURATION,
            ease: 'Quad.easeIn',
            onComplete: () => this._flash.setVisible(false)
        });
    }

    // The laser's color, for the heat glow and the speed ring
    public setGlowTint(tint: number) {
        this._heatGlow.setTint(tint);
        this._speedRing.setTint(tint);
    }

    public setTurret(data: TurretData) {
        this._data = data;
        this._image.setFrame(this._isTwin ? data.twinFrame : data.frame);
    }

    // null: back to the ship's heading
    public aim(rotation: number | null) {
        this._targetRotation = rotation;
    }

    public isAimedAt(rotation: number, tolerance: number): boolean {
        return Math.abs(Phaser.Math.Angle.Wrap(rotation - this._image.rotation)) <= tolerance;
    }

    // Where lasers leave the barrel about to fire, in world space
    public getMuzzle(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
        return this.getBarrelEnd(out, this._barrelSide);
    }

    // Seen edge-on, the ring is flat along the barrel, and grows as it flies off the muzzle
    private playSpeedRing() {
        const scene = this._ship.scene;
        this.getBarrelEnd(this._muzzle, this._barrelSide);
        const rotation: number = this._image.rotation;
        scene.tweens.killTweensOf(this._speedRing);
        this._speedRing.setPosition(this._muzzle.x, this._muzzle.y).setRotation(rotation)
            .setScale(0.2, 0.6).setAlpha(1).setVisible(true).setDepth(this._ship.depth + 2);
        scene.tweens.add({
            targets: this._speedRing,
            x: this._muzzle.x + Math.cos(rotation) * 30,
            y: this._muzzle.y + Math.sin(rotation) * 30,
            scaleX: 0.3,
            scaleY: 1,
            alpha: 0,
            duration: Turret.SPEED_RING_DURATION,
            ease: 'Quad.easeOut',
            onComplete: () => this._speedRing.setVisible(false)
        });
    }

    private getBarrelEnd(out: Phaser.Math.Vector2, side: number): Phaser.Math.Vector2 {
        const length: number = this._image.width - Turret.BASE_RADIUS;
        const sideOffset: number = side * Turret.TWIN_BARREL_OFFSET;
        const cos: number = Math.cos(this._image.rotation);
        const sin: number = Math.sin(this._image.rotation);
        return out.set(this._image.x + cos * length - sin * sideOffset, this._image.y + sin * length + cos * sideOffset);
    }

    public hide() {
        this._image.setVisible(false);
        this._flash.setVisible(false);
        this._heatGlow.setVisible(false);
        this._speedRing.setVisible(false);
        this._guide.setVisible(false);
    }

    // The flash and the speed ring show with the next shots
    public show() {
        this._image.setVisible(true);
        this._heatGlow.setVisible(true);
        this._guide.setVisible(true);
    }

    public update(deltaTime: number) {
        if (this._targetRotation !== null) {
            this._timeWithoutTarget = 0;
            this._image.rotation = Phaser.Math.Angle.RotateTo(this._image.rotation, this._targetRotation,
                Turret.TRACK_TURN_SPEED * deltaTime);
        } else {
            this._timeWithoutTarget += deltaTime;
            if (this._timeWithoutTarget > Turret.RETURN_DELAY)
                this._image.rotation = Phaser.Math.Angle.RotateTo(this._image.rotation, this._ship.rotation,
                    Turret.RETURN_TURN_SPEED * deltaTime);
        }

        this._pivot.set(this._data.x, this._data.y).rotate(this._ship.rotation);
        const recoil: number = this._recoil.distance;
        this._image.setPosition(
            this._ship.x + this._pivot.x - Math.cos(this._image.rotation) * recoil,
            this._ship.y + this._pivot.y - Math.sin(this._image.rotation) * recoil)
            .setDepth(this._ship.depth + 1)
            // Blinks with the ship while it's invulnerable
            .setAlpha(this._ship.alpha);

        this.getBarrelEnd(this._muzzle, this._flashSide);
        this._flash.setPosition(this._muzzle.x, this._muzzle.y).setRotation(this._image.rotation + Math.PI / 2)
            .setDepth(this._ship.depth + 2);
        // Halfway along the barrel
        const barrelMiddle: number = (this._image.width - Turret.BASE_RADIUS) * 0.6;
        this._heatGlow.setPosition(this._image.x + Math.cos(this._image.rotation) * barrelMiddle,
            this._image.y + Math.sin(this._image.rotation) * barrelMiddle).setDepth(this._ship.depth + 2);

        this.drawAimGuide();
    }

    private drawAimGuide() {
        this._guide.clear();
        const target: GuideTarget | null = this._guideTarget;
        const isFull: boolean = this._guideLevel >= 1;
        if (this._guideLevel <= 0 || !target || !this._image.visible)
            return;

        this.getBarrelEnd(this._muzzle, 0);
        const fromX: number = this._muzzle.x;
        const fromY: number = this._muzzle.y;
        const distance: number = Phaser.Math.Distance.Between(fromX, fromY, target.x, target.y);
        const directionX: number = (target.x - fromX) / distance;
        const directionY: number = (target.y - fromY) / distance;
        this._guide.setDepth(this._ship.depth - 1);

        if (isFull) {
            this._guide.lineStyle(2, Turret.GUIDE_COLOR, 0.3).lineBetween(fromX, fromY, target.x, target.y);
            this.drawLockBrackets(target);
            return;
        }

        // Dashes reaching further with each rank
        const length: number = distance * Phaser.Math.Linear(Turret.GUIDE_MIN_LENGTH, 1, this._guideLevel);
        for (let start = 0; start < length; start += Turret.GUIDE_DASH + Turret.GUIDE_GAP) {
            const end: number = Math.min(start + Turret.GUIDE_DASH, length);
            // Fades out toward its end
            this._guide.lineStyle(3, Turret.GUIDE_COLOR, 0.35 * (1 - start / length));
            this._guide.lineBetween(fromX + directionX * start, fromY + directionY * start,
                fromX + directionX * end, fromY + directionY * end);
        }
    }

    private drawLockBrackets(target: GuideTarget) {
        const lock: number = Phaser.Math.Easing.Cubic.Out(
            Math.min(1, (this._ship.scene.time.now - this._lockStartTime) / Turret.BRACKET_LOCK_DURATION));
        const radius: number = target.displayWidth / 2 + Turret.BRACKET_MARGIN
            + (1 - lock) * Turret.BRACKET_LOCK_DISTANCE;
        const length: number = Turret.BRACKET_LENGTH;
        this._guide.lineStyle(3, Turret.GUIDE_COLOR, Phaser.Math.Linear(0.25, 0.55, lock));
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const cornerX: number = target.x + sx * radius;
            const cornerY: number = target.y + sy * radius;
            this._guide.strokePoints([
                {x: cornerX, y: cornerY - sy * length},
                {x: cornerX, y: cornerY},
                {x: cornerX - sx * length, y: cornerY},
            ]);
        }
    }
}
