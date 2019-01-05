import { GameEngine } from './engine'
import { Soundish } from './parser/astTypes'
import Parser from './parser/parser'
import Serializer from './parser/serializer'
import { Cellish, CellishJson, GameEngineHandler, INPUT_BUTTON, MESSAGE_TYPE, Optional, pollingPromise, shouldTick, TypedMessageEvent, WorkerMessage, WorkerResponse } from './util'

declare var postMessage: (msg: WorkerResponse) => void

let currentEngine: Optional<GameEngine> = null
let gameLoop: Optional<NodeJS.Timeout> = null
let lastTick = 0

onmessage = (event: TypedMessageEvent<WorkerMessage>) => {
    const msg = event.data
    switch (msg.type) {
        case MESSAGE_TYPE.LOAD_GAME: loadGame(msg.code, msg.level); break
        case MESSAGE_TYPE.PAUSE: postMessage({ type: msg.type, payload: pauseGame() }); break
        case MESSAGE_TYPE.RESUME: postMessage({ type: msg.type, payload: resumeGame() }); break
        case MESSAGE_TYPE.PRESS: postMessage({ type: msg.type, payload: press(msg.button) }); break
        case MESSAGE_TYPE.CLOSE: postMessage({ type: msg.type, payload: closeGame() }); break
        case MESSAGE_TYPE.ON_MESSAGE_DONE:
            dismissedMessage = true
            break
        default:
            throw new Error(`ERROR: Unsupported webworker message type "${JSON.stringify(event.data)}"`)
    }
}

const getEngine = () => {
    if (!currentEngine) {
        throw new Error(`Game has not been loaded yet`)
    }
    return currentEngine
}

const startPlayLoop = () => {
    if (gameLoop !== null) {
        console.log(`BUG: Webworker is already running`)
        clearInterval(gameLoop)
    }
    gameLoop = setInterval(async() => {
        if (shouldTick(getEngine().getGameData().metadata, lastTick)) {
            lastTick = Date.now()
            await tick()
            // postMessage({ type: MESSAGE_TYPE.TICK, payload })
        }
    }, 20)
}

let dismissedMessage = false

class Handler implements GameEngineHandler {
    public onPress(dir: INPUT_BUTTON) {
        if (!dir) {
            throw new Error(`BUG: No direction provided to onPress`)
        }
        postMessage({ type: MESSAGE_TYPE.ON_PRESS, direction: dir })
    }
    public async onMessage(msg: string) {
        dismissedMessage = false
        pauseGame()
        postMessage({ type: MESSAGE_TYPE.ON_MESSAGE, message: msg })
        // Wait until the user dismissed the message
        await pollingPromise<boolean>(50, () => dismissedMessage)
        resumeGame()
    }
    public onLevelChange(level: number, cells: Optional<Cellish[][]>, message: Optional<string>) {
        let newCells: Optional<CellishJson[][]> = null
        if (cells) {
            newCells = cells.map((row) => toCellJson(row))
        }
        postMessage({ type: MESSAGE_TYPE.ON_LEVEL_CHANGE, level, cells: newCells, message })
    }
    public onWin() {
        postMessage({ type: MESSAGE_TYPE.ON_WIN })
    }
    public async onSound(sound: Soundish) {
        postMessage({ type: MESSAGE_TYPE.ON_SOUND, soundCode: sound.soundCode })
    }
    public onTick(changedCells: Set<Cellish>, hasAgain: boolean) {
        postMessage({ type: MESSAGE_TYPE.ON_TICK, changedCells: toCellJson(changedCells), hasAgain })
    }
    public onPause() {
        postMessage({ type: MESSAGE_TYPE.ON_PAUSE })
    }
    public onResume() {
        postMessage({ type: MESSAGE_TYPE.ON_RESUME })
    }
}

const loadGame = (code: string, level: number) => {
    pauseGame()
    const { data } = Parser.parse(code)
    postMessage({ type: MESSAGE_TYPE.LOAD_GAME, payload: (new Serializer(data)).toJson() })
    currentEngine = new GameEngine(data, new Handler())
    currentEngine.setLevel(level)
    startPlayLoop()
}

const pauseGame = () => {
    if (gameLoop !== null) {
        clearInterval(gameLoop)
        gameLoop = null
        postMessage({ type: MESSAGE_TYPE.ON_PAUSE })
    }
}

const resumeGame = () => {
    pauseGame()
    startPlayLoop()
    postMessage({ type: MESSAGE_TYPE.ON_RESUME })
}

const tick = async() => {
    const engine = getEngine()
    const { changedCells, didWinGame, didLevelChange, wasAgainTick } = await engine.tick()
    // Response needs to be serializable
    return {
        changedCells: toCellJson(changedCells),
        didWinGame,
        didLevelChange,
        wasAgainTick
    }
}

function toCellJson(cells: Iterable<Cellish>): CellishJson[] {
    return [...cells].map((cell) => {
        const { colIndex, rowIndex } = cell
        return {
            colIndex,
            rowIndex,
            spriteNames: cell.getSprites().map((sprite) => sprite.getName())
        }
    })
}

const press = (button: INPUT_BUTTON) => {
    return getEngine().press(button)
}

const closeGame = () => {
    pauseGame()
    currentEngine = null
}
