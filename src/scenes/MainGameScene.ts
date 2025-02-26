import { Scene, GameObjects, Physics, Types } from 'phaser';
import { Bullet } from "../entities/Bullet.ts";
import { PlayerShipsData, PlayerShipData } from "../gameData/PlayerShipsData.ts";

export class MainGameScene extends Scene
{
    private player: GameObjects.Image;
    private playerShipData: PlayerShipData;
    private playerRateOfFire: number = 0.5;
    private playerScore: number;
    private lastShotTime: number;
    private cursorKeys: Types.Input.Keyboard.CursorKeys;
    private enemyShootTimers: Map<GameObjects.GameObject, Phaser.Time.TimerEvent>;
    private bullets: Physics.Arcade.Group;
    private enemies: Physics.Arcade.Group;
    private enemyBullets: Physics.Arcade.Group;
    private bg: GameObjects.TileSprite;
    private planet: GameObjects.Image;

    constructor ()
    {
        super('MainGameScene');
    }

    preload ()
    {
        this.load.setPath('assets');

        this.load.image('bg', 'Backgrounds/darkPurple.png');
        this.load.image('planet', 'Planets/planet00.png');
        this.load.atlas('sprites', 'Spritesheet/gameSprites.png', 'Spritesheet/gameSprites.json');

        this.load.json('playerShips', 'Data/playerShips.json');
    }

    create ()
    {
        // https://coolors.co/palette/50514f-f25f5c-ffe066-247ba0-70c1b3
        const colorPalette: string[] = ["#50514f","#f25f5c","#ffe066",
            "#247ba0","#70c1b3"];
        this.cameras.main.setBackgroundColor(colorPalette[0]);

        this.bg = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'bg').setOrigin(0).setTileScale(2);
        this.planet = this.add.image(0, -512, 'planet').setOrigin(0);

        const playerShipsData = this.cache.json.get('playerShips') as PlayerShipsData;
        this.playerShipData = playerShipsData[1];

        this.player = this.add.image(this.cameras.main.centerX, this.cameras.main.height - 128, 'sprites', this.playerShipData.texture).setDepth(100).setOrigin(0.5);
        this.physics.add.existing(this.player);
        const playerBody: Physics.Arcade.Body = this.player.body as Physics.Arcade.Body;
        playerBody.allowGravity = false;
        playerBody.setFriction(0, 0);

        if (this.input.keyboard)
        {
            this.cursorKeys = this.input.keyboard.createCursorKeys();
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE).on('down', () => this.selectPlayerShip(1));
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO).on('down', () => this.selectPlayerShip(2));
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE).on('down', () => this.selectPlayerShip(3));
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R).on('down', () => this.scene.restart());
        }
        else
        {
            console.error('No keyboard input');
        }

        this.enemies = this.physics.add.group();

        // noinspection JSUnusedGlobalSymbols
        const bulletGroupConfig = {
            classType: Bullet,
            maxSize: 256,
            runChildUpdate: true,
            createCallback: (bullet: GameObjects.GameObject) => {
                (bullet as Bullet).init();
            }
        }
        this.bullets = this.physics.add.group(bulletGroupConfig);
        this.warmGroupItems(64, this.bullets);

        this.enemyBullets = this.physics.add.group(bulletGroupConfig);
        this.warmGroupItems(256, this.enemyBullets);

        // Add collisions detection
        this.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
            const timer = this.enemyShootTimers.get(enemy as Phaser.Types.Physics.Arcade.GameObjectWithBody);
            if (timer) {
                timer.remove();
            }
            else {
                console.error("Enemy shoot timer not found");
            }

            (bullet as Bullet).disable();
            enemy.destroy();
            this.playerScore++;
            console.log("Score: " + this.playerScore);
        });
        this.physics.add.overlap(this.enemyBullets, this.player, (_bullet, _player) => {
            this.endGame();
        });
        this.physics.add.overlap(this.enemies, this.player, (_enemy, _player) => {
            this.endGame();
        });

        // Create animation when enemy is about to shoot
        if (!this.anims.exists('ufoShoot')) {
            this.anims.create({
                key: 'ufoShoot',
                frames: [
                    { key: 'sprites', frame: 'ufoRed.png' },
                    { key: 'sprites', frame: 'ufoRed-shoot0.png' },
                    { key: 'sprites', frame: 'ufoRed-shoot1.png' }
                ],
                frameRate: 4,
            });
        }

        this.enemyShootTimers = new Map();
        // Spawn enemies indefinitely
        this.time.addEvent({
            delay: 1500,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        this.playerScore = 0;
        this.lastShotTime = 0;
    }

    // Filled group with items to avoid lag spikes in case of many instantiation of items in the same frame
    private warmGroupItems(initialQuantity: number, group: Physics.Arcade.Group) {
        if (group.getLength() >= initialQuantity) {
            return;
        }

        for (let i: number = 0; i < initialQuantity; i++) {
            group.get();
        }

        // We disable them all immediately
        if (group.classType && typeof group.classType.prototype.disable === 'function') {
            group.children.each((item: GameObjects.GameObject) => {
                (item as any).disable();
                return true;
            });
        }
    }

    private selectPlayerShip (playerShipId: number)
    {
        const playerShipsData = this.cache.json.get('playerShips') as PlayerShipsData;
        this.playerShipData = playerShipsData[playerShipId];

        this.player.setTexture('sprites', this.playerShipData.texture);
    }

    private endGame ()
    {
        this.scene.restart();
        console.log("Game Over")
    }

    private spawnEnemy ()
    {
        if (this.enemies.getLength() >= 5)
        {
            return;
        }

        const enemySize: number = 32;
        const enemyPosX: number = Phaser.Math.Between(enemySize, this.cameras.main.width - enemySize);
        const enemyPosY: number = -enemySize;
        const enemy: GameObjects.Sprite = this.add.sprite(enemyPosX, enemyPosY, "sprites", "ufoRed.png").setDepth(100);
        this.enemies.add(enemy);
        this.physics.add.existing(enemy);
        const enemyBody: Physics.Arcade.Body = enemy.body as Physics.Arcade.Body;
        enemyBody.allowGravity = false;
        enemyBody.setFriction(0, 0);
        enemyBody.setVelocityY(256);

        // Have enemy shoot every 2 to 3 seconds
        let timer = this.time.addEvent({
            delay: Phaser.Math.Between(2000, 3000),
            callback: this.enemyShoot,
            args: [enemy],
            callbackScope: this,
            loop: true
        });
        this.enemyShootTimers.set(enemy, timer);
    }

    private enemyShoot (enemy: GameObjects.Sprite)
    {
        enemy.play('ufoShoot');
        enemy.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            enemy.setTexture('sprites', 'ufoRed.png');

            const bullet: Bullet = this.enemyBullets.get() as Bullet;
            if (bullet)
            {
                bullet.enable(enemy.x, enemy.y + enemy.displayHeight / 2, 12, 12, 0xf25f5c, 512);
            }
        });
    }

    update (timeSinceLaunch: number, deltaTime: number)
    {
        this.bg.tilePositionY -= 0.1 * deltaTime;
        this.planet.y += 0.40 * deltaTime;

        // Press left or right arrow keys to move the player smoothly horizontally using deltaTime
        if (this.player && this.playerShipData)
        {
            if (this.cursorKeys.left.isDown)
            {
                (this.player.body as Physics.Arcade.Body).x -= this.playerShipData.movementSpeed * deltaTime;
            }
            else if (this.cursorKeys.right.isDown)
            {
                (this.player.body as Physics.Arcade.Body).x += this.playerShipData.movementSpeed * deltaTime;
            }
        }

        // Press space to shoot
        if (this.cursorKeys.space.isDown && timeSinceLaunch - this.lastShotTime > this.playerRateOfFire * 1000)
        {
            const bullet: Bullet = this.bullets.get() as Bullet;
            if (bullet)
            {
                bullet.enable(this.player.x, this.player.y - this.player.displayHeight / 2, 4, 12, 0xffe066, -1024);

                this.lastShotTime = timeSinceLaunch;}
        }

        // Stop player from going offscreen
        this.player.x = Phaser.Math.Clamp(this.player.x, this.player.displayWidth / 2, this.cameras.main.width - this.player.displayWidth / 2);

        // Destroy entities when out of screen
        this.enemies.getChildren().forEach(enemy => {
            if ((enemy as GameObjects.Arc).y >= this.cameras.main.height + (enemy as GameObjects.Arc).displayHeight)
            {
                const timer = this.enemyShootTimers.get(enemy);
                if (timer) {
                    timer.remove();
                }
                else {
                    console.error("Enemy shoot timer not found");
                }

                enemy.destroy();
            }
        });
    }
}
