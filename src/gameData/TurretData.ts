// Turret pivot in ship space: forward is +x, origin at the ship center
export type TurretData = {
    x: number;
    y: number;
    // In the ship's colors, with one barrel or two (RAPID FIRE at its max rank)
    frame: string;
    twinFrame: string;
}
