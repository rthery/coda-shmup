// The whole keyboard, or one half of it when two players share it
export type KeyboardKeySet = 'wasd' | 'arrows' | 'all';

// Which device drives a player: every device in solo, the one each player picked in coop, or the game itself
export type InputDevice =
    | { type: 'any' }
    | { type: 'keyboard', keys: KeyboardKeySet }
    | { type: 'gamepad', index: number }
    | { type: 'bot' };

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
