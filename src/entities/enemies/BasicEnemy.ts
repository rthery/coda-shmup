import Enemy from "../Enemy.ts";

export class BasicEnemy extends Enemy {
    init(bulletsGroup: Phaser.Physics.Arcade.Group) {
        super.init(bulletsGroup);
    }
}