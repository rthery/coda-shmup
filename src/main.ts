import { MainGameScene } from './scenes/MainGameScene.ts';
import { AUTO, Game, Scale } from 'phaser';
import type { Types } from 'phaser';

//  Find out more information about the GameConfig at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
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
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
        }
    },
    // fps: { forceSetTimeOut: true, target: 120 },
    scene: [
        MainGameScene
    ]
};

export default new Game(config);
