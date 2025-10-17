import {Scene, Physics, GameObjects} from 'phaser';
import IComponent from "../components/IComponent.ts";

export default class Entity extends Physics.Arcade.Sprite {
    public readonly arcadeBody: Physics.Arcade.Body;
    private _components: IComponent[] = [];
    private _forwardDebugLine: GameObjects.Line;

    constructor(scene: Scene, x: number, y: number, texture: string, frame?: string) {
        super(scene, x, y, texture, frame);

        if (this.scene.game.config.physics.arcade?.debug) {
            this._forwardDebugLine = this.scene.add.line(this.x, this.y, 0, 0, 0, 32, 0xff00ff)
                .setOrigin(0, 0).setLineWidth(16, 4).setAlpha(0.6).setDepth(100);
        }

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

    preUpdate(_timeSinceLaunch: number, _deltaTime: number) {
        super.preUpdate(_timeSinceLaunch, _deltaTime);

        // Draw a debug line to show the entity forward direction
        if (this.scene.game.config.physics.arcade?.debug)
        {
            this._forwardDebugLine.setPosition(this.x, this.y)

            const forward: Phaser.Math.Vector2 = new Phaser.Math.Vector2(64, 0).rotate(this.rotation);
            this._forwardDebugLine.setTo(0, 0, forward.x, forward.y);

            // Maths way
            // this._forwardDebugLine.setTo(0, 0, Math.cos(this.rotation) * 64, Math.sin(this.rotation) * 64);
        }
    }
}