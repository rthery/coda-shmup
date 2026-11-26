import {CircleBodyData} from "./CircleBodyData.ts";

export type BulletData = {
    scale: number;
    texture: string;
    blink: boolean;
    speed: number;
    range: number;
    damage: number;
    // Enemies a bullet goes through before disappearing
    pierce: number;
    // FAST LASERS: how long the trail dots last, 0 or missing for no trail
    trailLifespan?: number; // ms
    // PIERCING: stretches the bolt into a lance, 1 when missing
    lengthScale?: number;
    body: CircleBodyData;
    fx: BulletFxData;
}

export type BulletFxData = {
    // Multiplies the impact's sparks, 1 when missing
    impactSize?: number;
    flashTint: number;
    sparkTints: number[];
    glowTints: number[];
}