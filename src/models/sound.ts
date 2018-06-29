import { BaseForLines, IGameCode } from './game'
import { IGameTile, GameSprite } from './tile'
import {playSound, closeSounds as closeSounds2} from '../sounds';

export function closeSounds() {
    closeSounds2()
}

// Abstract class
export class GameSound extends BaseForLines {
    _soundCode: number

    constructor(source: IGameCode, soundCode: number) {
        super(source)
        this._soundCode = soundCode
    }

    async play() {
        return playSound(this._soundCode)
    }
}

export class GameSoundSfx extends GameSound {
    _sfxName: string

    constructor(source: IGameCode, sfxName: string, soundCode: number) {
        super(source, soundCode)
        this._sfxName = sfxName
    }
}

export class GameSoundSimpleEnum extends GameSound {
    _simpleEventName: number

    constructor(source: IGameCode, simpleEventName: number, soundCode: number) {
        super(source, soundCode)
        this._simpleEventName = simpleEventName
    }
}

// TODO: Link this up to the Object, rather than just storing the spriteName
export class GameSoundNormal extends GameSound {
    _sprite: GameSprite
    _conditionEnum: string

    constructor(source: IGameCode, sprite: GameSprite, conditionEnum: string, soundCode: number) {
        super(source, soundCode)
        this._sprite = sprite
        this._conditionEnum = conditionEnum
    }
}

export class GameSoundMoveSimple extends GameSound {
    _sprite: IGameTile

    constructor(source: IGameCode, sprite: IGameTile, soundCode: number) {
        super(source, soundCode)
        this._sprite = sprite
    }
}

export class GameSoundMoveDirection extends GameSound {
    _sprite: GameSprite
    _directionEnum: string

    constructor(source: IGameCode, sprite: GameSprite, directionEnum: string, soundCode: number) {
        super(source, soundCode)
        this._sprite = sprite
        this._directionEnum = directionEnum
    }
}
