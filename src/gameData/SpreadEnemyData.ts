import type {SpreadShotData} from "./SpreadShotData.ts";

// Shape of public/assets/Data/spreadEnemy.json: everything that can be tuned without touching the code.

export type SpawnData = {
    // Milliseconds between two spawns (lower = more frequent)
    interval: number;
    // No new enemy spawns while this many are already alive
    maxActive: number;
};

export type SineMovementData = {
    // Vertical speed, in pixels per millisecond (same unit as the Movement component)
    speedY: number;
    // Half-width of the horizontal oscillation, in pixels (reduced automatically if it doesn't fit on screen)
    amplitude: number;
    // Number of full left-right-left oscillations per second (Hz)
    frequency: number;
    // Starting point in the oscillation, in degrees (0 = starts at the center, moving right)
    phase: number;
};

// Same as BulletData, except the color is a CSS hex string ("#5cf2a0") because JSON has no hex number literal
export type SpreadBulletData = {
    width: number;
    height: number;
    color: string;
    speed: number;
    damage: number;
};

export type SpreadAttackData = {
    // Random delay, in milliseconds, between the end of a shot and the start of the next one
    shootDelay: { min: number; max: number };
    spread: SpreadShotData;
    bullet: SpreadBulletData;
};

export type SpreadEnemyData = {
    health: number;
    spawn: SpawnData;
    movement: SineMovementData;
    attack: SpreadAttackData;
};