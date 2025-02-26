import {Scene, Physics} from 'phaser';

export default class Entity extends Physics.Arcade.Sprite {
    public readonly arcadeBody: Physics.Arcade.Body;
    protected bullets: Physics.Arcade.Group;

    constructor(scene: Scene, x: number, y: number, texture: string, frame?: string) {
        super(scene, x, y, texture, frame);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.arcadeBody = this.body as Physics.Arcade.Body;
        this.arcadeBody.allowGravity = false;
        this.arcadeBody.setFriction(0, 0);
    }
}