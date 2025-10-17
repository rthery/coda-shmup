import {ShipBodyData} from "./ShipBodyData.ts";

export type PlayerShipsData = {
    [key: string]: PlayerShipData
}

export type PlayerShipData = {
    movementSpeed: number;
    texture: string;
    body: ShipBodyData;
}