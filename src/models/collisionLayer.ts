import { BaseForLines, IGameCode } from './game'
import { GameSprite } from './tile'

// TODO: Use the Objects rather than just the names
export class CollisionLayer extends BaseForLines {
    _sprites: GameSprite[]

    constructor(source: IGameCode, sprites: GameSprite[]) {
      super(source)
      this._sprites = sprites
    }
    isInvalid(): string {
      return null
    }
  }