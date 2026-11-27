import { EnemyBodyData } from "./EnemyBodyData";

export type EnemyShipsData = {
    [key: string]: EnemyShipData
}

export type EnemyShipData = {
    movementSpeed: number;
    spawnRate?: number;
    texture: string;
    body: EnemyBodyData;
}
