import { GameObjects, Plugins, Physics, Scene } from "phaser";
import Health from "../components/Health.ts";
import Bullet from "../entities/Bullet.ts";
import Enemy from "../entities/Enemy.ts";
import Player from "../entities/Player.ts";
import GroupUtils from "../utils/GroupUtils.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import { MovingEnemy } from "../entities/enemies/MovingEnemy.ts";
import { BasicEnemy } from "../entities/enemies/BasicEnemy.ts";

export default class EntityManager extends Plugins.ScenePlugin {
  public static readonly PLUGIN_KEY: string = "EntityManager";
  public static readonly MAPPING_NAME: string = "entityManager";

  private readonly _enemyTypes = [
    { classType: BasicEnemy, frame: "ufoRed", dataKey: "basicEnemy" },
    { classType: MovingEnemy, frame: "movingEnemy", dataKey: "movingEnemy" }
  ]

  // noinspection JSUnusedGlobalSymbols
  private readonly bulletGroupConfig = {
    classType: Bullet,
    maxSize: 256,
    runChildUpdate: true,
    createCallback: (bullet: GameObjects.GameObject) => {
      (bullet as Bullet).init();
    },
  };

  private _player: Player;
  private _playerBullets: Physics.Arcade.Group;
  private _enemyGroups: Physics.Arcade.Group[];
  private _enemyBullets: Physics.Arcade.Group;

  constructor(scene: Scene, pluginManager: Plugins.PluginManager) {
    super(scene, pluginManager, EntityManager.PLUGIN_KEY);

    console.log("[EntityManager] Initialized");
  }

  destroy() {
    super.destroy();

    console.log("[EntityManager] Destroyed");
  }

  public initAndSpawnPlayer(): Player {
    this._playerBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
    GroupUtils.populate(64, this._playerBullets);

    this._player = new Player(
      this.scene!,
      this.scene!.cameras.main.centerX,
      this.scene!.cameras.main.height - 128,
    );
    this._player.init(this._playerBullets);

    console.log("[EntityManager] Player spawned");

    this.game!.events.emit(
      GameConstants.Events.PLAYER_SPAWNED_EVENT,
      this._player,
    );

    return this._player;
  }

  public initEnemies(): Physics.Arcade.Group[] {
    this._enemyBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
    GroupUtils.populate(256, this._enemyBullets);

    this._enemyGroups = this._enemyTypes.map((type) => 
      this.createEnemyGroup(type.classType, type.frame)
    );

    // Spawn enemies indefinitely
    this.scene!.time.addEvent({
      delay: 1500,
      callback: this.spawnEnemy,
      callbackScope: this,
      loop: true,
    });

    console.log("[EntityManager] Enemies initialized");

    return this._enemyGroups;
  }
  private createEnemyGroup(
    classType: typeof Enemy,
    frame: string,
  ): Physics.Arcade.Group {
    return this.scene!.physics.add.group({
      classType: classType,
      defaultKey: "sprites",
      defaultFrame: frame,
      createCallback: (enemy) => {
        (enemy as Enemy).init(this._enemyBullets);
      },
    });
  }

  public initGroupCollisions() {
    this.scene!.physics.add.overlap(
      this._playerBullets,
      this._enemyGroups,
      (bullet, enemy) => {
        this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

        (bullet as Bullet).disable();
        (enemy as Enemy)
          .getComponent(Health)
          ?.damage((bullet as Bullet).damage);
      },
    );

    this.scene!.physics.add.overlap(
      this._player,
      this._enemyBullets,
      (player, bullet) => {
        (bullet as Bullet).disable();
        (player as Player)
          .getComponent(Health)
          ?.damage((bullet as Bullet).damage);

        this.scene?.cameras.main.shake(100, 0.01);
      },
    );

    this.scene!.physics.add.overlap(
      this._player,
      this._enemyGroups,
      (player, enemy) => {
        this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

        const enemyHealth = (enemy as Enemy).getComponent(Health);
        enemyHealth?.damage(enemyHealth?.max);

        const playerHealth = (player as Player).getComponent(Health);
        playerHealth?.damage(1);

        this.scene?.cameras.main.shake(100, 0.03);
      },
    );

    console.log("[EntityManager] Group collisions initialized");
  }

  private spawnEnemy() {
    const total = this._enemyGroups.reduce(
      (sum, group) => sum + group.countActive(true),
      0,
    );
    if (total >= 5) {
      return;
    }

    const group = this.pickEnemyGroup();
    if(!group){
      return;
    }

    const enemy = group.get() as Enemy;
    if (!enemy) {
      return;
    }

    enemy.enable(
      Phaser.Math.Between(64, this.scene!.cameras.main.width - 64),
      0,
    );

    this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);

    console.log("[EntityManager] Enemy spawned");
  }

  private pickEnemyGroup(): Physics.Arcade.Group | undefined {
    const rates: number[] = this._enemyTypes.map((type) => this.scene!.cache.json.get('enemies')?.[type.dataKey]?.spawnRate ?? 1)
    let roll = Math.random() * rates.reduce((sum, rate) => sum + rate, 0);

    return this._enemyGroups.find((_, i) => (roll -= rates[i]) < 0);
  }
}
