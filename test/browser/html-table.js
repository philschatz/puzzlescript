/* eslint-env browser */
const { TableUI, keymaster, playSound } = window.PuzzleScript

const table = document.querySelector('#thegamecanbeidentifiedbyselector')
const tableUI = new TableUI(table)

let currentLevel = 0
// tableUI.setGame(gameSource)
// tableUI.setLevel(currentLevel)

// Set the key handlers
keymaster('up, w', () => tableUI.pressUp())
keymaster('down, s', () => tableUI.pressDown())
keymaster('left, a', () => tableUI.pressLeft())
keymaster('right, d', () => tableUI.pressRight())
keymaster('space, x', () => tableUI.pressAction())
keymaster('z, u', () => tableUI.pressUndo())
keymaster('r', () => tableUI.pressRestart())

async function runLoop () {
    const {
        // changedCells,
        didLevelChange,
        didWinGame,
        messageToShow,
        soundToPlay
        // wasAgainTick
    } = tableUI.tick()

    if (soundToPlay) {
    /* await */ playSound(soundToPlay) // let sounds play while the game loads or player keeps moving
    }
    if (didWinGame) {
        alert(`You Won!`)
        cancelAnimationFrame(timer)
    } else if (didLevelChange) {
        currentLevel += 2 // skip the message level
        tableUI.setLevel(currentLevel)
    } else if (messageToShow) {
        alert(messageToShow)
    }
    timer = window.requestAnimationFrame(runLoop)
}

let timer

window.HackTableUI = tableUI
window.HackTableUIStartGame = (source, initialLevel) => {
    tableUI.setGame(source)
    tableUI.setLevel(initialLevel)
    currentLevel = initialLevel
    timer = window.requestAnimationFrame(runLoop)
}
window.HackTableUIStop = () => {
    clearTimeout(timer)
}
