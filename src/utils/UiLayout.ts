import {GameObjects, Geom, Scale, Scene, Scenes} from "phaser";

// The HUD and the menus are laid out on a portrait frame, zoomed to fit the screen whatever its shape
export default class UiLayout {
    public static readonly WIDTH: number = 1080;
    public static readonly HEIGHT: number = 1920;

    // Menus center the frame. The HUD pins it to the top left and spreads over the extra width
    public static fitCamera(scene: Scene, isCentered: boolean) {
        const zoom: number = UiLayout.frameZoom(scene);
        const scrollX: number = isCentered ? -(scene.scale.width / zoom - UiLayout.WIDTH) / 2 : 0;
        const scrollY: number = isCentered ? -(scene.scale.height / zoom - UiLayout.HEIGHT) / 2 : 0;
        scene.cameras.main.setOrigin(0).setZoom(zoom).setScroll(scrollX, scrollY);
    }

    // Scale at which the whole frame fits on screen
    public static frameZoom(scene: Scene): number {
        return Math.min(scene.scale.width / UiLayout.WIDTH, scene.scale.height / UiLayout.HEIGHT);
    }

    // The UI area on screen, at least the frame: wider on a landscape screen, taller on a long phone
    public static visibleArea(scene: Scene): Geom.Rectangle {
        const camera = scene.cameras.main;
        return new Geom.Rectangle(camera.scrollX, camera.scrollY,
            scene.scale.width / camera.zoom, scene.scale.height / camera.zoom);
    }

    // Keeps a menu's frame centered and its backdrops, like a dim, over the whole screen
    public static fitMenu(scene: Scene, ...backdrops: (GameObjects.Rectangle | GameObjects.TileSprite)[]) {
        UiLayout.onResize(scene, () => {
            UiLayout.fitCamera(scene, true);
            const area: Geom.Rectangle = UiLayout.visibleArea(scene);
            backdrops.forEach(backdrop => backdrop.setPosition(area.x, area.y).setSize(area.width, area.height));
        });
    }

    // Runs now and after each resize, until the scene shuts down
    public static onResize(scene: Scene, layout: () => void) {
        layout();
        scene.scale.on(Scale.Events.RESIZE, layout);
        scene.events.once(Scenes.Events.SHUTDOWN, () => scene.scale.off(Scale.Events.RESIZE, layout));
    }
}
