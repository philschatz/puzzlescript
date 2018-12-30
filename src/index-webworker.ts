import { GameEngine } from './engine'
import Parser from './parser/parser'
import Serializer from './parser/serializer'
import { INPUT_BUTTON, MESSAGE_TYPE, Optional, shouldTick, TypedMessageEvent, WorkerMessage, WorkerResponse } from './util'

declare var postMessage: (msg: WorkerResponse) => void

let currentEngine: Optional<GameEngine> = null
let gameLoop: Optional<NodeJS.Timeout> = null
let lastTick = 0

onmessage = (event: TypedMessageEvent<WorkerMessage>) => {
    const response: WorkerResponse = handleMessage(event)
    postMessage(response)
}

const handleMessage = (event: TypedMessageEvent<WorkerMessage>): WorkerResponse => {
    const msg = event.data
    switch (msg.type) {
        case MESSAGE_TYPE.LOAD_GAME: return { type: msg.type, payload: loadGame(msg.code, msg.level) }
        case MESSAGE_TYPE.PAUSE: return { type: msg.type, payload: pauseGame() }
        case MESSAGE_TYPE.RESUME: return { type: msg.type, payload: resumeGame() }
        case MESSAGE_TYPE.PRESS: return { type: msg.type, payload: press(msg.button) }
        case MESSAGE_TYPE.CLOSE: return { type: msg.type, payload: closeGame() }
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
    gameLoop = setInterval(() => {
        if (shouldTick(getEngine().getGameData().metadata, lastTick)) {
            lastTick = Date.now()
            postMessage({ type: MESSAGE_TYPE.TICK, payload: tick() })
        }
    }, 20)
}

const loadGame = (code: string, level: number) => {
    const { data } = Parser.parse(code)
    currentEngine = new GameEngine(data)
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

const tick = () => {
    const { changedCells, soundToPlay, messageToShow, didWinGame, didLevelChange, wasAgainTick } = getEngine().tick()
    // Response needs to be serializable
    return {
        changedCells: [...changedCells.values()].map((cell) => {
            const { colIndex, rowIndex } = cell
            return {
                colIndex,
                rowIndex,
                spriteNames: cell.getSprites().map((sprite) => sprite.getName())
            }
        }),
        soundToPlay: soundToPlay ? soundToPlay.soundCode : null,
        messageToShow,
        didWinGame,
        didLevelChange,
        wasAgainTick
    }
}

const press = (button: INPUT_BUTTON) => {
    return getEngine().press(button)
}

const closeGame = () => {
    pauseGame()
    currentEngine = null
}
