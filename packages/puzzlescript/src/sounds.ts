import { Soundish } from './parser/astTypes'
import { closeSounds, playSound as playSoundCode } from './sound/sfxr'

async function playSound(sound: Soundish) {
    return playSoundCode(sound.soundCode)
}

export { playSound, closeSounds }
