import { BaseForLines, IGameCode } from './game'
import { GameSprite } from './tile'

// TODO: Use the Objects rather than just the names
let _collisionId = 0
export class CollisionLayer extends BaseForLines {
    _sprites: GameSprite[]
    id: number // Used for sorting collision layers for rendering

    constructor(source: IGameCode, sprites: GameSprite[]) {
        super(source)
        this._sprites = sprites
        this.id = _collisionId++
    }

    isInvalid(): string {
        return null
    }
}