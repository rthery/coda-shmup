import {CircleBodyData} from "./CircleBodyData.ts";
import {ThrusterData} from "./ThrusterData.ts";
import {WingTipData} from "./WingTipData.ts";
import {TurretData} from "./TurretData.ts";

export type PlayerShipsData = {
    [key: string]: PlayerShipData
}

// The ship's lasers: their sprites (prefix + 01, 12 or 16, by HEAVY LASERS rank) and their effects' colors.
// The first glow tint also colors the trail and the turret's heat glow
export type LaserColorData = {
    texturePrefix: string;
    sparkTints: string[];
    glowTints: string[];
}

export type PlayerShipData = {
    movementSpeed: number;
    acceleration: number;
    deceleration: number;
    turnSpeed: number;
    texture: string;
    // HUD lives and coop pod
    lifeIcon: string;
    body: CircleBodyData;
    thrusters: ThrusterData[];
    turret: TurretData;
    laser: LaserColorData;
    wingTips: WingTipData[];
}