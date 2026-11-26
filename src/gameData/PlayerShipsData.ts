import {CircleBodyData} from "./CircleBodyData.ts";
import {ThrusterData} from "./ThrusterData.ts";
import {WingTipData} from "./WingTipData.ts";
import {TurretData} from "./TurretData.ts";

export type PlayerShipsData = {
    [key: string]: PlayerShipData
}

export type PlayerShipData = {
    movementSpeed: number;
    acceleration: number;
    deceleration: number;
    turnSpeed: number;
    texture: string;
    body: CircleBodyData;
    thrusters: ThrusterData[];
    turret: TurretData;
    wingTips: WingTipData[];
}