import {GameObjects, Plugins, Physics, Scene} from "phaser";
import Health from "../components/Health.ts";
import Bullet from "../entities/Bullet.ts";
import Enemy from "../entities/Enemy.ts";
import Player from "../entities/Player.ts";
import XpGem from "../entities/XpGem.ts";
import Experience from "../components/Experience.ts";
import Thrusters from "../components/Thrusters.ts";
import GroupUtils from "../utils/GroupUtils.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";
import DifficultyCurve from "../utils/DifficultyCurve.ts";
import type {DifficultyData} from "../gameData/DifficultyData.ts";
import {BulletFxData} from "../gameData/BulletData.ts";
import Sfx from "../audio/Sfx.ts";

export default class EntityManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'EntityManager';
    public static readonly MAPPING_NAME: string = 'entityManager';

    private static readonly XP_GEM_SCATTER_MIN_RADIUS: number = 24;
    private static readonly XP_GEM_SCATTER_MAX_RADIUS: number = 56;
    private static readonly DAMAGE_NUMBER_RISE: number = 70;
    private static readonly DAMAGE_NUMBER_DURATION: number = 600;
    private static readonly DAMAGE_NUMBER_JITTER: number = 16;
    private static readonly PLAYER_EXPLOSION_SIZE: number = 2;
    // Extra explosion per combo level above X1
    private static readonly EXPLOSION_PER_COMBO: number = 0.5;

    private static readonly ENTITIES_DEPTHS = {
        EFFECTS_TOP: 600,
        PLAYER: 100,
        PLAYER_BULLETS: 90,
        ENEMIES: 80,
        XP_GEMS: 75,
        ENEMY_BULLETS: 70,
        EFFECTS: 60
    }

    // Group.setDepth only reaches the children already created: each child gets its depth when created instead
    private bulletGroupConfig(depth: number, trailFX: GameObjects.Particles.ParticleEmitter | null = null) {
        return {
            classType: Bullet,
            maxSize: 256,
            runChildUpdate: true,
            createCallback: (bullet: GameObjects.GameObject) => {
                (bullet as Bullet).init(trailFX);
                (bullet as Bullet).setDepth(depth);
            }
        };
    }

    // FAST LASERS: cyan dots behind the player's bolts, created before the bullets that use them
    private createLaserTrailFX(): GameObjects.Particles.ParticleEmitter {
        return this.scene!.add.particles(0, 0, 'shapes', {
            maxParticles: 2000,
            frame: 'circle_05',
            speed: 0,
            scale: {start: 0.3, end: 0},
            alpha: {start: 0.7, end: 0},
            tint: 0x00ccff,
            blendMode: 'ADD',
            lifespan: 100,
            emitting: false
        }).setDepth(EntityManager.ENTITIES_DEPTHS.PLAYER_BULLETS - 1);
    }

    private _player: Player;
    private _playerBullets: Physics.Arcade.Group;
    private _enemies: Physics.Arcade.Group;
    private _enemyBullets: Physics.Arcade.Group;
    private _xpGems: Physics.Arcade.Group;
    private _xpTrailFX: GameObjects.Particles.ParticleEmitter;
    private readonly _spawnOffset: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _xpGemScatter: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private _difficulty: DifficultyCurve;
    private _explosionFireFX: GameObjects.Particles.ParticleEmitter;
    private _damageNumbers: GameObjects.Group;
    private _pierceAfterimages: GameObjects.Group;
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
        this._playerBullets = this.scene!.physics.add.group(
            this.bulletGroupConfig(EntityManager.ENTITIES_DEPTHS.PLAYER_BULLETS, this.createLaserTrailFX()));
        GroupUtils.populate(64, this._playerBullets);

        this._player = new Player(this.scene!, 0, 0);
        this._player.setDepth(EntityManager.ENTITIES_DEPTHS.PLAYER);
        this._player.init(this._playerBullets);
        // Fly in from below the screen to the arena center
        const playerStartX: number = GameConstants.ARENA_WIDTH / 2;
        const playerEndY: number = GameConstants.ARENA_HEIGHT / 2;
        this._player.setPosition(playerStartX, playerEndY + this.scene!.cameras.main.height / 2 + this._player.height);
        this._player.setAngle(-90);
        this._player.getComponent(Thrusters)?.setBoost(true);
        this.scene!.tweens.add({
            targets: this._player,
            y: playerEndY,
            duration: GameConstants.START_DELAY,
            ease: Phaser.Math.Easing.Quadratic.Out,
            onComplete: () => {
                this._player.getComponent(Thrusters)?.setBoost(false);
                onIntroComplete();
            }
        });

        // Create the enemy pools now, not at the end of the intro, to avoid a freeze
        this.initXpGems();
        this.initEnemies();
        this.initGroupCollisions();
        this.initParticleEmitters();

        // The game over screen waits for this explosion
        this._player.getComponent(Health)?.once(Health.DEATH_START_EVENT, () => {
            this.spawnExplosion(this._player.x, this._player.y, EntityManager.PLAYER_EXPLOSION_SIZE);
        });

        console.log("[EntityManager] Player spawned");

        this.game!.events.emit(GameConstants.Events.PLAYER_SPAWNED_EVENT, this._player);

        return this._player;
    }

    public initEnemies(): Physics.Arcade.Group {
        this._enemyBullets = this.scene!.physics.add.group(
            this.bulletGroupConfig(EntityManager.ENTITIES_DEPTHS.ENEMY_BULLETS));
        GroupUtils.populate(256, this._enemyBullets);

        this._enemies = this.scene!.physics.add.group({
            classType: Enemy,
            defaultKey: 'sprites',
            defaultFrame: 'ufoRed',
            createCallback: (enemy) => {
                (enemy as Enemy).init(this._enemyBullets, this._player);
                (enemy as Enemy).setDepth(EntityManager.ENTITIES_DEPTHS.ENEMIES);
            }
        });

        this._player.setTargets(this._enemies);

        // Spawn enemies indefinitely, faster over time, the first one when the player intro is over
        this._difficulty = new DifficultyCurve(this.scene!.cache.json.get('difficulty') as DifficultyData);
        this.scene!.time.delayedCall(GameConstants.START_DELAY, this.spawnEnemy, [], this);

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
                (gem as XpGem).setDepth(EntityManager.ENTITIES_DEPTHS.XP_GEMS);
            }
        });
        GroupUtils.populate(128, this._xpGems);
        this._player.setXpGems(this._xpGems);

        console.log("[EntityManager] XP gems initialized");

        return this._xpGems;
    }

    public initGroupCollisions() {
        // Push enemies apart so they don't stack into a single blob
        this.scene!.physics.add.collider(this._enemies, this._enemies);

        this.scene!.physics.add.overlap(this._playerBullets, this._enemies, (bullet, enemy) => {
            if (!(bullet as Bullet).registerHit(enemy as Enemy))
                return;

            this.spawnLaserImpact((bullet as Bullet).x, (bullet as Bullet).y, (bullet as Bullet).bulletData.fx);

            const bulletVelocity = (bullet as Bullet).body!.velocity;
            (enemy as Enemy).playHit(bulletVelocity.x, bulletVelocity.y);
            if ((bullet as Bullet).pierce())
                this.spawnPierceAfterimages(bullet as Bullet);
            else
                (bullet as Bullet).disable();

            const damage: number = (bullet as Bullet).bulletData.damage;
            const enemyHealth = (enemy as Enemy).getComponent(Health);
            // One-shot enemies would flood the screen with 1s
            if (enemyHealth && enemyHealth.max > 1)
                this.spawnDamageNumber((enemy as Enemy).x, (enemy as Enemy).y, damage, enemyHealth.current <= damage);
            // The kill plays its explosion instead
            if (enemyHealth && enemyHealth.current > damage)
                Sfx.play(this.scene!, 'enemyHit');
            enemyHealth?.damage(damage);
        });

        this.scene!.physics.add.overlap(this._player, this._enemyBullets, (player, bullet) => {
            this.spawnLaserImpact((bullet as Bullet).x, (bullet as Bullet).y, (bullet as Bullet).bulletData.fx);

            (bullet as Bullet).disable();
            (player as Player).getComponent(Health)?.damage((bullet as Bullet).bulletData.damage);

            this.scene?.cameras.main.shake(100, 0.01);
        });

        this.scene!.physics.add.overlap(this._player, this._enemies, (player, enemy) => {
            this.spawnCollisionImpact((enemy as Enemy).x, (enemy as Enemy).y);

            const enemyHealth = (enemy as Enemy).getComponent(Health);
            enemyHealth?.damage(enemyHealth?.max);

            const playerHealth = (player as Player).getComponent(Health);
            playerHealth?.damage(1);

            this.scene?.cameras.main.shake(100, 0.03);
        });

        this.scene!.physics.add.overlap(this._player, this._xpGems, (player, gem) => {
            const xpGem = gem as XpGem;
            xpGem.disable();
            // Screen position, before the XP change, so the HUD can tie the two together
            const worldView = this.scene!.cameras.main.worldView;
            this.game!.events.emit(GameConstants.Events.XP_GEM_COLLECTED_EVENT,
                xpGem.x - worldView.x, xpGem.y - worldView.y);
            (player as Player).getComponent(Experience)?.add(xpGem.value);
        });

        console.log("[EntityManager] Group collisions initialized");
    }

    public initParticleEmitters() {
        this._pierceAfterimages = this.scene!.add.group({classType: GameObjects.Image});
        this._damageNumbers = this.scene!.add.group({
            classType: GameObjects.Text,
            createCallback: (text) => {
                (text as GameObjects.Text).setStyle({fontFamily: 'future', stroke: '#0a1a33', strokeThickness: 6})
                    .setOrigin(0.5).setDepth(EntityManager.ENTITIES_DEPTHS.EFFECTS_TOP);
            }
        });
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

        const size: number = fx.impactSize ?? 1;
        this._laserSparksFX.ops.tint.loadConfig({ tint: fx.sparkTints });
        this._laserSparksFX.explode(Math.round(16 * size), x, y);

        this._laserGlowFX.ops.tint.loadConfig({ tint: fx.glowTints });
        this._laserGlowFX.explode(Math.round(8 * size), x, y);
    }

    public spawnCollisionImpact(x: number, y: number) {
        this._collisionFlashFX.explode(1, x, y);
        this._collisionShockwaveFX.explode(6, x, y);
    }

    public spawnExplosion(x: number, y: number, size: number = 1) {
        this._explosionFireFX.explode(Math.round(8 * size), x, y);
        this._explosionSmokeFX.explode(Math.round(12 * size), x, y);
    }

    // PIERCING: fading copies of the bolt trail behind it as it goes through an enemy
    private spawnPierceAfterimages(bullet: Bullet) {
        const direction = bullet.body!.velocity.clone().normalize();
        [{distance: 24, alpha: 0.5}, {distance: 48, alpha: 0.25}].forEach(afterimage => {
            const image: GameObjects.Image = this._pierceAfterimages.get(
                bullet.x - direction.x * afterimage.distance, bullet.y - direction.y * afterimage.distance);
            image.setTexture('sprites', bullet.frame.name).setActive(true).setVisible(true)
                .setOrigin(1, 0.5).setRotation(bullet.rotation).setScale(bullet.scaleX, bullet.scaleY)
                .setAlpha(afterimage.alpha).setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(EntityManager.ENTITIES_DEPTHS.PLAYER_BULLETS - 1);
            this.scene!.tweens.add({
                targets: image,
                alpha: 0,
                duration: 200,
                onComplete: () => this._pierceAfterimages.killAndHide(image)
            });
        });
    }

    // HUD-like readout that rises and fades above the enemy: cyan, gold on the killing blow
    public spawnDamageNumber(x: number, y: number, damage: number, isKill: boolean) {
        const jitter: number = EntityManager.DAMAGE_NUMBER_JITTER;
        const text: GameObjects.Text = this._damageNumbers.get(x + Phaser.Math.Between(-jitter, jitter), y);
        text.setActive(true).setVisible(true).setAlpha(1).setText(damage.toString())
            .setFontSize(isKill ? 44 : 32).setColor(isKill ? '#ffcc00' : '#7fe8ff');

        this.scene!.tweens.add({targets: text, scale: {from: 1.3, to: 1}, duration: 120, ease: 'Quad.easeOut'});
        this.scene!.tweens.add({
            targets: text,
            y: text.y - EntityManager.DAMAGE_NUMBER_RISE,
            duration: EntityManager.DAMAGE_NUMBER_DURATION,
            ease: 'Quad.easeOut'
        });
        this.scene!.tweens.add({
            targets: text,
            alpha: 0,
            delay: EntityManager.DAMAGE_NUMBER_DURATION / 2,
            duration: EntityManager.DAMAGE_NUMBER_DURATION / 2,
            onComplete: () => this._damageNumbers.killAndHide(text)
        });
    }

    // Several gems scatter around the kill, so they don't stack
    public spawnXpGems(x: number, y: number, count: number) {
        for (let i = 0; i < count; i++) {
            if (i > 0)
                Phaser.Math.RandomXY(this._xpGemScatter, Phaser.Math.FloatBetween(
                    EntityManager.XP_GEM_SCATTER_MIN_RADIUS, EntityManager.XP_GEM_SCATTER_MAX_RADIUS));
            else
                this._xpGemScatter.reset();
            // No drop when the pool is full
            (this._xpGems.get() as XpGem | null)?.enable(x + this._xpGemScatter.x, y + this._xpGemScatter.y);
        }
    }

    private spawnEnemy() {
        const difficulty = this._difficulty.at(this.scene!.registry.get(RegistryConstants.Keys.RUN_TIME) ?? 0);
        this.scene!.time.delayedCall(difficulty.spawnInterval, this.spawnEnemy, [], this);

        if (this._enemies.countActive(true) >= difficulty.maxEnemies) {
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
        enemy.enable(view.centerX + this._spawnOffset.x, view.centerY + this._spawnOffset.y,
            difficulty.enemyHealth, difficulty.enemySpeed);

        this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);

        enemy.getComponent(Health)?.once(Health.DEATH_START_EVENT, () => {
            const combo: number = this.scene!.registry.get(RegistryConstants.Keys.PLAYER_COMBO) ?? 1;
            this.spawnExplosion(enemy.x, enemy.y, 1 + (combo - 1) * EntityManager.EXPLOSION_PER_COMBO);
            // A little louder and deeper as the combo builds
            Sfx.play(this.scene!, 'explosion', {volumeScale: 1 + (combo - 1) * 0.1, detune: -(combo - 1) * 60});
            // One gem per combo level: staying unhurt levels up faster
            this.spawnXpGems(enemy.x, enemy.y, combo);
            this.game!.events.emit(GameConstants.Events.ENEMY_KILLED_EVENT, enemy);
        });

        console.log("[EntityManager] Enemy spawned");
    }
}