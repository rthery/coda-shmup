import { Scene, GameObjects, Physics } from 'phaser';

export class MainGameScene extends Scene
{
    private player: GameObjects.Image;
    private playerMovementSpeed: number = 0.9;
    private playerRateOfFire: number = 0.5;
    private playerScore: number;
    private lastShotTime: number;
    private cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
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
        this.load.atlasXML('sprites', 'Spritesheet/sheet.png', 'Spritesheet/sheet.xml');
        this.load.audio('sfx_laser1', 'Sounds/sfx_laser1.ogg');
        this.load.audio('sfx_laser2', 'Sounds/sfx_laser2.ogg');
    }

    create ()
    {
        // https://coolors.co/palette/50514f-f25f5c-ffe066-247ba0-70c1b3
        const colorPalette: string[] = ["#50514f","#f25f5c","#ffe066",
            "#247ba0","#70c1b3"];
        this.cameras.main.setBackgroundColor(colorPalette[0]);

        this.bg = this.add.tileSprite(0, 0, this.cameras.main.width, this.cameras.main.height, 'bg').setOrigin(0).setTileScale(2);
        this.planet = this.add.image(0, -512, 'planet').setOrigin(0);

        this.player = this.add.image(this.cameras.main.centerX, this.cameras.main.height - 128, 'sprites', 'playerShip3_blue.png').setDepth(100).setOrigin(0.5);
        this.physics.add.existing(this.player);
        let playerBody: Physics.Arcade.Body = this.player.body as Physics.Arcade.Body;
        playerBody.allowGravity = false;
        playerBody.setFriction(0, 0);

        if (this.input.keyboard)
        {
            this.cursorKeys = this.input.keyboard.createCursorKeys();
        }
        else
        {
            console.error('No keyboard input');
        }

        // Add physics groups and callbacks
        this.bullets = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.enemyBullets = this.physics.add.group();
        this.physics.add.collider(this.bullets, this.enemies, (bullet, enemy) => {
            const timer = this.enemyShootTimers.get(enemy as Phaser.Types.Physics.Arcade.GameObjectWithBody);
            if (timer) {
                timer.remove();
            }
            else {
                console.error("Enemy shoot timer not found");
            }
            bullet.destroy();
            enemy.destroy();
            this.playerScore++;
            console.log("Score: " + this.playerScore);
        }, undefined, this);
        this.physics.add.collider(this.enemyBullets, this.player, (_bullet, _player) => {
            this.endGame();
        }, undefined, this);
        this.physics.add.collider(this.enemies, this.player, (_enemy, _player) => {
            this.endGame();
        });

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
        let enemy: GameObjects.Image = this.add.image(Phaser.Math.Between(enemySize, this.cameras.main.width - enemySize), -enemySize/2, "sprites", "ufoRed.png").setDepth(100);
        this.enemies.add(enemy);
        this.physics.add.existing(enemy);
        let enemyBody: Physics.Arcade.Body = enemy.body as Physics.Arcade.Body;
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

    private enemyShoot (enemy: GameObjects.Arc)
    {
        let bullet: GameObjects.Rectangle = this.add.rectangle(enemy.x, enemy.y + enemy.displayHeight / 2, 12, 12, 0xf25f5c).setOrigin(0.5);
        this.enemyBullets.add(bullet);
        this.physics.add.existing(bullet);
        let bulletBody: Physics.Arcade.Body = bullet.body as Physics.Arcade.Body;
        bulletBody.allowGravity = false;
        bulletBody.setFriction(0, 0);
        bulletBody.setVelocityY(512);

        this.sound.play('sfx_laser2');
    }

    update (timeSinceLaunch: number, deltaTime: number)
    {
        this.bg.tilePositionY -= 0.1 * deltaTime;
        this.planet.y += 0.40 * deltaTime;

        // Press left or right arrow keys to move the player smoothly horizontally using deltaTime
        if (this.player)
        {
            if (this.cursorKeys.left.isDown)
            {
                (this.player.body as Physics.Arcade.Body).x -= this.playerMovementSpeed * deltaTime;
            }
            else if (this.cursorKeys.right.isDown)
            {
                (this.player.body as Physics.Arcade.Body).x += this.playerMovementSpeed * deltaTime;
            }
        }

        // Press space to shoot
        if (this.cursorKeys.space.isDown && timeSinceLaunch - this.lastShotTime > this.playerRateOfFire * 1000)
        {
            let bullet: GameObjects.Rectangle = this.add.rectangle(this.player.x, this.player.y - this.player.displayHeight / 2, 4, 12, 0xffe066).setOrigin(0.5);
            this.bullets.add(bullet);
            this.physics.add.existing(bullet);
            let bulletBody: Physics.Arcade.Body = bullet.body as Physics.Arcade.Body;
            bulletBody.allowGravity = false;
            bulletBody.setFriction(0, 0);
            bulletBody.setVelocityY(-1024);

            this.sound.play('sfx_laser1');

            this.lastShotTime = timeSinceLaunch;
        }

        // Stop player from going offscreen
        this.player.x = Phaser.Math.Clamp(this.player.x, this.player.displayWidth / 2, this.cameras.main.width - this.player.displayWidth / 2);

        // Destroy entities when out of screen
        this.bullets.getChildren().forEach(bullet => {
            if ((bullet as GameObjects.Rectangle).y < -(bullet as GameObjects.Rectangle).displayHeight)
            {
                bullet.destroy();
            }
        });
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
        this.enemyBullets.getChildren().forEach(bullet => {
            if ((bullet as GameObjects.Rectangle).y > this.cameras.main.height + (bullet as GameObjects.Rectangle).displayHeight)
            {
                bullet.destroy();
            }
        });
    }
}
