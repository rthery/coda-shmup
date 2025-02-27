import {Player} from "../../entities/Player.ts";
import {Bullet} from "../../entities/Bullet.ts";
import GroupUtils from "../../utils/GroupUtils.ts";
import {Health} from "../../components/Health.ts";
import {Enemy} from "../../entities/Enemy.ts";
import {GameDataKeys} from "../../GameDataKeys.ts";

export class EntityManager extends Phaser.Events.EventEmitter {
    // noinspection JSUnusedGlobalSymbols
    private readonly bulletGroupConfig = {
        classType: Bullet,
        maxSize: 256,
        runChildUpdate: true,
        createCallback: (bullet: Phaser.GameObjects.GameObject) => {
            (bullet as Bullet).init();
        }
    }

    private readonly _scene: Phaser.Scene;

    private _player: Player;
    private _playerBullets: Phaser.Physics.Arcade.Group;
    private _enemies: Phaser.Physics.Arcade.Group;
    private _enemyBullets: Phaser.Physics.Arcade.Group;

    public get player(): Player {
        return this._player;
    }

    public get enemies(): Phaser.Physics.Arcade.Group {
        return this._enemies;
    }

    constructor(scene: Phaser.Scene) {
        super();

        this._scene = scene;
    }

    public addPlayer() {
        this._playerBullets = this._scene.physics.add.group(this.bulletGroupConfig);
        GroupUtils.populate(64, this._playerBullets);

        this._player = new Player(this._scene, this._scene.cameras.main.centerX, this._scene.cameras.main.height - 128, 'sprites');
        this._player.init(this._playerBullets);
    }

    public addEnemies() {
        this._enemyBullets = this._scene.physics.add.group(this.bulletGroupConfig);
        GroupUtils.populate(256, this._enemyBullets);

        this._enemies = this._scene.physics.add.group({
            classType: Enemy,
            defaultKey: 'sprites',
            defaultFrame: 'ufoRed.png',
            createCallback: (enemy) => {
                (enemy as Enemy).init(this._enemyBullets);
            }
        });

        // Spawn enemies indefinitely
        this._scene.time.addEvent({
            delay: 1500,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
    }

    public addGroupCollisions() {
        // Add collisions detection
        this._scene.physics.add.overlap(this._playerBullets, this._enemies, (bullet, enemy) => {
            (bullet as Bullet).disable();
            (enemy as Enemy).getComponent(Health)?.inc(-1);

            this._scene.registry.inc(GameDataKeys.PLAYER_SCORE, 1);
        }, undefined, this);
        this._scene.physics.add.overlap(this._player, this._enemyBullets, (player, bullet) => {
            (bullet as Bullet).disable();
            (player as Player).getComponent(Health)?.inc(-1);
        }, undefined, this);
        this._scene.physics.add.overlap(this._player, this._enemies, (player, enemy) => {
            const enemyHealth = (enemy as Enemy).getComponent(Health);
            enemyHealth?.inc(-enemyHealth?.getMax());

            const playerHealth = (player as Player).getComponent(Health);
            playerHealth?.inc(-1);
        });
    }

    private spawnEnemy() {
        if (this._enemies.countActive(true) >= 5) {
            return;
        }

        const enemy = this._enemies.get() as Enemy;
        if (!enemy) {
            return;
        }

        enemy.enable(Phaser.Math.Between(64, this._scene.cameras.main.width - 64), 0);

        this.emit('enemySpawned', enemy);
    }
}