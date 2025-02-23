import {Scene, GameObjects, Physics} from 'phaser';
import {Bullet} from "../entities/Bullet.ts";
import {Enemy} from "../entities/Enemy.ts";
import {Player} from "../entities/Player.ts";
import GroupUtils from "../utils/GroupUtils.ts";

export class MainGameScene extends Scene {
    private player: Player;
    private playerScore: number;
    private playerBullets: Physics.Arcade.Group;
    private enemies: Physics.Arcade.Group;
    private enemyBullets: Physics.Arcade.Group;
    private bg: GameObjects.TileSprite;
    private planet: GameObjects.Image;

    constructor() {
        super('MainGameScene');
    }

    // noinspection JSUnusedGlobalSymbols
    preload() {
        this.load.setPath('assets');

        this.load.image('bg', 'Backgrounds/darkPurple.png');
        this.load.image('planet', 'Planets/planet00.png');
        this.load.atlas('sprites', 'Spritesheet/gameSprites.png', 'Spritesheet/gameSprites.json');

        this.load.audio('sfx_laser1', 'Sounds/sfx_laser1.ogg');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');

        this.load.json('playerShips', 'Data/playerShips.json');
    }

    // noinspection JSUnusedGlobalSymbols
    create() {
        this.bg = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'bg').setOrigin(0).setTileScale(2);
        this.planet = this.add.image(0, -512, 'planet').setOrigin(0);

        if (this.input.keyboard) {
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE).on('down', () => this.selectPlayerShip(1));
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO).on('down', () => this.selectPlayerShip(2));
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE).on('down', () => this.selectPlayerShip(3));
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.scene.restart());
        } else {
            console.error('No keyboard input');
        }

        // noinspection JSUnusedGlobalSymbols
        const bulletGroupConfig = {
            classType: Bullet,
            maxSize: 256,
            runChildUpdate: true,
            createCallback: (bullet: Phaser.GameObjects.GameObject) => {
                (bullet as Bullet).init();
            }
        }
        this.playerBullets = this.physics.add.group(bulletGroupConfig);
        GroupUtils.populate(64, this.playerBullets);

        this.enemyBullets = this.physics.add.group(bulletGroupConfig);
        GroupUtils.populate(256, this.enemyBullets);


        const playerShipsData = this.cache.json.get('playerShips') as PlayerShipsData;
        this.player = new Player(this, this.cameras.main.centerX, this.cameras.main.height - 128, 'sprites', playerShipsData[1], this.playerBullets);

        this.enemies = this.physics.add.group({
            classType: Enemy,
            defaultKey: 'sprites',
            defaultFrame: 'ufoRed.png',
            createCallback: (enemy) => {
                (enemy as Enemy).init(this.enemyBullets);
            }
        });
        // Spawn enemies indefinitely
        this.time.addEvent({
            delay: 1500,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        this.initGroupCollisions();

        this.playerScore = 0;
    }

    private initGroupCollisions() {
        // Add collisions detection
        this.physics.add.collider(this.playerBullets, this.enemies, (bullet, enemy) => {
            (bullet as Bullet).disable();
            (enemy as Enemy).disable();
            this.playerScore++;
            console.log("Score: " + this.playerScore);
        }, undefined, this);
        this.physics.add.collider(this.enemyBullets, this.player, (_bullet, _player) => {
            this.endGame();
        }, undefined, this);
        this.physics.add.collider(this.enemies, this.player, (_enemy, _player) => {
            this.endGame();
        });
    }

    private selectPlayerShip(playerShipId: number) {
        const playerShipsData = this.cache.json.get('playerShips') as PlayerShipsData;
        this.player.setPlayerShipData(playerShipsData[playerShipId]);
    }

    private endGame() {
        this.scene.restart();
        console.log("Game Over")
    }

    private spawnEnemy() {
        if (this.enemies.countActive(true) >= 5) {
            return;
        }

        const enemy = this.enemies.get() as Enemy;
        enemy.enable(Phaser.Math.Between(64, this.cameras.main.width - 64), 0);
    }

    update(_timeSinceLaunch: number, deltaTime: number) {
        this.bg.tilePositionY -= 0.1 * deltaTime;
        this.planet.y += 0.40 * deltaTime;
    }
}
