export type SinusoidalEnemyConfig = {
    spawnIntervalMs: number;
    movement: {
        verticalSpeed: number;
        amplitude: number;
        frequencyHz: number;
    };
    spreadShot: {
        intervalMs: number;
        bulletCount: number;
        angleDegrees: number;
    };
    visualTint: number;
};

function asRecord(value: unknown, name: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`Invalid sinusoidal enemy config: ${name} must be an object`);
    }

    return value as Record<string, unknown>;
}

function positiveNumber(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid sinusoidal enemy config: ${name} must be a positive number`);
    }

    return value;
}

function nonNegativeNumber(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid sinusoidal enemy config: ${name} must be a non-negative number`);
    }

    return value;
}

function integerInRange(value: unknown, name: string, minimum: number, maximum: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
        throw new Error(`Invalid sinusoidal enemy config: ${name} must be an integer from ${minimum} to ${maximum}`);
    }

    return value;
}

export function parseSinusoidalEnemyConfig(value: unknown): SinusoidalEnemyConfig {
    const config = asRecord(value, 'root');
    const movement = asRecord(config.movement, 'movement');
    const spreadShot = asRecord(config.spreadShot, 'spreadShot');

    return {
        spawnIntervalMs: positiveNumber(config.spawnIntervalMs, 'spawnIntervalMs'),
        movement: {
            verticalSpeed: positiveNumber(movement.verticalSpeed, 'movement.verticalSpeed'),
            amplitude: nonNegativeNumber(movement.amplitude, 'movement.amplitude'),
            frequencyHz: positiveNumber(movement.frequencyHz, 'movement.frequencyHz')
        },
        spreadShot: {
            intervalMs: positiveNumber(spreadShot.intervalMs, 'spreadShot.intervalMs'),
            bulletCount: integerInRange(spreadShot.bulletCount, 'spreadShot.bulletCount', 1, 256),
            angleDegrees: integerInRange(spreadShot.angleDegrees, 'spreadShot.angleDegrees', 1, 360)
        },
        visualTint: integerInRange(config.visualTint, 'visualTint', 0, 0xFFFFFF)
    };
}
