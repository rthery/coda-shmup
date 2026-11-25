export type UpgradeId = 'fireRate' | 'range' | 'bulletSpeed' | 'moveSpeed' | 'maxHealth' | 'magnet' | 'pierce';

export type UpgradeData = {
    id: UpgradeId;
    title: string;
    description: string;
    value: number;
}
