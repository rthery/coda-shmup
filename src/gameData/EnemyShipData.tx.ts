import {ShipBodyData} from "./ShipBodyData.ts";
import {ShipMovementData} from "./ShipMovementData.ts";

export type EnemyShipsData = {
    [key: string]: EnemyShipData
}

export type EnemyShipData = {
    movement: ShipMovementData;
    texture: string;
    body: ShipBodyData;
}