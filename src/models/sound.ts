import { BaseForLines, IGameCode } from './game'
import { IGameTile } from './tile'
import {playSound, closeSounds as closeSounds2} from '../sounds';

export function closeSounds() {
    closeSounds2()
}

// Abstract class
export class GameSound extends BaseForLines {
    private readonly soundCode: number

    constructor(source: IGameCode, soundCode: number) {
        super(source)
        this.soundCode = soundCode
    }

    async play() {
        return playSound(this.soundCode)
    }
}

export class GameSoundSfx extends GameSound {
    readonly sfxName: string

    constructor(source: IGameCode, sfxName: string, soundCode: number) {
        super(source, soundCode)
        this.sfxName = sfxName
    }
}

export class GameSoundSimpleEnum extends GameSound {
    readonly simpleEventName: number

    constructor(source: IGameCode, simpleEventName: number, soundCode: number) {
        super(source, soundCode)
        this.simpleEventName = simpleEventName
    }
}

// TODO: Link this up to the Object, rather than just storing the spriteName
export class GameSoundNormal extends GameSound {
    readonly tile: IGameTile
    readonly conditionEnum: string

    constructor(source: IGameCode, sprite: IGameTile, conditionEnum: string, soundCode: number) {
        super(source, soundCode)
        this.tile = sprite
        this.conditionEnum = conditionEnum
    }
}

export class GameSoundMoveSimple extends GameSound {
    readonly tile: IGameTile

    constructor(source: IGameCode, sprite: IGameTile, soundCode: number) {
        super(source, soundCode)
        this.tile = sprite
    }
}

export class GameSoundMoveDirection extends GameSound {
    readonly tile: IGameTile
    readonly directionEnum: string

    constructor(source: IGameCode, sprite: IGameTile, directionEnum: string, soundCode: number) {
        super(source, soundCode)
        this.tile = sprite
        this.directionEnum = directionEnum
    }
}
