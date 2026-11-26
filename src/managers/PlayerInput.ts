export type KeyboardKeySet = 'wasd' | 'arrows';

// Which device drives a player: every device in solo, one device per player in coop
export type InputDevice =
    | { type: 'any' }
    | { type: 'keyboard', keys: KeyboardKeySet }
    | { type: 'gamepad', index: number };

// What a player reads to move and pick, whatever drives it
export default interface PlayerInput {
    readonly device: InputDevice;
    readonly moveDirection: Phaser.Math.Vector2;
    confirmJustPressed(): boolean;
}

export function isSameDevice(a: InputDevice, b: InputDevice): boolean {
    if (a.type === 'keyboard' && b.type === 'keyboard')
        return a.keys === b.keys;
    if (a.type === 'gamepad' && b.type === 'gamepad')
        return a.index === b.index;
    return a.type === b.type;
}
