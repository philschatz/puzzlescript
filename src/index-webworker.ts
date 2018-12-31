import { GameEngine } from './engine'
import Parser from './parser/parser'
import Serializer from './parser/serializer'
import { INPUT_BUTTON, MESSAGE_TYPE, Optional, shouldTick, TypedMessageEvent, WorkerMessage, WorkerResponse, GameEngineHandler, Cellish, CellishJson } from './util'
import { Soundish } from './parser/astTypes';

declare var postMessage: (msg: WorkerResponse) => void

let currentEngine: Optional<GameEngine> = null
let gameLoop: Optional<NodeJS.Timeout> = null
let lastTick = 0

onmessage = (event: TypedMessageEvent<WorkerMessage>) => {
    const response = handleMessage(event)
    if (response) {
        postMessage(response)
    }
}

const handleMessage = (event: TypedMessageEvent<WorkerMessage>): Optional<WorkerResponse> => {
    const msg = event.data
    switch (msg.type) {
        case MESSAGE_TYPE.LOAD_GAME: return { type: msg.type, payload: loadGame(msg.code, msg.level) }
        case MESSAGE_TYPE.PAUSE: return { type: msg.type, payload: pauseGame() }
        case MESSAGE_TYPE.RESUME: return { type: msg.type, payload: resumeGame() }
        case MESSAGE_TYPE.PRESS: return { type: msg.type, payload: press(msg.button) }
        case MESSAGE_TYPE.CLOSE: return { type: msg.type, payload: closeGame() }
        case MESSAGE_TYPE.ON_MESSAGE_DONE: 
            dismissedMessage = true
            return null
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
    gameLoop = setInterval(async() => {
        if (shouldTick(getEngine().getGameData().metadata, lastTick)) {
            lastTick = Date.now()
            await tick()
            // postMessage({ type: MESSAGE_TYPE.TICK, payload })
        }
    }, 20)
}

// Polls until a condition is true
function pollingPromise<T>(ms: number, fn: () => boolean) {
    const p = new Promise<T>(resolve => {
        let timer = setInterval(() => {
            if (fn()) {
                clearInterval(timer)
                resolve()
            }
        }, ms)
    })
    return p
}


let dismissedMessage = false

class Handler implements GameEngineHandler {
    public onPress(dir: INPUT_BUTTON) {
        if (!dir) {
            throw new Error(`BUG: No direction provided to onPress`)
        }
        postMessage({type: MESSAGE_TYPE.ON_PRESS, direction: dir})
    }
    public async onMessage(msg: string) {
        dismissedMessage = false
        pauseGame()
        postMessage({type: MESSAGE_TYPE.ON_MESSAGE, message: msg})
        // Wait until the user dismissed the message
        await pollingPromise<void>(50, () => dismissedMessage)
        resumeGame()
    }
    public onLevelChange(level: number, cells: Optional<Cellish[][]>, message: Optional<string>) {
        let newCells: Optional<CellishJson[][]> = null
        if (cells) {
            newCells = cells.map(row => toCellJson(row))
        }
        postMessage({type: MESSAGE_TYPE.ON_LEVEL_CHANGE, level, cells: newCells, message})
    }
    public onWin() {
        postMessage({type: MESSAGE_TYPE.ON_WIN})
    }
    public async onSound(sound: Soundish) {
        postMessage({type: MESSAGE_TYPE.ON_SOUND, soundCode: sound.soundCode})
    }
    public onTick(changedCells: Set<Cellish>, hasAgain: boolean) {
        postMessage({type: MESSAGE_TYPE.ON_TICK, changedCells: toCellJson(changedCells), hasAgain})
    }
}

const loadGame = (code: string, level: number) => {
    const { data } = Parser.parse(code)
    currentEngine = new GameEngine(data, new Handler())
    currentEngine.setLevel(level)
    startPlayLoop()
    return (new Serializer(data)).toJson()
}

const pauseGame = () => {
    gameLoop !== null && clearInterval(gameLoop)
}

const resumeGame = () => {
    pauseGame()
    startPlayLoop()
}

const tick = async() => {
    const engine = getEngine()
    const { changedCells, soundToPlay, messageToShow, didWinGame, didLevelChange, wasAgainTick } = await engine.tick()
    // Response needs to be serializable
    return {
        changedCells: toCellJson(changedCells),
        soundToPlay: soundToPlay ? soundToPlay.soundCode : null,
        messageToShow,
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
