export type SinusoidalEnemyData = {
    spawnRateMs: number;
    movement: {
        frequency: number;
        amplitude: number;
    };
    spreadShot: {
        bulletCount: number;
        spreadAngleDeg: number;
    };
};
