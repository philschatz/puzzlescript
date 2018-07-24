import {playSound as playSoundCode, closeSounds} from '../puzzlescript/js/sfxr'
import { GameSound } from './models/sound';

async function playSound(sound: GameSound) {
    return playSoundCode(sound.soundCode)
}

export { playSound, closeSounds }