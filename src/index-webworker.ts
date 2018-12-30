import { GameEngine } from './engine'
import Parser from './parser/parser'
import { Optional, INPUT_BUTTON, TypedMessageEvent, WorkerMessage, MESSAGE_TYPE, WorkerResponse } from './util'
import Serializer from './parser/serializer';

declare var postMessage: (msg: WorkerResponse) => void

let currentEngine: Optional<GameEngine> = null


onmessage = function(event: TypedMessageEvent<WorkerMessage>) {
  const response: WorkerResponse = handleMessage(event)
  postMessage(response)
}

const handleMessage = (event: TypedMessageEvent<WorkerMessage>): WorkerResponse => {
  const msg = event.data
  switch(msg.type) {
    case MESSAGE_TYPE.LOAD_GAME: return {type: msg.type, payload: loadGame(msg.code, msg.level)}
    case MESSAGE_TYPE.TICK: return {type: msg.type, payload: tick()}
    case MESSAGE_TYPE.PRESS: return {type: msg.type, payload: press(msg.button)}
    case MESSAGE_TYPE.CLOSE: return {type: msg.type, payload: closeGame()}
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

const loadGame = (code: string, level: number) => {
  const {data} = Parser.parse(code)
  currentEngine = new GameEngine(data)
  currentEngine.setLevel(level)
  return (new Serializer(data)).toJson()
}

const tick = () => {
  const {changedCells, soundToPlay, messageToShow, didWinGame, didLevelChange, wasAgainTick} = getEngine().tick()
  // Response needs to be serializable
  return {
    changedCells: [...changedCells.values()].map(cell => {
      return cell.getSprites().map(sprite => sprite.getName())
    }),
    soundToPlay: soundToPlay ? soundToPlay.soundCode : null,
    messageToShow,
    didWinGame,
    didLevelChange,
    wasAgainTick,
  }
}

const press = (button: INPUT_BUTTON) => {
  return getEngine().press(button)
}

const closeGame = () => {
  currentEngine = null
}