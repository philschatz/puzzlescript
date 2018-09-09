import { GameSound } from './models/sound'
import { closeSounds, playSound as playSoundCode } from './sound/sfxr'

async function playSound(sound: GameSound) {
    return playSoundCode(sound.soundCode)
}

export { playSound, closeSounds }
