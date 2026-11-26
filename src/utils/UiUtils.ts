import {GameObjects, Scene} from "phaser";

export type UiFrame = 'ui_header_blade_red' | 'ui_header_blade_green' | 'ui_header_blade_blue';

type Slices = { left: number; right: number; top: number; bottom: number };

// A piece of a hint line: text, or a button icon from the sprites atlas
export type HintPart = string | { icon: string };

// Kenney UI Pack Sci-Fi: header frames keep the coloured header band and the blade in their fixed slices
const SLICES: Record<UiFrame, Slices> = {
    ui_header_blade_red: {left: 230, right: 30, top: 72, bottom: 30},
    ui_header_blade_green: {left: 230, right: 30, top: 72, bottom: 30},
    ui_header_blade_blue: {left: 230, right: 30, top: 72, bottom: 30},
};

export default class UiUtils {
    // The pack's double-resolution sprites still look small on a 1080 wide screen
    public static readonly PANEL_SCALE: number = 1.5;
    public static readonly HEADER_HEIGHT: number = 66 * UiUtils.PANEL_SCALE;
    public static readonly INK_COLOR: string = '#4a5263';
    public static readonly INK_SOFT_COLOR: string = '#8a92a3';
    public static readonly YELLOW_COLOR: string = '#f5c542';

    private static readonly BAR_CAP_WIDTH: number = 24;
    private static readonly HINT_ALPHA: number = 0.7;
    // Kenney Input Prompts icons are 64 px: a bit taller than the text they sit in
    private static readonly HINT_ICON_HEIGHT_RATIO: number = 1.4;
    private static readonly HINT_PART_GAP: number = 10;

    public static addPanel(scene: Scene, x: number, y: number, width: number, height: number,
                           frame: UiFrame): GameObjects.NineSlice {
        const slices: Slices = SLICES[frame];
        const scale: number = UiUtils.PANEL_SCALE;
        return scene.add.nineslice(x, y, "sprites", frame, width / scale, height / scale,
            slices.left, slices.right, slices.top, slices.bottom).setScale(scale);
    }

    // Three-slice horizontal bar, the frame's height is kept
    public static addBar(scene: Scene, x: number, y: number, width: number, frame: string): GameObjects.NineSlice {
        return scene.add.nineslice(x, y, "sprites", frame, width, 0,
            UiUtils.BAR_CAP_WIDTH, UiUtils.BAR_CAP_WIDTH);
    }

    // A bar can't be narrower than its two caps, so an empty bar is hidden
    public static setBarFill(fill: GameObjects.NineSlice, maxWidth: number, ratio: number) {
        const minWidth: number = UiUtils.BAR_CAP_WIDTH * 2;
        const clampedRatio: number = Phaser.Math.Clamp(ratio, 0, 1);
        fill.setVisible(clampedRatio > 0);
        fill.setSize(Math.max(minWidth, maxWidth * clampedRatio), fill.height);
    }

    // MM:SS
    public static formatTime(seconds: number): string {
        const minutes: number = Math.floor(seconds / 60);
        return minutes.toString().padStart(2, "0") + ":" + (seconds % 60).toString().padStart(2, "0");
    }

    // Dim pulsing line, for input hints that shouldn't draw the eye
    public static addHint(scene: Scene, x: number, y: number, text: string): GameObjects.Text {
        const hint: GameObjects.Text = scene.add.text(x, y, text, {fontSize: '36px', color: '#fff', fontFamily: 'future'})
            .setOrigin(0.5).setAlpha(UiUtils.HINT_ALPHA);
        scene.tweens.add({
            targets: hint,
            alpha: UiUtils.HINT_ALPHA / 3,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        return hint;
    }

    // How a second player joins: the gamepad's confirm icon shows only once a gamepad is detected
    public static joinHintParts(gamepadConfirmIcon: string | null): HintPart[] {
        if (!gamepadConfirmIcon)
            return ['P2: PRESS ENTER TO JOIN, B FOR A BOT'];
        return ['P2: PRESS ENTER OR', {icon: gamepadConfirmIcon}, 'TO JOIN, B FOR A BOT'];
    }

    // A hint line mixing text and button icons, centered on x. setButtonHint changes its parts
    public static addButtonHint(scene: Scene, x: number, y: number, parts: HintPart[],
                                fontSize: number = 36): GameObjects.Container {
        const hint: GameObjects.Container = scene.add.container(x, y).setData('fontSize', fontSize);
        UiUtils.setButtonHint(hint, parts);
        return hint;
    }

    // Like addHint, with button icons
    public static addPulsingButtonHint(scene: Scene, x: number, y: number, parts: HintPart[]): GameObjects.Container {
        const hint: GameObjects.Container = UiUtils.addButtonHint(scene, x, y, parts).setAlpha(UiUtils.HINT_ALPHA);
        scene.tweens.add({
            targets: hint,
            alpha: UiUtils.HINT_ALPHA / 3,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        return hint;
    }

    public static setButtonHint(hint: GameObjects.Container, parts: HintPart[]) {
        const scene: Scene = hint.scene;
        const fontSize: number = hint.getData('fontSize');
        hint.removeAll(true);
        let width: number = 0;
        for (const part of parts) {
            const item: GameObjects.Text | GameObjects.Image = typeof part === 'string'
                ? scene.add.text(width, 0, part, {fontSize: `${fontSize}px`, color: '#fff', fontFamily: 'future'})
                : scene.add.image(width, 0, 'sprites', part.icon);
            if (item instanceof GameObjects.Image)
                item.setScale(fontSize * UiUtils.HINT_ICON_HEIGHT_RATIO / item.height);
            item.setOrigin(0, 0.5);
            hint.add(item);
            width += item.displayWidth + UiUtils.HINT_PART_GAP;
        }
        width -= UiUtils.HINT_PART_GAP;
        hint.each((item: GameObjects.Text | GameObjects.Image) => item.setX(item.x - width / 2));
    }
}
