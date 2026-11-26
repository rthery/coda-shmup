import {Data} from 'phaser';

export default class RegistryConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_SCORE: 'playerScore',
        PLAYER_COMBO: 'playerCombo',
        // 0 to 1, towards the next combo step
        PLAYER_COMBO_PROGRESS: 'playerComboProgress',
        PLAYER_LEVEL: 'playerLevel',
        IS_NEW_BEST_SCORE: 'isNewBestScore'
    } as const);

    public static readonly Events = Object.freeze({
        PLAYER_SCORE_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.PLAYER_SCORE,
        PLAYER_COMBO_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.PLAYER_COMBO,
        PLAYER_COMBO_PROGRESS_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.PLAYER_COMBO_PROGRESS
    } as const);
}