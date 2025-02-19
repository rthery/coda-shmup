import { MainGameScene } from './scenes/MainGameScene.ts';
import { AUTO, Game, Scale, Types } from 'phaser';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1080,
    height: 1920,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    // fps: { forceSetTimeOut: true, target: 120 },
    scene: [
        MainGameScene
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    new Game(config);
});