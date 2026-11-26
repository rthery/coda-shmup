import {GameObjects, Tweens} from "phaser";
import IComponent from "./IComponent.ts";
import type {ThrusterData} from "../gameData/ThrusterData.ts";

enum ThrustState {
    IDLE,
    ACCELERATING,
    CRUISING,
    BRAKING,
}

type ThrustStateData = {
    length: number;
    // White-core flame
    isBoost: boolean;
    duration: number;
    ease: string;
}

// Tweened values, applied to the flame image every frame
type Flame = {
    image: GameObjects.Image;
    data: ThrusterData;
    length: number;
    turnFactor: number;
    gimbal: number;
    flicker: number;
    flickerTween?: Tweens.Tween;
    lengthTween?: Tweens.Tween;
    turnTween?: Tweens.Tween;
}

// A sprite or an image: the in-game player and the home menu ship
type Ship = GameObjects.Image | GameObjects.Sprite;

export default class Thrusters implements IComponent {
    public enabled: boolean = true;

    private static readonly STATES: Record<ThrustState, ThrustStateData> = {
        [ThrustState.IDLE]: {length: 0.4, isBoost: false, duration: 250, ease: 'Sine.easeOut'},
        [ThrustState.ACCELERATING]: {length: 1.3, isBoost: true, duration: 150, ease: 'Back.easeOut'},
        [ThrustState.CRUISING]: {length: 1, isBoost: false, duration: 200, ease: 'Sine.easeInOut'},
        [ThrustState.BRAKING]: {length: 0.2, isBoost: false, duration: 100, ease: 'Quad.easeOut'},
    };
    // Grey flames, tinted by heat: blue, then yellow, then hot orange as the thrusters are upgraded
    private static readonly FRAMES = {normal: 'fireNeutral', boost: 'fireNeutralBoost'};
    // Through white between blue and yellow: a straight blend would pass through a dull green
    private static readonly HEAT_COLORS: number[] = [0x5ab8ff, 0xeef6ff, 0xffd63c, 0xff6e14];
    // The engine end stays whiter, like a hot core
    private static readonly CORE_WHITENESS: number = 0.6;
    private static readonly SPEED_RATIO_THRESHOLD: number = 0.05;
    private static readonly TURN_RATE_THRESHOLD: number = 0.0005; // rad/ms
    private static readonly GIMBAL_ANGLE: number = Phaser.Math.DegToRad(25);
    private static readonly TWIN_TURN_FACTOR: number = 0.3;
    private static readonly TURN_TWEEN_DURATION: number = 150;
    private static readonly FLARE_DURATION: number = 400;
    private static readonly POWER_PER_UPGRADE: number = 0.05;
    private static readonly MAX_POWERED_UPGRADES: number = 3;

    private readonly _ship: Ship;
    private _flames: Flame[] = [];
    private _state: ThrustState | null = null;
    private _turnDirection: number = 0;
    // null until the first update, so setting the start angle doesn't count as a turn
    private _previousRotation: number | null = null;
    private _boost: boolean = false;
    private _flaring: boolean = false;
    private _upgradeCount: number = 0;
    private _heat: number = 0;
    // Tweened: grows a little with the first thrusters upgrades
    private readonly _power = {value: 1};
    private readonly _offset: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

    constructor(ship: Ship) {
        this._ship = ship;
    }

    // Replaces the flames, e.g. when the ship changes
    public setThrusters(thrusters: ThrusterData[]) {
        this._flames.forEach(flame => {
            flame.flickerTween?.stop();
            flame.lengthTween?.stop();
            flame.turnTween?.stop();
            flame.image.destroy();
        });

        this._flames = thrusters.map(data => {
            // fire frames point down: origin on the wide base, at the engine
            const image = this._ship.scene.add.image(0, 0, 'sprites', Thrusters.FRAMES.normal)
                .setOrigin(0.5, 0).setDepth(this._ship.depth - 1);
            this.applyHeat(image);
            const flame: Flame = {image, data, length: 0, turnFactor: 1, gimbal: 0, flicker: 1};

            flame.flickerTween = this._ship.scene.tweens.add({
                targets: flame,
                flicker: {from: 0.8, to: 1},
                duration: Phaser.Math.Between(60, 90),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });

            return flame;
        });

        // Apply the current state to the new flames
        this._state = null;
        this._turnDirection = 0;
    }

    // Full thrust while the ship moves on its own, like the intro fly-in
    public setBoost(boost: boolean) {
        this._boost = boost;
    }

    // Hotter and slightly bigger flames for good, with a short full-thrust flare to show it.
    // heat: 0 to 1, from no upgrade to the max rank
    public upgrade(heat: number) {
        this._upgradeCount++;
        this._heat = Phaser.Math.Clamp(heat, 0, 1);
        this._flames.forEach(flame => this.applyHeat(flame.image));

        this._ship.scene.tweens.add({
            targets: this._power,
            value: 1 + Math.min(this._upgradeCount, Thrusters.MAX_POWERED_UPGRADES) * Thrusters.POWER_PER_UPGRADE,
            duration: 300,
            ease: 'Back.easeOut'
        });

        this._flaring = true;
        this._ship.scene.time.delayedCall(Thrusters.FLARE_DURATION, () => this._flaring = false);
    }

    public hide() {
        this._flames.forEach(flame => flame.image.setVisible(false));
        this.enabled = false;
    }

    // speedRatio: current speed / max speed
    public update(hasInput: boolean, speedRatio: number, deltaTime: number) {
        if (!this.enabled || this._flames.length == 0)
            return;

        this.setState(this.computeState(hasInput, speedRatio));
        this.setTurnDirection(this.computeTurnDirection(deltaTime));
        this.applyToImages();
    }

    private computeState(hasInput: boolean, speedRatio: number): ThrustState {
        if (this._boost || this._flaring)
            return ThrustState.ACCELERATING;

        if (hasInput)
            return speedRatio < 1 - Thrusters.SPEED_RATIO_THRESHOLD ? ThrustState.ACCELERATING : ThrustState.CRUISING;

        return speedRatio > Thrusters.SPEED_RATIO_THRESHOLD ? ThrustState.BRAKING : ThrustState.IDLE;
    }

    // 1 clockwise, -1 counterclockwise, 0 straight
    private computeTurnDirection(deltaTime: number): number {
        const previousRotation: number = this._previousRotation ?? this._ship.rotation;
        this._previousRotation = this._ship.rotation;
        const turnRate: number = deltaTime > 0
            ? Phaser.Math.Angle.Wrap(this._ship.rotation - previousRotation) / deltaTime : 0;

        return Math.abs(turnRate) > Thrusters.TURN_RATE_THRESHOLD ? Math.sign(turnRate) : 0;
    }

    private setState(state: ThrustState) {
        if (state === this._state)
            return;
        this._state = state;

        const stateData = Thrusters.STATES[state];
        this._flames.forEach(flame => {
            flame.image.setFrame(this.getFrame(stateData.isBoost));
            // Restart from the current length, so a new state never jumps
            flame.lengthTween?.stop();
            flame.lengthTween = this._ship.scene.tweens.add({
                targets: flame,
                length: stateData.length,
                duration: stateData.duration,
                ease: stateData.ease
            });
        });
    }

    private getFrame(isBoost: boolean): string {
        return isBoost ? Thrusters.FRAMES.boost : Thrusters.FRAMES.normal;
    }

    private applyHeat(image: GameObjects.Image) {
        const colors: number[] = Thrusters.HEAT_COLORS;
        const position: number = this._heat * (colors.length - 1);
        const index: number = Math.min(Math.floor(position), colors.length - 2);
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(colors[index]), Phaser.Display.Color.ValueToColor(colors[index + 1]),
            100, Math.round((position - index) * 100));
        const whiteness: number = Thrusters.CORE_WHITENESS;
        const body: number = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
        const top: number = Phaser.Display.Color.GetColor(
            color.r + (255 - color.r) * whiteness, color.g + (255 - color.g) * whiteness, color.b + (255 - color.b) * whiteness);
        // Frames point down: the top is the engine end
        image.setTint(top, top, body, body);
    }

    private setTurnDirection(turnDirection: number) {
        if (turnDirection === this._turnDirection)
            return;
        this._turnDirection = turnDirection;

        const isSingle: boolean = this._flames.length == 1;
        this._flames.forEach(flame => {
            // Differential thrust: the engine on the outer side of the turn pushes harder
            const side: number = flame.data.y < 0 ? 1 : -1;

            flame.turnTween?.stop();
            flame.turnTween = this._ship.scene.tweens.add({
                targets: flame,
                // A single flame swings opposite to the turn instead, like a steering nozzle
                gimbal: isSingle ? -turnDirection * Thrusters.GIMBAL_ANGLE : 0,
                turnFactor: isSingle ? 1 : 1 + turnDirection * side * Thrusters.TWIN_TURN_FACTOR,
                duration: Thrusters.TURN_TWEEN_DURATION,
                ease: 'Sine.easeOut'
            });
        });
    }

    private applyToImages() {
        const ship = this._ship;
        const power: number = this._power.value;

        this._flames.forEach(flame => {
            this._offset.set(flame.data.x, flame.data.y).rotate(ship.rotation);
            flame.image.setPosition(ship.x + this._offset.x, ship.y + this._offset.y);
            // +90°: the flame points down in the texture, backward on the ship
            flame.image.setRotation(ship.rotation + Math.PI / 2 + flame.gimbal);
            flame.image.setScale(flame.data.scale * flame.flicker * power,
                flame.data.scale * flame.length * flame.turnFactor * power);
            flame.image.setAlpha(ship.alpha * flame.flicker);
            flame.image.setVisible(ship.visible);
        });
    }
}
