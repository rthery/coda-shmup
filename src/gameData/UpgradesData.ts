export type UpgradeId = 'fireRate' | 'damage' | 'range' | 'bulletSpeed' | 'moveSpeed' | 'maxHealth' | 'magnet' | 'pierce';

export type UpgradeCategory = 'weapon' | 'ship';

export type UpgradeData = {
    id: UpgradeId;
    category: UpgradeCategory;
    title: string;
    description: string;
    value: number;
}
