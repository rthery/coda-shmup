export default class SpreadUtils {
    // Angles (in radians) of the bullets of a spread shot, as a fan centered on baseAngle.
    // - count bullets, evenly spaced, the first and last ones being arc radians apart
    // - a full circle (arc >= 2 PI) has no "last" bullet: the count bullets are evenly spaced around the circle,
    //   otherwise the first and last bullets would overlap
    static computeAngles(baseAngle: number, count: number, arc: number): number[] {
        const bulletCount: number = Math.max(0, Math.floor(count));
        if (bulletCount === 0)
            return [];

        if (bulletCount === 1)
            return [baseAngle];

        const fullCircle: number = Math.PI * 2;
        const clampedArc: number = Math.max(0, Math.min(arc, fullCircle));
        const isFullCircle: boolean = clampedArc >= fullCircle;

        const step: number = isFullCircle ? fullCircle / bulletCount : clampedArc / (bulletCount - 1);
        const firstAngle: number = isFullCircle ? baseAngle : baseAngle - clampedArc / 2;

        const angles: number[] = [];
        for (let i: number = 0; i < bulletCount; i++) {
            angles.push(firstAngle + i * step);
        }

        return angles;
    }
}