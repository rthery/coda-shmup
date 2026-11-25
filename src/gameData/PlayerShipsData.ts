import {CircleBodyData} from "./CircleBodyData.ts";

export type PlayerShipsData = {
    [key: string]: PlayerShipData
}

export type PlayerShipData = {
    movementSpeed: number;
    texture: string;
    body: CircleBodyData;
}