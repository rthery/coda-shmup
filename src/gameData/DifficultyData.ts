// XP to reach the next level: base + perLevel * (level - 1) + perLevelSquared * (level - 1)²
export type XpCurveData = {
    base: number;
    perLevel: number;
    perLevelSquared: number;
}

// Values at a point of the run, interpolated between keyframes and held after the last one
export type DifficultyKeyframeData = {
    time: number; // s since the run started
    spawnInterval: number; // ms between two enemy spawns
    maxEnemies: number;
    enemyHealth: number;
    enemySpeed: number; // px/ms
}

export type DifficultyData = {
    xp: XpCurveData;
    keyframes: DifficultyKeyframeData[];
}
