import {CircleBodyData} from "./CircleBodyData.ts";

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
}