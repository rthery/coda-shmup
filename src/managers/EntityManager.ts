import {GameObjects, Plugins, Physics, Scene} from "phaser";
import Health from "../components/Health.ts";
import Bullet from "../entities/Bullet.ts";
import Enemy from "../entities/Enemy.ts";
import Player from "../entities/Player.ts";
import XpGem from "../entities/XpGem.ts";
import Experience from "../components/Experience.ts";
import GroupUtils from "../utils/GroupUtils.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import {BulletFxData} from "../gameData/BulletData.ts";

export default class EntityManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'EntityManager';
    public static readonly MAPPING_NAME: string = 'entityManager';

    private static readonly ENTITIES_DEPTHS = {
        EFFECTS_TOP: 600,
        PLAYER: 100,
        PLAYER_BULLETS: 90,
        ENEMIES: 80,
        XP_GEMS: 75,
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
    private _xpGems: Physics.Arcade.Group;
    private _xpTrailFX: GameObjects.Particles.ParticleEmitter;
    private readonly _spawnOffset: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private _explosionFireFX: GameObjects.Particles.ParticleEmitter;
    private _explosionSmokeFX: GameObjects.Particles.ParticleEmitter;
    private _laserFlashFX: GameObjects.Particles.ParticleEmitter;
    private _laserSparksFX: GameObjects.Particles.ParticleEmitter;
    private _laserGlowFX: GameObjects.Particles.ParticleEmitter;
    private _collisionFlashFX: GameObjects.Particles.ParticleEmitter;
    private _collisionShockwaveFX: GameObjects.Particles.ParticleEmitter;

    constructor(scene: Scene, pluginManager: Plugins.PluginManager) {
        super(scene, pluginManager, EntityManager.PLUGIN_KEY);

        console.log("[EntityManager] Initialized");
    }

    destroy() {
        super.destroy();

        console.log("[EntityManager] Destroyed");
    }

    public initAndSpawnPlayer(onIntroComplete: () => void): Player {
        this._playerBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
        this._playerBullets.setDepth(EntityManager.ENTITIES_DEPTHS.PLAYER_BULLETS);
        GroupUtils.populate(64, this._playerBullets);

        this._player = new Player(this.scene!, 0, 0);
        this._player.setDepth(EntityManager.ENTITIES_DEPTHS.PLAYER);
        this._player.init(this._playerBullets);
        // Fly in from below the screen to the arena center
        const playerStartX: number = GameConstants.ARENA_WIDTH / 2;
        const playerEndY: number = GameConstants.ARENA_HEIGHT / 2;
        this._player.setPosition(playerStartX, playerEndY + this.scene!.cameras.main.height / 2 + this._player.height);
        this._player.setAngle(-90);
        this.scene!.tweens.add({
            targets: this._player,
            y: playerEndY,
            duration: GameConstants.START_DELAY,
            ease: Phaser.Math.Easing.Quadratic.Out,
            onComplete: onIntroComplete
        });

        // Create the enemy pools now, not at the end of the intro, to avoid a freeze
        this.initXpGems();
        this.initEnemies();
        this.initGroupCollisions();
        this.initParticleEmitters();

        // The game over screen waits for this explosion
        this._player.getComponent(Health)?.once(Health.DEATH_START_EVENT, () => {
            this.spawnExplosion(this._player.x, this._player.y);
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
            defaultFrame: 'ufoRed',
            createCallback: (enemy) => {
                (enemy as Enemy).init(this._enemyBullets, this._player);
            }
        });
        this._enemies.setDepth(EntityManager.ENTITIES_DEPTHS.ENEMIES);

        this._player.setTargets(this._enemies);

        // Spawn enemies indefinitely, the first one when the player intro is over
        this.scene!.time.addEvent({
            delay: GameConstants.START_DELAY,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        console.log("[EntityManager] Enemies initialized");

        return this._enemies;
    }

    public initXpGems(): Physics.Arcade.Group {
        // Shared by all gems, created before them
        this._xpTrailFX = this.scene!.add.particles(0, 0, 'shapes', {
            maxParticles: 1000,
            frame: 'circle_05',
            speed: 0,
            scale: { start: 0.35, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: 0xffcc00,
            blendMode: 'ADD',
            lifespan: 200,
            emitting: false
        }).setDepth(EntityManager.ENTITIES_DEPTHS.XP_GEMS - 1);

        this._xpGems = this.scene!.physics.add.group({
            classType: XpGem,
            maxSize: 256,
            runChildUpdate: true,
            createCallback: (gem) => {
                (gem as XpGem).init(this._player, this._xpTrailFX);
            }
        });
        this._xpGems.setDepth(EntityManager.ENTITIES_DEPTHS.XP_GEMS);
        GroupUtils.populate(64, this._xpGems);

        console.log("[EntityManager] XP gems initialized");

        return this._xpGems;
    }

    public initGroupCollisions() {
        // Push enemies apart so they don't stack into a single blob
        this.scene!.physics.add.collider(this._enemies, this._enemies);

        this.scene!.physics.add.overlap(this._playerBullets, this._enemies, (bullet, enemy) => {
            if (!(bullet as Bullet).registerHit(enemy as Enemy))
                return;

            this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

            this.spawnLaserImpact((bullet as Bullet).x, (bullet as Bullet).y, (bullet as Bullet).bulletData.fx);

            if (!(bullet as Bullet).pierce())
                (bullet as Bullet).disable();
            (enemy as Enemy).getComponent(Health)?.damage((bullet as Bullet).bulletData.damage);
        });

        this.scene!.physics.add.overlap(this._player, this._enemyBullets, (player, bullet) => {
            this.spawnLaserImpact((bullet as Bullet).x, (bullet as Bullet).y, (bullet as Bullet).bulletData.fx);

            (bullet as Bullet).disable();
            (player as Player).getComponent(Health)?.damage((bullet as Bullet).bulletData.damage);

            this.scene?.cameras.main.shake(100, 0.01);
        });

        this.scene!.physics.add.overlap(this._player, this._enemies, (player, enemy) => {
            this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

            this.spawnCollisionImpact((enemy as Enemy).x, (enemy as Enemy).y);

            const enemyHealth = (enemy as Enemy).getComponent(Health);
            enemyHealth?.damage(enemyHealth?.max);

            const playerHealth = (player as Player).getComponent(Health);
            playerHealth?.damage(1);

            this.scene?.cameras.main.shake(100, 0.03);
        });

        this.scene!.physics.add.overlap(this._player, this._xpGems, (player, gem) => {
            (gem as XpGem).disable();
            (player as Player).getComponent(Experience)?.add((gem as XpGem).value);
        });

        console.log("[EntityManager] Group collisions initialized");
    }

    public initParticleEmitters() {
        this._initExplosionEmitters();
        this._initLaserEmitters();
        this._initCollisionEmitters();
    }

    private _initExplosionEmitters() {
        this._explosionFireFX = this.scene!.add.particles(0, 0, 'shapes', {
            maxParticles: 1000,
            frame: ['light_03'],
            lifespan: { min: 300, max: 600 },
            speed: { min: 20, max: 80 },
            angle: { min: 0, max: 360 },
            scale: { start: 4, end: 0, random: true },
            color: [0xff2200, 0xff6600, 0xffaa00, 0xffdd00, 0xffffff, 0x000000],
            colorEase: 'Power2',
            blendMode: 'ADD',
            x: { random: [-24, 24] },
            y: { random: [-24, 24] },
            timeScale: 1.5,
            emitting: false
        }).setDepth(EntityManager.ENTITIES_DEPTHS.EFFECTS);

        this._explosionSmokeFX = this.scene!.add.particles(0, 0, 'shapes', {
            maxParticles: 1000,
            frame: ['smoke_11'],
            lifespan: { min: 800, max: 1400 },
            accelerationX: { random: [-2048, 2048], ease: 'Power3' },
            accelerationY: { random: [-2048, -60], ease: 'Power3' },
            alpha: { start: 0.4, end: 0, ease: 'Power2' },
            scale: { random: [0.3, 2] },
            color: [0xcccccc, 0x888888, 0x444444, 0x111111],
            colorEase: 'Power1',
            blendMode: 'ADD',
            x: { random: [-16, 16] },
            y: { random: [-16, 16] },
            timeScale: 1.2,
            delay: 100,
            emitting: false
        }).setDepth(EntityManager.ENTITIES_DEPTHS.EFFECTS);
    }

    private _initLaserEmitters() {
        this._laserFlashFX = this.scene!.add.particles(0, 0, 'shapes', {
            maxParticles: 1000,
            frame: 'flare_01',
            speed: 0,
            scale: { start: 5, end: 0 },
            lifespan: 300,
            emitting: false
        }).setDepth(EntityManager.ENTITIES_DEPTHS.EFFECTS_TOP);

        this._laserSparksFX = this.scene!.add.particles(0, 0, 'shapes', {
            maxParticles: 1000,
            frame: 'spark_01',
            speed: { min: 100, max: 280 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.4, end: 0 },
            lifespan: { min: 200, max: 400 },
            emitting: false
        }).setDepth(EntityManager.ENTITIES_DEPTHS.EFFECTS_TOP);

        this._laserGlowFX = this.scene!.add.particles(0, 0, 'shapes', {
            maxParticles: 1000,
            frame: 'circle_05',
            speed: { min: 30, max: 80 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.1, end: 0.6 },
            lifespan: { min: 250, max: 450 },
            emitting: false
        }).setDepth(EntityManager.ENTITIES_DEPTHS.EFFECTS_TOP);
    }

    private _initCollisionEmitters() {
        this._collisionFlashFX = this.scene!.add.particles(0, 0, 'shapes', {
            maxParticles: 1000,
            frame: 'flare_01',
            speed: 0,
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: 0xffffff,
            lifespan: 100,
            emitting: false
        }).setDepth(EntityManager.ENTITIES_DEPTHS.EFFECTS_TOP);

        this._collisionShockwaveFX = this.scene!.add.particles(0, 0, 'shapes', {
            maxParticles: 1000,
            frame: 'circle_05',
            speed: { min: 40, max: 100 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.2, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: 0xffffff,
            lifespan: 200,
            emitting: false
        }).setDepth(EntityManager.ENTITIES_DEPTHS.EFFECTS_TOP);
    }

    public spawnLaserImpact(x: number, y: number, fx: BulletFxData) {
        this._laserFlashFX.particleTint = fx.flashTint;
        this._laserFlashFX.explode(1, x, y);

        this._laserSparksFX.ops.tint.loadConfig({ tint: fx.sparkTints });
        this._laserSparksFX.explode(16, x, y);

        this._laserGlowFX.ops.tint.loadConfig({ tint: fx.glowTints });
        this._laserGlowFX.explode(8, x, y);
    }

    public spawnCollisionImpact(x: number, y: number) {
        this._collisionFlashFX.explode(1, x, y);
        this._collisionShockwaveFX.explode(6, x, y);
    }

    public spawnExplosion(x: number, y: number) {
        this._explosionFireFX.explode(8, x, y);
        this._explosionSmokeFX.explode(12, x, y);
    }

    public spawnXpGem(x: number, y: number) {
        // No drop when the pool is full
        (this._xpGems.get() as XpGem | null)?.enable(x, y);
    }

    private spawnEnemy() {
        if (this._enemies.countActive(true) >= 50) {
            return;
        }

        const enemy = this._enemies.get() as Enemy;
        if (!enemy) {
            return;
        }

        // Spawn on a circle around the camera view, a bit further than its corners: always outside the screen.
        // Center on the view, not the player: at the arena edges the camera stops and the player is off-center
        const view = this.scene!.cameras.main.worldView;
        const spawnRadius = Phaser.Math.Distance.Between(view.centerX, view.centerY, view.right, view.top) + 128;
        Phaser.Math.RandomXY(this._spawnOffset, spawnRadius);
        enemy.enable(view.centerX + this._spawnOffset.x, view.centerY + this._spawnOffset.y);

        this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);

        enemy.getComponent(Health)?.once(Health.DEATH_START_EVENT, () => {
            this.spawnExplosion(enemy.x, enemy.y);
            this.spawnXpGem(enemy.x, enemy.y);
        });

        console.log("[EntityManager] Enemy spawned");
    }
}