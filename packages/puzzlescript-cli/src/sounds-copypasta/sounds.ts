import { closeSounds, playSound as playSoundCode } from './sfxr'

type Soundish = {
    soundCode: number
}

async function playSound(sound: Soundish) {
    return playSoundCode(sound.soundCode)
}

export { playSound, closeSounds }
