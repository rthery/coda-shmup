import {Physics} from 'phaser';
import {BulletData} from "../gameData/BulletData.ts";
import Entity from "../entities/Entity.ts";
import Weapon from "./Weapon.ts";

const FULL_CIRCLE_DEG: number = 360;

export default class SpreadWeapon extends Weapon {
    private readonly _bulletCount: number;
    private readonly _spreadAngleDeg: number;

    constructor(bullets: Physics.Arcade.Group, bulletData: BulletData, bulletCount: number, spreadAngleDeg: number) {
        super(bullets, bulletData);

        this._bulletCount = bulletCount;
        this._spreadAngleDeg = spreadAngleDeg;
    }

    public override shoot(source: Entity) {
        if (!this.enabled)
            return;

        if (this._bulletCount <= 1) {
            super.shoot(source);
            return;
        }

        const isFullCircle = this._spreadAngleDeg >= FULL_CIRCLE_DEG;
        const stepDeg = isFullCircle
            ? this._spreadAngleDeg / this._bulletCount
            : this._spreadAngleDeg / (this._bulletCount - 1);
        const startDeg = isFullCircle ? 0 : -this._spreadAngleDeg / 2;

        for (let i = 0; i < this._bulletCount; i++) {
            this.spawnBullet(source, Phaser.Math.DegToRad(startDeg + i * stepDeg));
        }
    }
}
