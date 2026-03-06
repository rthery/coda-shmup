import {CircleBodyData} from "./CircleBodyData.ts";

export type BulletData = {
    scale: number;
    texture: string;
    blink: boolean;
    speed: number;
    damage: number;
    body: CircleBodyData;
    fx: BulletFxData;
}

export type BulletFxData = {
    flashTint: number;
    sparkTints: number[];
    glowTints: number[];
}