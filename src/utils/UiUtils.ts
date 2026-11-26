import {GameObjects, Scene} from "phaser";

export type UiFrame = 'ui_header_blade_red' | 'ui_header_blade_green' | 'ui_header_blade_blue';

type Slices = { left: number; right: number; top: number; bottom: number };

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

    // Clear of the header's rivet
    private static readonly HEADER_TITLE_X: number = 56;
    private static readonly HEADER_TITLE_SIZE: string = '36px';
    // Longer titles shrink to keep the same gap before the band's slant as after the rivet
    private static readonly HEADER_TITLE_MAX_WIDTH: number = 200;
    private static readonly BAR_CAP_WIDTH: number = 24;
    private static readonly HINT_ALPHA: number = 0.7;

    public static addPanel(scene: Scene, x: number, y: number, width: number, height: number,
                           frame: UiFrame): GameObjects.NineSlice {
        const slices: Slices = SLICES[frame];
        const scale: number = UiUtils.PANEL_SCALE;
        return scene.add.nineslice(x, y, "sprites", frame, width / scale, height / scale,
            slices.left, slices.right, slices.top, slices.bottom).setScale(scale);
    }

    // The title in a panel's coloured header band, from the panel's left and top edges
    public static addHeaderTitle(scene: Scene, panelLeft: number, panelTop: number, text: string): GameObjects.Text {
        const title: GameObjects.Text = scene.add.text(panelLeft + UiUtils.HEADER_TITLE_X,
            panelTop + UiUtils.HEADER_HEIGHT / 2, text,
            {fontSize: UiUtils.HEADER_TITLE_SIZE, color: '#fff', fontFamily: 'future'}).setOrigin(0, 0.5);
        return title.setScale(Math.min(1, UiUtils.HEADER_TITLE_MAX_WIDTH / title.width));
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
}
