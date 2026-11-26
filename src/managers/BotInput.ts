import type PlayerInput from "./PlayerInput.ts";
import type {InputDevice} from "./PlayerInput.ts";
import type Team from "../Team.ts";
import type Player from "../entities/Player.ts";
import type EntityManager from "./EntityManager.ts";
import type XpGem from "../entities/XpGem.ts";

// A teammate the game drives: it stays near the other ships, away from enemies, and picks up stars.
// Its turret fires on its own like any ship's
export default class BotInput implements PlayerInput {
    // Closes in on its teammate beyond this distance
    private static readonly FOLLOW_DISTANCE: number = 280; // px
    private static readonly DANGER_RADIUS: number = 260; // px
    private static readonly DANGER_WEIGHT: number = 2.5;
    private static readonly STAR_RADIUS: number = 450; // px
    private static readonly STAR_WEIGHT: number = 0.6;
    // Below this, the pushes cancel out: it stays still
    private static readonly DEADZONE: number = 0.15;

    public readonly device: InputDevice = {type: 'bot'};

    private readonly _team: Team;
    private readonly _entityManager: EntityManager;
    private readonly _moveDirection: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private readonly _push: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private _player: Player | null = null;

    public constructor(team: Team, entityManager: EntityManager) {
        this._team = team;
        this._entityManager = entityManager;
    }

    public confirmJustPressed(): boolean {
        return false;
    }

    public get moveDirection(): Phaser.Math.Vector2 {
        const player = this.player;
        if (!player)
            return this._moveDirection.set(0, 0);

        this._moveDirection.set(0, 0);
        this.addFollow(player);
        this.addDanger(player);
        this.addStar(player);
        if (this._moveDirection.length() < BotInput.DEADZONE)
            return this._moveDirection.set(0, 0);
        return this._moveDirection.normalize();
    }

    // Its ship, found once it has joined the team
    private get player(): Player | null {
        if (this._player)
            return this._player;
        for (const player of this._team.players) {
            if (player.playerInput === this)
                this._player = player;
        }
        return this._player;
    }

    private addFollow(player: Player) {
        let leader: Player | null = null;
        let leaderDistance: number = Infinity;
        for (const teammate of this._team.players) {
            if (teammate === player || !teammate.active)
                continue;
            const distance: number = Phaser.Math.Distance.Between(player.x, player.y, teammate.x, teammate.y);
            if (distance < leaderDistance) {
                leader = teammate;
                leaderDistance = distance;
            }
        }
        if (!leader || leaderDistance <= BotInput.FOLLOW_DISTANCE)
            return;

        const strength: number = Math.min(1, (leaderDistance - BotInput.FOLLOW_DISTANCE) / BotInput.FOLLOW_DISTANCE);
        this._push.set(leader.x - player.x, leader.y - player.y).normalize().scale(strength);
        this._moveDirection.add(this._push);
    }

    // Away from every enemy close by, harder the closer it is
    private addDanger(player: Player) {
        const enemies = this._entityManager.enemies;
        if (!enemies)
            return;
        for (const child of enemies.getChildren()) {
            const enemy = child as Phaser.Physics.Arcade.Sprite;
            if (!enemy.active)
                continue;
            const distance: number = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
            if (distance >= BotInput.DANGER_RADIUS || distance === 0)
                continue;
            const strength: number = (1 - distance / BotInput.DANGER_RADIUS) * BotInput.DANGER_WEIGHT;
            this._push.set(player.x - enemy.x, player.y - enemy.y).scale(strength / distance);
            this._moveDirection.add(this._push);
        }
    }

    // Toward the nearest star nobody pulls yet
    private addStar(player: Player) {
        const stars = this._entityManager.xpGems;
        if (!stars || !player.isInFight)
            return;
        let nearest: XpGem | null = null;
        let nearestDistance: number = BotInput.STAR_RADIUS;
        for (const child of stars.getChildren()) {
            const star = child as XpGem;
            if (!star.active || star.isAttracted)
                continue;
            const distance: number = Phaser.Math.Distance.Between(player.x, player.y, star.x, star.y);
            if (distance < nearestDistance) {
                nearest = star;
                nearestDistance = distance;
            }
        }
        if (!nearest)
            return;
        this._push.set(nearest.x - player.x, nearest.y - player.y).normalize().scale(BotInput.STAR_WEIGHT);
        this._moveDirection.add(this._push);
    }
}
