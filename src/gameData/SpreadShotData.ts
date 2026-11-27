export type SpreadShotData = {
    // Number of bullets fired at once
    count: number;
    // Angle of the fan, in degrees, centered on the forward direction of the shooter.
    // 30 = bullets spread over 30 degrees; 360 (or more) = bullets evenly spread all around the shooter
    angle: number;
};