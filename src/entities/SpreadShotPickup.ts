import {Scene} from "phaser";
import Entity from "./Entity.ts";

export default class SpreadShotPickup extends Entity {
    public constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'sprites', 'cofeemove');
        this.setScale(1.25);
        this.arcadeBody.setCircle(this.displayWidth * 0.4);
    }

    public enable(x: number, y: number) {
        this.enableBody(true, x, y, true, true);
    }

    public disable() {
        this.disableBody(true, true);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number) {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable();
            return;
        }

        this.y += 0.3 * deltaTime;
    }
}