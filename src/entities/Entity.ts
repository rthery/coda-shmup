import {Scene, Physics} from 'phaser';

export class Entity extends Physics.Arcade.Sprite {
    public arcadeBody: Physics.Arcade.Body;
    private components: IComponent[] = [];

    constructor(scene: Scene, x: number, y: number, texture: string, frame?: string) {
        super(scene, x, y, texture, frame);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.arcadeBody = this.body as Physics.Arcade.Body;
        this.arcadeBody.allowGravity = false;
        this.arcadeBody.setFriction(0, 0);
    }

    public addComponent<T extends IComponent>(component: T) {
        this.components.push(component);
    }

    public removeComponent<T extends IComponent>(component: T): boolean {
        const index = this.components.indexOf(component);
        if (index !== -1) {
            this.components.splice(index, 1);
            return true;
        }

        return false;
    }

    public getComponent<T extends IComponent>(componentType: new (...args: any[]) => T): T | undefined {
        return this.components.find(component => component instanceof componentType) as T;
    }

    public getComponents<T extends IComponent>(componentType: new (...args: any[]) => T): T[] {
        return this.components.filter(component => component instanceof componentType) as T[];
    }
}