import {Scene, Physics} from 'phaser';
import IComponent from "../components/IComponent.ts";

export default class Entity extends Physics.Arcade.Sprite {
    public readonly arcadeBody: Physics.Arcade.Body;
    private _components: IComponent[] = [];

    constructor(scene: Scene, x: number, y: number, texture: string, frame?: string) {
        super(scene, x, y, texture, frame);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.arcadeBody = this.body as Physics.Arcade.Body;
        this.arcadeBody.allowGravity = false;
        this.arcadeBody.setFriction(0, 0);
    }

    public addComponent(component: IComponent) {
        this._components.push(component);
    }

    public removeComponent(component: IComponent): boolean {
        const index = this._components.indexOf(component);
        if (index !== -1) {
            this._components.splice(index, 1);
            return true;
        }

        return false;
    }

    public getComponent<T extends IComponent>(componentType: new (...args: any[]) => T): T | undefined {
        return this._components.find(component => component instanceof componentType) as T;
    }
}