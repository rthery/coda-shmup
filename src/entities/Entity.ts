import {Scene, Physics, GameObjects} from 'phaser';

export class Entity extends Physics.Arcade.Sprite {
    public arcadeBody: Physics.Arcade.Body;
    private components: IComponent[] = [];

    private forwardDebugLine: GameObjects.Line;

    constructor(scene: Scene, x: number, y: number, texture: string, frame?: string) {
        super(scene, x, y, texture, frame);

        if (this.scene.game.config.physics.arcade?.debug) {
            this.forwardDebugLine = this.scene.add.line(this.x, this.y, 0, 0, 0, 32, 0xff00ff).setOrigin(0, 0).setLineWidth(2);
        }

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

    preUpdate(_timeSinceLaunch: number, _deltaTime: number) {
        super.preUpdate(_timeSinceLaunch, _deltaTime);

        // Draw a debug line to show the entity forward direction
        if (this.scene.game.config.physics.arcade?.debug)
        {
            this.forwardDebugLine.x = this.x;
            this.forwardDebugLine.y = this.y;
            this.forwardDebugLine.setTo(0, 0, Math.cos(this.rotation) * 64, Math.sin(this.rotation) * 64);
        }
    }
}