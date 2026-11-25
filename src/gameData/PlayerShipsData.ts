import {CircleBodyData} from "./CircleBodyData.ts";
import {ThrusterData} from "./ThrusterData.ts";

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
}