const gameSource = `
title Trivial Game

===
OBJECTS
===

Background .
gray

Player P
yellow
00000
00000
00000
00000
00000

===
COLLISIONLAYERS
===

Background
Player

===
LEVELS
===

....
.P..
....

`

const {Parser, GameEngine, TableUI, keymaster} = window.PuzzleScript
const table = document.querySelector('table')

console.log(window.PuzzleScript)
const {data} = Parser.parse(gameSource)
const {spriteHeight, spriteWidth} = data.getSpriteSize()

const engine = new GameEngine(data)

const tableUI = new TableUI(table)
tableUI.setGame(engine)

engine.setLevel(0)

keymaster('up, w', () => engine.pressUp())
keymaster('down, s', () => engine.pressDown())
keymaster('left, a', () => engine.pressLeft())
keymaster('right, d', () => engine.pressRight())
keymaster('space, x', () => engine.pressAction())
keymaster('z, u', () => engine.pressUndo())
keymaster('r', () => engine.pressRestart())


const levelCells = engine.getCurrentLevelCells()
// Draw the level
// Draw the empty table
for (let rowIndex = 0; rowIndex < spriteHeight * levelCells.length; rowIndex++) {
    const tr = document.createElement('tr')
    table.appendChild(tr)
    for (let colIndex = 0; colIndex < spriteWidth * levelCells[0].length; colIndex++) {
        const td = document.createElement('td')
        td.textContent = '\xa0\xa0' // &nbsp;&nbsp;
        tr.appendChild(td)
    }
}

for (const row of levelCells) {
    tableUI.drawCells(row)
}

function runLoop() {
    const {changedCells} = engine.tick()
    tableUI.drawCells(changedCells)
}

setInterval(runLoop, 30)
