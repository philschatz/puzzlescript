import * as _ from 'lodash'
import { EventEmitter2 } from 'eventemitter2'
import { LevelMap, GameData, GameLegendTileSimple, IGameTile, RuleModifier} from './parser';

function setEquals<T> (set1: Set<T>, set2: Set<T>) {
  if (set1.size !== set2.size) return false
  for (var elem of set1) {
    if (!set2.has(elem)) return false
  }
  return true
}

// This Object exists so the UI has something to bind to
export class Cell {
  _engine: Engine
  _sprites: Set<IGameTile>
  rowIndex: number
  colIndex: number

  constructor (engine: Engine, sprites: Set<IGameTile>, rowIndex: number, colIndex: number) {
    this._engine = engine
    this._sprites = sprites
    this.rowIndex = rowIndex
    this.colIndex = colIndex
  }

  getSprites () {
    return [...this._sprites].sort((a, b) => {
      return a.getCollisionLayerNum() - b.getCollisionLayerNum()
    }).reverse()
  }
  getSpritesAsSet () {
    return this._sprites
  }
  updateSprites (newSetOfSprites: Set<IGameTile>) {
    this._sprites = newSetOfSprites
    this._engine.emit('cell:updated', this)
  }
  equalsSprites (newSetOfSprites: Set<IGameTile>) {
    return setEquals(this._sprites, newSetOfSprites)
  }
  _getRelativeNeighbor (y: number, x: number) {
    const row = this._engine.currentLevel[this.rowIndex + y]
    if (!row) return null
    return row[this.colIndex + x]
  }
  getNeighbor (direction: string) {
    switch (direction) {
      case RuleModifier.UP:
        return this._getRelativeNeighbor(-1, 0)
      case RuleModifier.DOWN:
        return this._getRelativeNeighbor(1, 0)
      case RuleModifier.LEFT:
        return this._getRelativeNeighbor(0, -1)
      case RuleModifier.RIGHT:
        return this._getRelativeNeighbor(0, 1)
      default:
        throw new Error(`BUG: Unsupported direction "${direction}"`)
    }
  }
}

export default class Engine extends EventEmitter2 {
  gameData: GameData
  currentLevel: Cell[][]

  constructor (gameData: GameData) {
    super()
    this.gameData = gameData
  }

  setLevel (levelNum: number) {
    const level = this.gameData.levels[levelNum]
    // Clone the board because we will be modifying it
    this.currentLevel = level.getRows().map((row, rowIndex) => {
      return row.map((col, colIndex) => new Cell(this, new Set(col.getSprites()), rowIndex, colIndex))
    })
    // Return the cells so the UI can listen to when they change
    return _.flattenDeep(this.currentLevel)
  }

  tick () {
    let rulesAndChanges = new Map()
    // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
    this.currentLevel.forEach(row => {
      row.forEach(cell => {
        this.gameData.rules.forEach(rule => {
          if (!rule.isValidRule()) return
          // Check if the left-hand-side of the rule matches the current cell
          const mutators = _.flattenDeep(rule.getMatchedMutatorsOrNull(cell) || [])
          if (mutators.length > 0) {
            if (!rulesAndChanges.has(rule)) {
              rulesAndChanges.set(rule, [])
            }
            mutators.forEach(mutator => {
              // Change the Grid based on the rules that matched
              const changes = mutator.mutate()
              // Add it to the set of changes
              rulesAndChanges.set(rule, rulesAndChanges.get(rule).concat(changes.filter(change => !!change))) // Some rules only have actions and return null. Remove those from the set
            })
          }
        })
      })
    })
    return rulesAndChanges
  }

  pressUp () { }
  pressDown () { }
  pressLeft () { }
  pressRight () { }
  pressAction () { }
  pressUndo () { }
  pressRestart () { }
}
