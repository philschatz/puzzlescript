const EventEmitter2 = require('eventemitter2')

// This Object exists so the UI has something to bind to
class Cell {
  constructor (sprites) {
    this._sprites = sprites
  }

  getSprites () {
    return [...this._sprites] // TODO: sort this by collisionlayer so they render properly on top of each other
  }
  getSpritesAsSet () {
    return this._sprites
  }
}

module.exports = class Engine /* extends EventEmitter */ {
  constructor (gameData) {
    this.gameData = gameData
  }

  setLevel (levelNum) {
    const level = this.gameData.levels[levelNum]
    // Clone the board because we will be modifying it
    this.currentLevel = level.getRows().map(row => {
      return row.map(col => new Cell(new Set(col.getSprites())))
    })
  }

  tick () {
    const changes = []
    // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
    this.currentLevel.forEach(row => {
      row.forEach(cell => {
        this.gameData.rules.forEach(rule => {
          // Check if the left-hand-side of the rule matches the current cell
          const reasonForNotMatching = rule.doesntMatchCell(cell)
          if (reasonForNotMatching) {
            // console.log('The cell has:')
            // console.log(cell.toString());
            // console.log('Skipping the rule because of', reasonForNotMatching.toString());
          } else {
            // Do the rule!
            console.log('Applying the rule', rule.toString())
          }
        })
      })
    })
    return changes
  }

  pressUp () { }
  pressDown () { }
  pressLeft () { }
  pressRight () { }
  pressAction () { }
  pressUndo () { }
  pressRestart () { }
}
