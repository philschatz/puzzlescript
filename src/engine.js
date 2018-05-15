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
  constructor (sprites, rowIndex, colIndex) {
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

    this.__dirty = true
    this._sprites = newSetOfSprites
  }
  equalsSprites (newSetOfSprites) {
    return setEquals(this._sprites, newSetOfSprites)
  }
}

module.exports = class Engine /* extends EventEmitter */ {
  constructor (gameData) {
    this.gameData = gameData
  }

  setLevel (levelNum) {
    const level = this.gameData.levels[levelNum]
    // Clone the board because we will be modifying it
    this.currentLevel = level.getRows().map((row, rowIndex) => {
      return row.map((col, colIndex) => new Cell(new Set(col.getSprites()), rowIndex, colIndex))
    })
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
