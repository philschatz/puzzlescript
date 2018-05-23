import * as _ from 'lodash'
import { EventEmitter2 } from 'eventemitter2'
import { GameData } from './models/game'
import { LevelMap } from './models/level';
import { GameSprite, GameLegendTileSimple, IGameTile } from './models/tile'
import { GameRule } from './models/rule'
import { RULE_MODIFIER, nextRandom, setAddAll } from './util'
import { CellMutation } from './pairs';
import { GameTree, buildAndPopulateTree } from './gameTree';
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
  getSpriteAndWantsToMovesInOrder() {
    // Just pull out the sprite, not the wantsToMoveDir
    return [...this._spriteAndWantsToMoves]
    .sort(([a], [b]) => {
      return a.getCollisionLayerNum() - b.getCollisionLayerNum()
    }).reverse()
  }
  _getSpriteAndWantsToMoveForSprite(otherSprite: GameSprite) {
    return [...this._spriteAndWantsToMoves].filter(([sprite]) => sprite === otherSprite)[0]
  }
  // Maybe add updateSprite(sprite, direction)
  // Maybe add removeSprite(sprite)
  updateSprites(newSprites: Map<GameSprite, string>) {
    this._spriteAndWantsToMoves = newSprites
    this._engine.gameTree.updateCell(this, newSprites.keys())
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
    sprite.updateCellSet(this, null, true)
    // this._engine.gameTree.updateCell(this, [sprite])
  }
  addSprite(sprite: GameSprite, wantsToMove: RULE_DIRECTION) {
    const isUnchanged = this._spriteAndWantsToMoves.has(sprite)
    this._spriteAndWantsToMoves.set(sprite, wantsToMove)
    // if (!isUnchanged) {
      sprite.updateCellSet(this, wantsToMove, true)
    // }
    // this._engine.gameTree.updateCell(this, [sprite])
    return !isUnchanged
  }
  removeSprite(sprite: GameSprite) {
    const isChanged = this._spriteAndWantsToMoves.has(sprite)
    this._spriteAndWantsToMoves.delete(sprite)
    // if (isChanged) {
      sprite.updateCellSet(this, null, false)
    // }
    // this._engine.gameTree.updateCell(this, [sprite])
    return isChanged
  }
}

export default class Engine extends EventEmitter2 {
  gameData: GameData
  currentLevel: Cell[][]
  gameTree: GameTree

  constructor(gameData: GameData) {
    super()
    this.gameData = gameData
  }

  setLevel(levelNum: number) {
    debugger

    const level = this.gameData.levels[levelNum]
    if (process.env['NODE_ENV'] !== 'production') {
      level.__coverageCount++
    }
    // Clone the board because we will be modifying it
    this.currentLevel = level.getRows().map((row, rowIndex) => {
      return row.map((col, colIndex) => new Cell(this, new Set(col.getSprites()), rowIndex, colIndex))
    })

    // link up all the cells
    this.getCells().forEach(cell => {
      cell.getSpritesAsSet().forEach(sprite => {
        sprite.updateCellSet(cell, null, true)
      })
    })


    this.gameTree = buildAndPopulateTree(this.gameData, this)

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
    this.gameData.rules.map(rule => {
      if (rule.evaluate) {
        const cellMutations = rule.evaluate(this.gameTree)
        cellMutations.forEach(mutation => {
          changedCellMutations.add(mutation)
        })
      }
    })
    return changedCellMutations
  }

  tickUpdateCellsOld() {
    const changedCellMutations: Set<CellMutation> = new Set()
    // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
    this.currentLevel.forEach(row => {
      row.forEach(cell => {
        this.gameData.rules.forEach(rule => {
          let repeatsLeft = MAX_REPEATS
          // while (repeatsLeft > 0) {
            // Check if the left-hand-side of the rule matches the current cell
            const mutators = rule.getMatchedMutatorsOrNull(cell)
            if (mutators && mutators.length > 0) {
              mutators.forEach(mutator => {
                // Record coverage on the Rule
                if (process.env['NODE_ENV'] !== 'production') {
                  rule.__coverageCount++
                }
                // Change the Grid based on the rules that matched
                const mutation = mutator.mutate()
                // Keep track of which cells changed so we know which ones to look at to see if they wantsToMove
                changedCellMutations.add(mutation)
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
    return changedCellMutations
  }

  tickMoveSprites(changedCellMutations: Set<CellMutation>) {
    let movedCells: Set<Cell> = new Set()
    const changedCells = new Set([...changedCellMutations.values()].map(({cell}) => cell))
    // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
    changedCells.forEach(cell => {
      cell.getSpriteAndWantsToMoves().forEach((wantsToMove, sprite) => {

        if (wantsToMove) {
          if (wantsToMove === RULE_DIRECTION.ACTION) {
            // just clear the wantsToMove flag
            cell.clearWantsToMove(sprite)
            // movedCells.add(cell)
          } else {
            if (wantsToMove === RULE_DIRECTION.RANDOM || wantsToMove === RULE_DIRECTION.RANDOMDIR) {
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
      })
    })
    return movedCells
  }

  tick() {
    debugger
    const changedCellMutations = this.tickUpdateCells()
    const movedCells = this.tickMoveSprites(changedCellMutations)
    const changedCells = new Set([...changedCellMutations].filter(mutation => mutation.didSpritesChange).map(({cell}) => cell))
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
