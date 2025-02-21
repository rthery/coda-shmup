export class Bullet extends Phaser.GameObjects.Rectangle {
    private arcadeBody: Phaser.Physics.Arcade.Body;

    public init() {
        this.scene.physics.add.existing(this);

        this.arcadeBody = this.body as Phaser.Physics.Arcade.Body;
        this.arcadeBody.allowGravity = false;
        this.arcadeBody.setFriction(0, 0);
    }

    public enable(x: number, y: number, width: number, height: number, color: number, initialVelocityY: number) {
        this.setPosition(x, y);
        this.setSize(width, height);
        this.setOrigin(0.5);
        this.setFillStyle(color);

        this.scene.physics.world.add(this.arcadeBody);
        this.setActive(true);
        this.setVisible(true);

        this.arcadeBody.setSize(width, height);
        this.arcadeBody.setVelocityY(initialVelocityY);
    }

    public disable() {
        this.scene.physics.world.remove(this.arcadeBody);
        this.setActive(false);
        this.setVisible(false);
    }

    update(timeSinceLaunch: number, deltaTime: number) {
        super.update(timeSinceLaunch, deltaTime);

        if (this.y > this.scene.cameras.main.height + this.displayHeight
            || this.y < -this.displayHeight) {
            this.disable();
        }
    }
}