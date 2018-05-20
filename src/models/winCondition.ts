import { BaseForLines, IGameCode } from './game'

export class WinConditionSimple extends BaseForLines {
    _qualifierEnum: string
    _spriteName: string

    constructor(source: IGameCode, qualifierEnum: string, spriteName: string) {
        super(source)
        this._qualifierEnum = qualifierEnum
        this._spriteName = spriteName
    }
}

export class WinConditionOn extends WinConditionSimple {
    _onSprite: string

    constructor(source: IGameCode, qualifierEnum: string, spriteName: string, onSprite: string) {
        super(source, qualifierEnum, spriteName)
        this._onSprite = onSprite
    }
}