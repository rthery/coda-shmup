export type UpgradeId = 'fireRate' | 'damage' | 'range' | 'bulletSpeed' | 'moveSpeed' | 'shieldCell' | 'magnet' | 'pierce';

export type UpgradeCategory = 'weapon' | 'ship';

export type UpgradeData = {
    id: UpgradeId;
    category: UpgradeCategory;
    title: string;
    description: string;
    value: number;
    // Times it can be picked, it stops being offered after that. null: no limit and no rank
    maxRank: number | null;
}

// The stat an upgrade changes, as shown on its card: "FIRE RATE 2.0 -> 2.4 /S"
export type UpgradePreview = {
    stat: string;
    current: string;
    next: string;
}
