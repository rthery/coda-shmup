import Entity from "../entities/Entity";
import Player from "../entities/Player";

interface IBuff {
    apply(): void;
    remove(): void;
}

export default class SpreadShotBuff implements IBuff {
    public static readonly BUFF_KEY: string = 'SpreadShotBuff';
    public static readonly BUFF_DURATION: number = 5000; // 5 seconds

    private _player: Player;
    private _originalShootMethod: (source: Entity) => void;

    constructor(player: Player) {
        this._player = player;
        this._originalShootMethod = player.weapon.shoot.bind(player.weapon);
    }

    public apply(): void {
        console.log("[SpreadShotBuff] Applying spread shot buff");
        this._player.weapon.shoot = (source: Entity) => {
            const spreadAngle = Phaser.Math.DegToRad(30); // 30 degrees spread
            const numBullets = 5; // Number of bullets in the spread
            this._player.weapon.shootSpread(source, spreadAngle, numBullets);
        };

        const scene = this._player.scene;
        if (scene) {
            scene.time.delayedCall(SpreadShotBuff.BUFF_DURATION, () => {
                this.remove();
            });
        }
    }

    public remove(): void {
        console.log("[SpreadShotBuff] Removing spread shot buff");
        this._player.weapon.shoot = this._originalShootMethod;
    }
}