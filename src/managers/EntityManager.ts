import {GameObjects, Plugins, Physics, Scene} from "phaser";
import Health from "../components/Health.ts";
import Bullet from "../entities/Bullet.ts";
import Enemy from "../entities/Enemy.ts";
import Player from "../entities/Player.ts";
import GroupUtils from "../utils/GroupUtils.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import { EnemyShipsData } from "../gameData/EnemyShipsData.ts";

export default class EntityManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'EntityManager';
    public static readonly MAPPING_NAME: string = 'entityManager';

    // noinspection JSUnusedGlobalSymbols
    private readonly bulletGroupConfig = {
        classType: Bullet,
        maxSize: 256,
        runChildUpdate: true,
        createCallback: (bullet: GameObjects.GameObject) => {
            (bullet as Bullet).init();
        }
    }

    private _player: Player;
    private _playerBullets: Physics.Arcade.Group;
    private _enemies: Physics.Arcade.Group;
    private _enemyBullets: Physics.Arcade.Group;
    private _specialEnemy: Physics.Arcade.Group;

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

        this._player = new Player(this.scene!, this.scene!.cameras.main.centerX, this.scene!.cameras.main.height - 128);
        this._player.init(this._playerBullets);

        console.log("[EntityManager] Player spawned");

        this.game!.events.emit(GameConstants.Events.PLAYER_SPAWNED_EVENT, this._player);

        return this._player;
    }

    public initEnemies(): Physics.Arcade.Group {
        const shipsData = this.scene!.cache.json.get('specialEnemy') as EnemyShipsData | undefined;
        this._enemyBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
        GroupUtils.populate(256, this._enemyBullets);

        this._enemies = this.scene!.physics.add.group({
            classType: Enemy,
            defaultKey: 'sprites',
            defaultFrame: shipsData?.enemies?.texture ?? 'ufoRed',
            createCallback: (enemy) => {
                (enemy as Enemy).init(this._enemyBullets, shipsData?.enemies);
            }
        });

        this._specialEnemy = this.scene!.physics.add.group({
            classType: Enemy,
            defaultKey: 'sprites',
            defaultFrame: shipsData?.specialEnemy?.texture ?? 'merluche',
            createCallback: (enemy) => {
                (enemy as Enemy).init(this._enemyBullets, shipsData?.specialEnemy);
            }
        });

        // Spawn normal enemies every 1500 ms
        this.scene!.time.addEvent({
            delay: 1500,
            callback: this.spawnNormalEnemy,
            callbackScope: this,
            loop: true
        });

        // Spawn specialEnemy using spawnRate from JSON (default: 10000 ms)
        const specialEnemySpawnRate = shipsData?.specialEnemy?.spawnRate ?? 10000;
        this.scene!.time.addEvent({
            delay: specialEnemySpawnRate,
            callback: this.spawnSpecialEnemy,
            callbackScope: this,
            loop: true
        });

        console.log("[EntityManager] Enemies initialized");

        return this._enemies;
    }

    private spawnNormalEnemy() {
        if (this._enemies.countActive(true) < 5) {
            const enemy = this._enemies.get() as Enemy | null;
            if (enemy) {
                enemy.enable(Phaser.Math.Between(64, this.scene!.cameras.main.width - 64), 0);
                this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);
            }
        }
    }

    private spawnSpecialEnemy() {
        const centerX = this.scene!.cameras.main.centerX;

        if (this._specialEnemy.countActive(true) < 1) {
            const specialEnemy = this._specialEnemy.get() as Enemy | null;
            if (specialEnemy) {
                specialEnemy.enable(centerX, 0);
                this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, specialEnemy);
            }
        }
    }

    public initGroupCollisions() {
        this.scene!.registry.events.on(
            'changedata-' + RegistryConstants.Keys.PLAYER_SCORE,
            (_parent: unknown, value: number) => {
                if (value > 0 && value % 10 === 0) {
                    this._player?.getComponent(Health)?.heal(1);
                }
            }
        );

        this.scene!.physics.add.overlap(this._playerBullets, this._enemies, (bullet, enemy) => {
            this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

            (bullet as Bullet).disable();
            (enemy as Enemy).getComponent(Health)?.damage((bullet as Bullet).damage);
        });

        this.scene!.physics.add.overlap(this._playerBullets, this._specialEnemy, (bullet, enemy) => {
            this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

            (bullet as Bullet).disable();
            (enemy as Enemy).getComponent(Health)?.damage((bullet as Bullet).damage);
        });

        this.scene!.physics.add.overlap(this._player, this._enemyBullets, (player, bullet) => {
            (bullet as Bullet).disable();
            (player as Player).getComponent(Health)?.damage((bullet as Bullet).damage);

            this.scene?.cameras.main.shake(100, 0.01);
        });

        this.scene!.physics.add.overlap(this._player, this._enemies, (player, enemy) => {
            this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

            const enemyHealth = (enemy as Enemy).getComponent(Health);
            enemyHealth?.damage(enemyHealth?.max);

            const playerHealth = (player as Player).getComponent(Health);
            playerHealth?.damage(1);

            this.scene?.cameras.main.shake(100, 0.03);
        });

        this.scene!.physics.add.overlap(this._player, this._specialEnemy, (player, enemy) => {
            this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

            const enemyHealth = (enemy as Enemy).getComponent(Health);
            enemyHealth?.damage(enemyHealth?.max);

            const playerHealth = (player as Player).getComponent(Health);
            playerHealth?.damage(1);

            this.scene?.cameras.main.shake(100, 0.03);
        });

        console.log("[EntityManager] Group collisions initialized");
    }
}
