import {GameObjects, Plugins, Physics, Scene} from "phaser";
import Health from "../components/Health.ts";
import Bullet from "../entities/Bullet.ts";
import Enemy from "../entities/Enemy.ts";
import Player from "../entities/Player.ts";
import GroupUtils from "../utils/GroupUtils.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class EntityManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'EntityManager';
    public static readonly MAPPING_NAME: string = 'entityManager';

    private static readonly ENTITIES_DEPTHS = {
        PLAYER: 100,
        PLAYER_BULLETS: 90,
        ENEMIES: 80,
        ENEMY_BULLETS: 70,
        EFFECTS: 60
    }

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
    private _explosionFX: GameObjects.Particles.ParticleEmitter;

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
        this._playerBullets.setDepth(EntityManager.ENTITIES_DEPTHS.PLAYER_BULLETS);
        GroupUtils.populate(64, this._playerBullets);

        this._player = new Player(this.scene!, 0, 0);
        this._player.setDepth(EntityManager.ENTITIES_DEPTHS.PLAYER);
        this._player.init(this._playerBullets);
        const playerStartX: number = this.scene!.cameras.main.centerX;
        const playerStartY: number = this.scene!.cameras.main.height + this._player.height;
        this._player.setPosition(playerStartX, playerStartY);
        this.scene!.tweens.add({
            targets: this._player,
            y: this.scene!.cameras.main.height - 128,
            duration: 500,
            ease: Phaser.Math.Easing.Quadratic.Out,
            onComplete: () => {
                this.initEnemies();
                this.initGroupCollisions();
            }
        });

        console.log("[EntityManager] Player spawned");

        this.game!.events.emit(GameConstants.Events.PLAYER_SPAWNED_EVENT, this._player);

        return this._player;
    }

    public initEnemies(): Physics.Arcade.Group {
        this._enemyBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
        this._enemyBullets.setDepth(EntityManager.ENTITIES_DEPTHS.ENEMY_BULLETS);
        GroupUtils.populate(256, this._enemyBullets);

        this._enemies = this.scene!.physics.add.group({
            classType: Enemy,
            defaultKey: 'sprites',
            defaultFrame: 'ufoRed.png',
            createCallback: (enemy) => {
                (enemy as Enemy).init(this._enemyBullets);
            }
        });
        this._enemies.setDepth(EntityManager.ENTITIES_DEPTHS.ENEMIES);

        // Spawn enemies indefinitely
        this.scene!.time.addEvent({
            delay: 1500,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        const explosionParticlesAcceleration = 2048;
        this._explosionFX = this.scene!.add.particles(0, 0, 'shapes', {
            frame: ['smoke_11'],
            lifespan: 600,
            accelerationX: {random: [-explosionParticlesAcceleration, explosionParticlesAcceleration], ease: 'Power3'},
            accelerationY: {random: [-explosionParticlesAcceleration, -100], ease: 'Power3'},
            alpha: {start: 1, end: 0, ease: 'Power1'},
            scale: {random: [0.1, 2]},
            color: [0x90A4AE],
            blendMode: 'ADD',
            timeScale: 1.5,
            emitting: false
        })
        this._explosionFX.setDepth(EntityManager.ENTITIES_DEPTHS.EFFECTS);

        console.log("[EntityManager] Enemies initialized");

        return this._enemies;
    }

    public initGroupCollisions() {
        this.scene!.physics.add.overlap(this._playerBullets, this._enemies, (bullet, enemy) => {
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

        console.log("[EntityManager] Group collisions initialized");
    }

    private spawnEnemy() {
        if (this._enemies.countActive(true) >= 5) {
            return;
        }

        const enemy = this._enemies.get() as Enemy;
        if (!enemy) {
            return;
        }

        enemy.enable(Phaser.Math.Between(64, this.scene!.cameras.main.width - 64), 0);

        this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);

        enemy.getComponent(Health)?.once(Health.DEATH_START_EVENT, () => {
            this._explosionFX.explode(12, enemy.x, enemy.y);
        })

        console.log("[EntityManager] Enemy spawned");
    }
}