const EventEmitter2 = require('eventemitter2')
const _ = require('lodash')

function setEquals(set1, set2) {
  if (set1.size !== set2.size) return false
  for (var elem of set1) {
    if (!set2.has(elem)) return false
  }
  return true
}

// This Object exists so the UI has something to bind to
class Cell {
  constructor (emitter, sprites, rowIndex, colIndex) {
    this._emitter = emitter
    this._sprites = sprites
    this.rowIndex = rowIndex
    this.colIndex = colIndex
  }

  getSprites () {
    return [...this._sprites] // TODO: sort this by collisionlayer so they render properly on top of each other
  }
  getSpritesAsSet () {
    return this._sprites
  }
  updateSprites (newSetOfSprites) {
    this._sprites = newSetOfSprites
    this._emitter.emit('cell:updated', this)
  }
  equalsSprites (newSetOfSprites) {
    return setEquals(this._sprites, newSetOfSprites)
  }
}

module.exports = class Engine extends EventEmitter2 {
  constructor (gameData) {
    super()
    this.gameData = gameData
  }

  setLevel (levelNum) {
    const level = this.gameData.levels[levelNum]
    // Clone the board because we will be modifying it
    this.currentLevel = level.getRows().map((row, rowIndex) => {
      return row.map((col, colIndex) => new Cell(this, new Set(col.getSprites()), rowIndex, colIndex))
    })
    // Return the cells so the UI can listen to when they change
    return _.flatten(this.currentLevel)
  }

  tick () {
    let changes = []
    // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
    this.currentLevel.forEach(row => {
      row.forEach(cell => {
        this.gameData.rules.forEach(rule => {
          // Check if the left-hand-side of the rule matches the current cell
          const matches = rule.getActionsIfMatchedOrNull(cell)
          if (matches) {
            // Do the rule!
            const updatedCells = rule.mutate(cell)
            changes = changes.concat(updatedCells)
          }
        })
      })
    })
    return _.flatten(changes).filter(change => !!change) // Some rules only have actions and return null. Remove those from the set
  }

  pressUp () { }
  pressDown () { }
  pressLeft () { }
  pressRight () { }
  pressAction () { }
  pressUndo () { }
  pressRestart () { }
}
