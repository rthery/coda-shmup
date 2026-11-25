export default class GameConstants {
    public static readonly Events = Object.freeze({
        PLAYER_SPAWNED_EVENT: "playerSpawned",
        ENEMY_SPAWNED_EVENT: "enemySpawned",
        ENEMY_KILLED_EVENT: "enemyKilled",
    } as const);

    public static readonly SceneKeys = Object.freeze({
        HOME: "HomeScene",
        MAIN_GAME: "MainGameScene",
        MAIN_UI: "MainUIScene",
        GAME_OVER: "GameOverScene",
        LEVEL_UP: "LevelUpScene",
    } as const);

    public static readonly START_DELAY: number = 500; // ms
    public static readonly MAX_SCORE_DIGITS: number = 6;

    // Small enough for the planet, at the center, to stay visible from the arena corners
    public static readonly ARENA_WIDTH: number = 3400;
    public static readonly ARENA_HEIGHT: number = 4700;
}