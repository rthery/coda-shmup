export default class SaveConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_BEST_SCORE: 'playerBestScore',
        // How many players made the best score
        PLAYER_BEST_SCORE_PLAYERS: 'playerBestScorePlayers',
        IS_MUSIC_ON: 'isMusicOn',
        ARE_SOUND_EFFECTS_ON: 'areSoundEffectsOn'
    } as const);
}