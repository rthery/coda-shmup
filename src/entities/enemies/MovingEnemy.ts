import Enemy from "../Enemy.ts";
import Movement from "../../components/Movement.ts";
import { MovingEnemyData } from "../../gameData/MovingEnemyData.ts";

export class MovingEnemy extends Enemy {
  private _direction: number = 1;
  private _horizontalFactor: number;
  private _offset: number = 65;

  init(bulletsGroup: Phaser.Physics.Arcade.Group) {
    const movingEnemyData = this.scene.cache.json.get('enemies').movingEnemy as MovingEnemyData;

    this._bulletData.shots = movingEnemyData.spreadShot.shots;
    this._bulletData.angle = movingEnemyData.spreadShot.angle;
    this._horizontalFactor = movingEnemyData.horizontalSpeed;

    this._speed = 0.15;
    super.init(bulletsGroup);
  }
  preUpdate(timeSinceLaunch: number, deltaTime: number) {
    super.preUpdate(timeSinceLaunch, deltaTime);

    // Destroy entities when out of screen
    if (this.y > this.scene.cameras.main.height + this.displayHeight) {
      this.disable();
    }

    if (this.x >= this.scene.cameras.main.width - this._offset) {
      this._direction = -1;
    } else if (this.x <= this._offset) {
      this._direction = 1;
    }

    this.getComponent(Movement)?.moveHorizontally(
      this,
      deltaTime * this._direction * this._horizontalFactor,
    );
  }
}
