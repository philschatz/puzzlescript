import * as _ from 'lodash'
import { EventEmitter2 } from 'eventemitter2'
import { GameData } from './models/game'
import { LevelMap } from './models/level';
import { GameSprite, GameLegendTileSimple, IGameTile } from './models/tile'
import { GameRule, CellMutation } from './models/rule'
import { RULE_MODIFIER, nextRandom, setAddAll, RULE_DIRECTION_ABSOLUTE } from './util'
import { RULE_DIRECTION } from './enums';

const MAX_REPEATS = 10


// This Object exists so the UI has something to bind to
export class Cell {
  _engine: Engine
  _spriteAndWantsToMoves: Map<GameSprite, string>
  rowIndex: number
  colIndex: number

  constructor(engine: Engine, sprites: Set<GameSprite>, rowIndex: number, colIndex: number) {
    this._engine = engine
    this.rowIndex = rowIndex
    this.colIndex = colIndex
    this._spriteAndWantsToMoves = new Map()

    for (const sprite of sprites) {
      this._spriteAndWantsToMoves.set(sprite, null)
    }

  }

  getSprites() {
    // Just pull out the sprite, not the wantsToMoveDir
    const sprites = [...this._spriteAndWantsToMoves.keys()]
    return sprites.sort((a, b) => {
      return a.getCollisionLayerNum() - b.getCollisionLayerNum()
    }).reverse()
  }
  getSpritesAsSet() {
    // Just pull out the sprite, not the wantsToMoveDir
    return new Set(this._spriteAndWantsToMoves.keys())
  }
  getSpriteAndWantsToMoves() {
    // Just pull out the sprite, not the wantsToMoveDir
    // Retur na new set so we can mutate it later
    return new Map(this._spriteAndWantsToMoves)
  }

  _getRelativeNeighbor(y: number, x: number) {
    const row = this._engine.currentLevel[this.rowIndex + y]
    if (!row) return null
    return row[this.colIndex + x]
  }
  getNeighbor(direction: string) {
    switch (direction) {
      case RULE_MODIFIER.UP:
        return this._getRelativeNeighbor(-1, 0)
      case RULE_MODIFIER.DOWN:
        return this._getRelativeNeighbor(1, 0)
      case RULE_MODIFIER.LEFT:
        return this._getRelativeNeighbor(0, -1)
      case RULE_MODIFIER.RIGHT:
        return this._getRelativeNeighbor(0, 1)
      default:
        console.error(`BUG: Unsupported direction "${direction}"`)
        return this
        // throw new Error(`BUG: Unsupported direction "${direction}"`)
    }
  }
  wantsToMoveTo(tile: IGameTile, absoluteDirection: RULE_DIRECTION) {
    let wantsToMove = false
    tile.getSprites().forEach(sprite => {
      const directionForSprite = this.directionForSprite(sprite)
      if (directionForSprite && directionForSprite === absoluteDirection) {
        wantsToMove = true
      }
    })
    return wantsToMove
  }
  getWantsToMove(sprite: GameSprite) {
    return this._spriteAndWantsToMoves.get(sprite)
  }
  directionForSprite(sprite: GameSprite) {
    const entry = [...this._spriteAndWantsToMoves].filter(([a]) => a.getCollisionLayerNum() === sprite.getCollisionLayerNum())[0]
    if (entry) {
      return entry[1]
    }
    return null
  }
  hasCollisionWithSprite(otherSprite: GameSprite) {
    let hasCollision = false
    this._spriteAndWantsToMoves.forEach((wantsToMove, sprite) => {
      if (sprite.getCollisionLayerNum() === otherSprite.getCollisionLayerNum()) {
        hasCollision = true
      }
    })
    return hasCollision
  }
  clearWantsToMove(sprite: GameSprite) {
    this._spriteAndWantsToMoves.set(sprite, null)
    sprite.updateCell(this, null)
  }
  addSprite(sprite: GameSprite, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
    this._spriteAndWantsToMoves.set(sprite, wantsToMove)
    sprite.addCell(this, wantsToMove)
  }
  removeSprite(sprite: GameSprite) {
    this._spriteAndWantsToMoves.delete(sprite)
    sprite.removeCell(this)
  }
  removeSprites(sprites: Iterable<GameSprite>) {
    for (const sprite of sprites) {
      this.removeSprite(sprite)
    }
  }
}

export default class Engine extends EventEmitter2 {
  gameData: GameData
  currentLevel: Cell[][]

  constructor(gameData: GameData) {
    super()
    this.gameData = gameData
  }

  setLevel(levelNum: number) {
    const level = this.gameData.levels[levelNum]
    if (process.env['NODE_ENV'] !== 'production') {
      level.__coverageCount++
    }
    // Clone the board because we will be modifying it
    this.currentLevel = level.getRows().map((row, rowIndex) => {
      return row.map((col, colIndex) => new Cell(this, new Set(col.getSprites()), rowIndex, colIndex))
    })

    // link up all the cells. Loop over all the sprites
    // in case they are NO tiles (so the cell is included)
    const batchCells: Map<string, Cell[]> = new Map()
    function spriteSetToKey(sprites: Set<GameSprite>) {
      const key = []
      for (const spriteName of [...sprites].map(sprite => sprite._name).sort()) {
        key.push(spriteName)
      }
      return key.join(' ')
    }
    const allCells = this.getCells()
    for (const cell of allCells) {
      const key = spriteSetToKey(cell.getSpritesAsSet())
      if (!batchCells.has(key)) {
        batchCells.set(key, [])
      }
      batchCells.get(key).push(cell)
    }

    // Print progress while loading up the Cells
    let i = 0
    for (const [key, cells] of batchCells) {
      if ((batchCells.size > 100 && i % 10 === 0) || cells.length > 100) {
        console.log(`Loading cells ${i}-${i + cells.length} of ${allCells.length}. SpriteKey="${key}"`)
      }
      // All Cells contain the same set of sprites so just pull out the 1st one
      for (const sprite of this.gameData.objects) {
        const cellSprites = cells[0].getSpritesAsSet()
        const hasSprite = cellSprites.has(sprite)
        if (hasSprite || sprite.hasNegationTile()) {
          if (hasSprite) {
            sprite.addCells(cells, RULE_DIRECTION_ABSOLUTE.STATIONARY)
          } else {
            sprite.removeCells(cells)
          }
        }
      }
      i += cells.length
    }

    // Return the cells so the UI can listen to when they change
    return this.getCells()
  }
  getCells() {
    return _.flatten(this.currentLevel)
  }

  toSnapshot() {
    return this.currentLevel.map(row => {
      return row.map(cell => {
        return cell.getSprites().map((sprite) => {
          return sprite._name
        })
      })
    })
  }

  tickUpdateCells() {
    const changedCellMutations: Set<CellMutation> = new Set()
    for (const rule of this.gameData.rules) {
      const cellMutations = rule.evaluate()
      for (const mutation of cellMutations) {
        changedCellMutations.add(mutation)
      }
    }

    // We may have mutated the same cell 4 times (e.g. [Player]->[>Player]) so consolidate
    const ret: Map<Cell, boolean> = new Map()
    for (const mutation of changedCellMutations) {
      if (!ret.get(mutation.cell)) {
        ret.set(mutation.cell, mutation.didSpritesChange)
      }
    }
    return ret
  }

  tickMoveSprites(changedCellMutations: Map<Cell, boolean>) {
    let movedCells: Set<Cell> = new Set()
    const changedCells = new Set([...changedCellMutations.keys()])
    // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
    for (const cell of changedCells) {
      for (let [sprite, wantsToMove] of cell.getSpriteAndWantsToMoves()) {

        if (wantsToMove) {
          if (wantsToMove === RULE_DIRECTION.ACTION) {
            // just clear the wantsToMove flag
            cell.clearWantsToMove(sprite)
          } else if (wantsToMove === RULE_DIRECTION.STATIONARY) {
            cell.clearWantsToMove(sprite)
          } else {
            if (wantsToMove === RULE_DIRECTION.RANDOMDIR) {
              const rand = nextRandom(4)
              switch (rand) {
                case 0:
                  wantsToMove = RULE_DIRECTION.UP
                  break
                case 1:
                  wantsToMove = RULE_DIRECTION.DOWN
                  break
                case 2:
                  wantsToMove = RULE_DIRECTION.LEFT
                  break
                case 3:
                  wantsToMove = RULE_DIRECTION.RIGHT
                  break
                default:
                  throw new Error(`BUG: Random number generator yielded something other than 0-3. "${rand}"`)
              }
            }
            if (wantsToMove === RULE_DIRECTION.RANDOM) {
              throw new Error('BUG: should have converted RANDOM to something else earlier')
            }
            const neighbor = cell.getNeighbor(wantsToMove)
            // Make sure
            if (neighbor && !neighbor.hasCollisionWithSprite(sprite)) {
              cell.removeSprite(sprite)
              neighbor.addSprite(sprite, null)
              movedCells.add(neighbor)
              movedCells.add(cell)
            } else {
              // Clear the wantsToMove flag if we hit a wall (a sprite in the same collisionLayer) or are at the end of the map
              cell.clearWantsToMove(sprite)
              // movedCells.add(cell)
            }
          }
        }
      }
    }
    return movedCells
  }

  tick() {
    const changedCellMutations = this.tickUpdateCells()
    const movedCells = this.tickMoveSprites(changedCellMutations)
    const changedCells = new Set([...changedCellMutations.entries()].filter(([_cell, didSpritesChange]) => didSpritesChange).map(([cell]) => cell))
    return setAddAll(changedCells, movedCells)
  }

  pressUp() { }
  pressDown() { }
  pressLeft() { }
  pressRight() { }
  pressAction() { }
  pressUndo() { }
  pressRestart() { }
}
