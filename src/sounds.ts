import { IGameTile } from './models/tile'
import { SoundItem } from './parser/astTypes'
import { closeSounds, playSound as playSoundCode } from './sound/sfxr'

async function playSound(sound: SoundItem<IGameTile>) {
    return playSoundCode(sound.soundCode)
}

export { playSound, closeSounds }
