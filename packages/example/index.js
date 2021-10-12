const PuzzleScript = require('puzzlescript-web')
const gameSourceString = require('puzzlescript/games/entanglement-one/script.txt')
// window.PuzzleScript is also now available

const table = document.querySelector('table') // selector to the <table> that will be used
const optionalEventHandler = {
    // onMessage:      (...args) => console.log('[async onMessage]', ...args),
    // onSound:        (...args) => console.log('[async onSound]', ...args),
    onGameChange:   (...args) => console.log('[onGameChange]', ...args),
    onPress:        (...args) => console.log('[onPress]', ...args),
    onLevelLoad:    (...args) => console.log('[onLevelLoad]', ...args),
    onLevelChange:  (...args) => console.log('[onLevelChange]', ...args),
    onWin:          (...args) => console.log('[onWin]', ...args),
    onTick:         (...args) => console.log('[onTick]', ...args),
    onPause:        (...args) => console.log('[onPause]', ...args),
    onResume:       (...args) => console.log('[onResume]', ...args),
}

const engine = new PuzzleScript.SyncTableEngine(table, optionalEventHandler)
engine.setGame(gameSourceString, 0 /*startLevel*/, /*optSaveData*/)
