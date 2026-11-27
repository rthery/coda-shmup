export default class GameConstants {
    public static readonly Events = Object.freeze({
        TEAM_CREATED_EVENT: "teamCreated",
        PLAYER_SPAWNED_EVENT: "playerSpawned",
        PLAYER_LEFT_EVENT: "playerLeft",
        ENEMY_SPAWNED_EVENT: "enemySpawned",
        ENEMY_KILLED_EVENT: "enemyKilled",
        XP_GEM_COLLECTED_EVENT: "xpGemCollected",
        LEVEL_UP_CLOSED_EVENT: "levelUpClosed",
        COMBO_BROKEN_EVENT: "comboBroken",
    } as const);

    public static readonly SceneKeys = Object.freeze({
        HOME: "HomeScene",
        MAIN_GAME: "MainGameScene",
        MAIN_UI: "MainUIScene",
        GAME_OVER: "GameOverScene",
        LEVEL_UP: "LevelUpScene",
        PAUSE: "PauseScene",
    } as const);

    public static readonly START_DELAY: number = 500; // ms
    // One per ship in playerShips.json
    public static readonly MAX_PLAYERS: number = 2;
    public static readonly MAX_SCORE_DIGITS: number = 6;
    public static readonly COMBO_KILLS_PER_STEP: number = 10;
    public static readonly MAX_COMBO: number = 5;

    // The game view shows this area on every screen, in the window's shape
    public static readonly VIEW_AREA: number = 1080 * 1920;
    // Past these width / height ratios the view stops stretching and the screen gets black bars
    public static readonly MIN_VIEW_ASPECT: number = 9 / 21;
    public static readonly MAX_VIEW_ASPECT: number = 21 / 9;

    // Square, so no view shape is favored
    public static readonly ARENA_WIDTH: number = 3800;
    public static readonly ARENA_HEIGHT: number = 3800;
}