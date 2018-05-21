import * as _ from 'lodash'
import { EventEmitter2 } from 'eventemitter2'
import { GameData } from './models/game'
import { LevelMap } from './models/level';
import { GameSprite, GameLegendTileSimple, IGameTile } from './models/tile'
import { GameRule } from './models/rule'
import { RULE_MODIFIER, nextRandom } from './util'
import { Pair } from './pairs';

const MAX_REPEATS = 10

function setEquals<T>(set1: Set<T>, set2: Set<T>) {
  if (set1.size !== set2.size) return false
  for (var elem of set1) {
    if (!set2.has(elem)) return false
  }
  return true
}

enum RULE_DIRECTION {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  ACTION = 'ACTION',
  RANDOM = 'RANDOM'
}

// This Object exists so the UI has something to bind to
export class Cell {
  _engine: Engine
  _spriteAndWantsToMoves: Set<Pair<GameSprite, string>>
  rowIndex: number
  colIndex: number

  constructor(engine: Engine, sprites: Set<GameSprite>, rowIndex: number, colIndex: number) {
    this._engine = engine
    this._spriteAndWantsToMoves = new Set([...sprites].map(sprite => new Pair(sprite, null)))
    this.rowIndex = rowIndex
    this.colIndex = colIndex
  }

  getSprites() {
    // Just pull out the sprite, not the wantsToMoveDir
    const sprites = [...this._spriteAndWantsToMoves].map(({a, b}) => a)
    return sprites.sort((a, b) => {
      return a.getCollisionLayerNum() - b.getCollisionLayerNum()
    }).reverse()
  }
  getSpritesAsSet() {
    // Just pull out the sprite, not the wantsToMoveDir
    const sprites = [...this._spriteAndWantsToMoves].map(({a, b}) => a)
    return new Set(sprites)
  }
  getSpriteAndWantsToMoves() {
    // Just pull out the sprite, not the wantsToMoveDir
    // Retur na new set so we can mutate it later
    return new Set(this._spriteAndWantsToMoves)
  }
  getSpriteAndWantsToMovesInOrder() {
    // Just pull out the sprite, not the wantsToMoveDir
    return [...this._spriteAndWantsToMoves]
    .sort(({a: a}, {a: b}) => {
      return a.getCollisionLayerNum() - b.getCollisionLayerNum()
    }).reverse()
  }
  _getSpriteAndWantsToMoveForSprite(otherSprite: GameSprite) {
    return [...this._spriteAndWantsToMoves].filter(({a: sprite}) => sprite === otherSprite)[0]
  }
  // Maybe add updateSprite(sprite, direction)
  // Maybe add removeSprite(sprite)
  updateSprites(newSetOfSprites: Set<Pair<GameSprite, string>>) {
    this._spriteAndWantsToMoves = newSetOfSprites
    this._engine.emit('cell:updated', this)
    return true // maybe check if the sprites were the same before so there is less to update visually
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
        throw new Error(`BUG: Unsupported direction "${direction}"`)
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
  directionForSprite(sprite: GameSprite) {
    const entry = [...this._spriteAndWantsToMoves].filter(({a}) => a.getCollisionLayerNum() === sprite.getCollisionLayerNum())[0]
    if (entry) {
      return entry.b
    }
    return null
  }
  hasCollisionWithSprite(otherSprite: GameSprite) {
    let hasCollision = false
    this._spriteAndWantsToMoves.forEach(({a: sprite}) => {
      if (sprite.getCollisionLayerNum() === otherSprite.getCollisionLayerNum()) {
        hasCollision = true
      }
    })
    return hasCollision
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
    // Clone the board because we will be modifying it
    this.currentLevel = level.getRows().map((row, rowIndex) => {
      return row.map((col, colIndex) => new Cell(this, new Set(col.getSprites()), rowIndex, colIndex))
    })
    // Return the cells so the UI can listen to when they change
    return _.flattenDeep(this.currentLevel)
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
    let rulesAndChanges: Map<GameRule, Cell[]> = new Map()
    // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
    this.currentLevel.forEach(row => {
      row.forEach(cell => {
        this.gameData.rules.forEach(rule => {
          let repeatsLeft = MAX_REPEATS
          // while (repeatsLeft > 0) {
            // Check if the left-hand-side of the rule matches the current cell
            const mutators = rule.getMatchedMutatorsOrNull(cell)
            if (mutators && mutators.length > 0) {
              if (!rulesAndChanges.has(rule)) {
                rulesAndChanges.set(rule, [])
              }
              mutators.forEach(mutator => {
                // Change the Grid based on the rules that matched
                const changes = mutator.mutate()
                // Add it to the set of changes
                rulesAndChanges.set(rule, rulesAndChanges.get(rule).concat(changes.filter(change => !!change))) // Some rules only have actions and return null. Remove those from the set
              })
            // } else {
            //   break
            }
            repeatsLeft -= 1
          // }
          // if (repeatsLeft === 0) {
          //   throw new Error('MAX_REPEATS were exhausted. Maybe this is an infinite loop?')
          // }
        })
      })
    })
    return rulesAndChanges
  }

  tickMoveSprites() {
    let movedCells: Set<Cell> = new Set()
    // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
    this.currentLevel.forEach(row => {
      row.forEach(cell => {

        cell.getSpriteAndWantsToMoves().forEach(spriteAndWantsToMove => {
          const {a: sprite} = spriteAndWantsToMove
          let wantsToMove = spriteAndWantsToMove.b // So we can change it when it is "RANDOM"

          if (wantsToMove) {
            if (wantsToMove === RULE_DIRECTION.ACTION) {
              // just clear the wantsToMove flag
              spriteAndWantsToMove.b = null
              movedCells.add(cell)
            } else {
              if (wantsToMove === RULE_DIRECTION.RANDOM) {
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
              const neighbor = cell.getNeighbor(wantsToMove)
              // Make sure
              if (neighbor && !neighbor.hasCollisionWithSprite(sprite)) {
                cell._spriteAndWantsToMoves.delete(spriteAndWantsToMove)
                neighbor._spriteAndWantsToMoves.add(new Pair(sprite, null))
                movedCells.add(neighbor)
              } else {
                // Clear the wantsToMove flag if we hit a wall (a sprite in the same collisionLayer) or are at the end of the map
                spriteAndWantsToMove.b = null
              }
              movedCells.add(cell)
            }
          }
        })
      })
    })
    return movedCells
  }

  tick() {
    const appliedRules = this.tickUpdateCells()
    const movedCells = this.tickMoveSprites()
    return {appliedRules, movedCells}
  }

  pressUp() { }
  pressDown() { }
  pressLeft() { }
  pressRight() { }
  pressAction() { }
  pressUndo() { }
  pressRestart() { }
}
