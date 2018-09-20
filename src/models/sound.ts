import { BaseForLines, IGameCode } from './BaseForLines'
import { IGameTile } from './tile'

// Abstract class
export class GameSound extends BaseForLines {
    public readonly soundCode: number

    constructor(source: IGameCode, soundCode: number) {
        super(source)
        this.soundCode = soundCode
    }
}

export class GameSoundSfx extends GameSound {
    public readonly sfxName: string

    constructor(source: IGameCode, sfxName: string, soundCode: number) {
        super(source, soundCode)
        this.sfxName = sfxName
    }
}

export class GameSoundSimpleEnum extends GameSound {
    public readonly simpleEventName: string

    constructor(source: IGameCode, simpleEventName: string, soundCode: number) {
        super(source, soundCode)
        this.simpleEventName = simpleEventName
    }
}

// TODO: Link this up to the Object, rather than just storing the spriteName
export class GameSoundNormal extends GameSound {
    public readonly tile: IGameTile
    public readonly conditionEnum: string

    constructor(source: IGameCode, sprite: IGameTile, conditionEnum: string, soundCode: number) {
        super(source, soundCode)
        this.tile = sprite
        this.conditionEnum = conditionEnum
    }
}

export class GameSoundMoveSimple extends GameSound {
    public readonly tile: IGameTile

    constructor(source: IGameCode, sprite: IGameTile, soundCode: number) {
        super(source, soundCode)
        this.tile = sprite
    }
}

export class GameSoundMoveDirection extends GameSound {
    public readonly tile: IGameTile
    public readonly directionEnum: string

    constructor(source: IGameCode, sprite: IGameTile, directionEnum: string, soundCode: number) {
        super(source, soundCode)
        this.tile = sprite
        this.directionEnum = directionEnum
    }
}
