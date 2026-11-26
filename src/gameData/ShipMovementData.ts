export type ShipMovementData = {
    type: 'sinus',
    speedMovement: number,
    amplitude: number,
    frequency: number,
} | {
    type: 'vertical',
    speedMovement: number,
}