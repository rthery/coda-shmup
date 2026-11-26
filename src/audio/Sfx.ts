import {Loader, Scene, Sound} from "phaser";
import type SaveManager from "../managers/SaveManager.ts";
import SaveConstants from "../SaveConstants.ts";

type SoundData = {
    // Files are Sounds/<file>_<0..count-1>.ogg, one is picked at random each time
    file: string;
    count: number;
    volume: number;
    // Plays at most once per interval, so a burst of events doesn't pile up
    minInterval: number; // ms
};

export type SoundName =
    'laser' | 'enemyHit' | 'explosion' | 'hullHit' | 'playerDeath' | 'shieldDown' | 'shieldUp' | 'repair' |
    'xpPickup' | 'levelUp' | 'cardSelect' | 'cardPick' | 'comboUp' | 'comboBreak' | 'threatAlarm' |
    'gameOver' | 'scoreTick' | 'newBest' | 'start' | 'launch' | 'uiConfirm';

export type PlayOptions = {
    detune?: number; // cents
    volumeScale?: number;
};

// Kenney sci-fi, impact and interface sounds, plus the Space Shooter bonus shield and lose sounds
const SOUNDS: Record<SoundName, SoundData> = {
    laser: {file: 'laser', count: 4, volume: 0.25, minInterval: 0},
    enemyHit: {file: 'enemy_hit', count: 3, volume: 0.25, minInterval: 40},
    explosion: {file: 'explosion', count: 5, volume: 0.3, minInterval: 60},
    hullHit: {file: 'hull_hit', count: 1, volume: 0.8, minInterval: 100},
    playerDeath: {file: 'player_death', count: 1, volume: 0.9, minInterval: 0},
    shieldDown: {file: 'shield_down', count: 1, volume: 1, minInterval: 100},
    shieldUp: {file: 'shield_up', count: 1, volume: 0.9, minInterval: 0},
    repair: {file: 'repair', count: 1, volume: 0.5, minInterval: 0},
    // Stars come in bursts (up to 5 per kill at max combo): quiet, and at most a few per second
    xpPickup: {file: 'xp_pickup', count: 1, volume: 0.1, minInterval: 150},
    levelUp: {file: 'level_up', count: 1, volume: 0.5, minInterval: 0},
    cardSelect: {file: 'card_select', count: 1, volume: 0.4, minInterval: 0},
    cardPick: {file: 'card_pick', count: 1, volume: 0.4, minInterval: 0},
    comboUp: {file: 'combo_up', count: 1, volume: 0.35, minInterval: 0},
    comboBreak: {file: 'combo_break', count: 1, volume: 0.45, minInterval: 0},
    threatAlarm: {file: 'threat_alarm', count: 1, volume: 0.5, minInterval: 0},
    gameOver: {file: 'game_over', count: 1, volume: 0.6, minInterval: 0},
    scoreTick: {file: 'score_tick', count: 1, volume: 0.25, minInterval: 50},
    newBest: {file: 'new_best', count: 1, volume: 0.5, minInterval: 0},
    start: {file: 'start', count: 1, volume: 0.4, minInterval: 0},
    launch: {file: 'launch', count: 1, volume: 0.45, minInterval: 0},
    uiConfirm: {file: 'ui_confirm', count: 1, volume: 0.4, minInterval: 0},
};

// The WebAudio and HTML5 sounds Phaser creates can be muted, BaseSound's type doesn't say so
type MuteableSound = Sound.WebAudioSound | Sound.HTML5AudioSound;

const MUSIC_KEY: string = 'music';
const MUSIC_VOLUME: number = 0.35;

// One place to load and play every sound effect and the music
export default class Sfx {
    // Real time, shared by every scene: the sound manager is global too
    private static readonly _lastPlayTimes: Map<SoundName, number> = new Map();
    // Player settings, saved: both on by default
    private static _isMusicOn: boolean = true;
    private static _areEffectsOn: boolean = true;

    public static get isMusicOn(): boolean {
        return Sfx._isMusicOn;
    }

    public static get areEffectsOn(): boolean {
        return Sfx._areEffectsOn;
    }

    public static loadSettings(saveManager: SaveManager) {
        Sfx._isMusicOn = saveManager.getData(SaveConstants.Keys.IS_MUSIC_ON) ?? true;
        Sfx._areEffectsOn = saveManager.getData(SaveConstants.Keys.ARE_SOUND_EFFECTS_ON) ?? true;
    }

    public static setMusicOn(scene: Scene, saveManager: SaveManager, isOn: boolean) {
        Sfx._isMusicOn = isOn;
        saveManager.setData(SaveConstants.Keys.IS_MUSIC_ON, isOn);
        (scene.sound.get(MUSIC_KEY) as MuteableSound | null)?.setMute(!isOn);
    }

    public static setEffectsOn(saveManager: SaveManager, isOn: boolean) {
        Sfx._areEffectsOn = isOn;
        saveManager.setData(SaveConstants.Keys.ARE_SOUND_EFFECTS_ON, isOn);
    }

    public static preload(load: Loader.LoaderPlugin) {
        (Object.values(SOUNDS)).forEach(sound => {
            for (let i = 0; i < sound.count; i++)
                load.audio(`sfx_${sound.file}_${i}`, `Sounds/${sound.file}_${i}.ogg`);
        });
        // MintoDog, "Space Battle", CC0 (opengameart.org/content/space-battle)
        load.audio(MUSIC_KEY, 'Sounds/music_space_battle.ogg');
    }

    public static play(scene: Scene, name: SoundName, options: PlayOptions = {}) {
        if (!Sfx._areEffectsOn)
            return;
        const sound: SoundData = SOUNDS[name];
        const now: number = performance.now();
        if (now - (Sfx._lastPlayTimes.get(name) ?? -Infinity) < sound.minInterval)
            return;
        Sfx._lastPlayTimes.set(name, now);

        const variant: number = Phaser.Math.Between(0, sound.count - 1);
        scene.sound.play(`sfx_${sound.file}_${variant}`, {
            volume: sound.volume * (options.volumeScale ?? 1),
            detune: options.detune ?? 0
        });
    }

    // Starts the looping music once, it then plays across every scene
    public static startMusic(scene: Scene) {
        const music: Sound.BaseSound = scene.sound.get(MUSIC_KEY) ?? scene.sound.add(MUSIC_KEY, {loop: true});
        Sfx.fadeMusic(scene, 1, 500);
        if (!music.isPlaying)
            music.play({loop: true, volume: MUSIC_VOLUME});
        // Keeps playing muted, so turning it back on doesn't restart the track
        (music as MuteableSound).setMute(!Sfx._isMusicOn);
    }

    // scale: 1 for the normal level, lower to step back behind a screen like game over
    public static fadeMusic(scene: Scene, scale: number, duration: number) {
        const music = scene.sound.get(MUSIC_KEY) as Sound.WebAudioSound | Sound.HTML5AudioSound | null;
        if (!music)
            return;
        scene.tweens.add({targets: music, volume: MUSIC_VOLUME * scale, duration});
    }
}
