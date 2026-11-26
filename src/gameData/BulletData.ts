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