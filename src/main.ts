import {AUTO, Game, Input, Scale, Types} from 'phaser';
import GameOverScene from "./scenes/GameOverScene.ts";
import HomeScene from "./scenes/HomeScene.ts";
import LevelUpScene from "./scenes/LevelUpScene.ts";
import MainGameScene from './scenes/MainGameScene.ts';
import MainUIScene from "./scenes/MainUIScene.ts";
import PauseScene from "./scenes/PauseScene.ts";
import EntityManager from "./managers/EntityManager.ts";
import GameInputManager from "./managers/GameInputManager.ts";
import SaveManager from "./managers/SaveManager.ts";
import GameConstants from "./GameConstants.ts";

// The same area in the window's shape: wider in landscape, taller on a long phone
function viewSize(): { width: number, height: number } {
    const aspect: number = Math.min(Math.max(window.innerWidth / window.innerHeight, GameConstants.MIN_VIEW_ASPECT),
        GameConstants.MAX_VIEW_ASPECT);
    return {
        width: Math.round(Math.sqrt(GameConstants.VIEW_AREA * aspect)),
        height: Math.round(Math.sqrt(GameConstants.VIEW_AREA / aspect))
    };
}

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    ...viewSize(),
    parent: 'game-container',
    backgroundColor: '#000',
    input: {
        keyboard: {
            capture: [
                Input.Keyboard.KeyCodes.UP, Input.Keyboard.KeyCodes.DOWN,
                Input.Keyboard.KeyCodes.LEFT, Input.Keyboard.KeyCodes.RIGHT,
                Input.Keyboard.KeyCodes.SPACE
            ]
        },
        gamepad: true
    },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
        }
    },
    plugins: {
        global: [
            {key: GameInputManager.PLUGIN_KEY, plugin: GameInputManager, mapping: GameInputManager.MAPPING_NAME},
            {key: SaveManager.PLUGIN_KEY, plugin: SaveManager, mapping: SaveManager.MAPPING_NAME}
        ],
        scene: [
            {key: EntityManager.PLUGIN_KEY, plugin: EntityManager, mapping: EntityManager.MAPPING_NAME}
        ]
    },
    // fps: { forceSetTimeOut: true, target: 120 },
    scene: [
        HomeScene,
        MainGameScene,
        MainUIScene,
        GameOverScene,
        LevelUpScene,
        PauseScene
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game(config);
    window.addEventListener('resize', () => {
        const size = viewSize();
        if (size.width === game.scale.width && size.height === game.scale.height)
            return;
        // Measure the container now: Phaser only checks it every so often, and would fit the new size to the old one
        game.scale.getParentBounds();
        game.scale.setGameSize(size.width, size.height);
    });
});
