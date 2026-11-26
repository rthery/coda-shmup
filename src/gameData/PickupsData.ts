export type PickupId = 'bomb' | 'magnet' | 'repair';

export type PickupData = {
    id: PickupId;
    // Frame in the sprites atlas
    texture: string;
    // CSS hex color of the halo behind the pickup and of its effect
    glowTint: string;
    // Rolled on each kill, 0 to 1
    dropChance: number;
    // s of run time before this pickup can drop again
    cooldown: number;
}
