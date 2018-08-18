const table = document.querySelector('table')
console.log(window.PuzzleScript)
const {Parser, GameEngine} = window.PuzzleScript
const {data} = Parser.parse(`title Trivial Game

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

`)
console.log('oerituoeiruteroiu')
const {spriteHeight, spriteWidth} = data.getSpriteSize()

const engine = new GameEngine(data)
engine.pressRight()
engine.setLevel(0)

const levelCells = engine.getCurrentLevelCells()
// Draw the level
// Draw the empty table
for (let rowIndex = 0; rowIndex < spriteHeight * levelCells.length; rowIndex++) {
    const tr = document.createElement('tr')
    table.appendChild(tr)
    for (let colIndex = 0; colIndex < spriteWidth * levelCells[0].length; colIndex++) {
        const td = document.createElement('td')
        tr.appendChild(td)
    }
}

const {changedCells} = engine.tick()
for (const cell of changedCells) {
    const {rowIndex, colIndex} = cell
    const td = table.querySelector(`tr:nth-of-type(${rowIndex}) td:nth-of-type(${colIndex})`)

    if (!td) {
        throw new Error(`BUG: Missing <td> ${rowIndex}, ${colIndex}`)
    }
}