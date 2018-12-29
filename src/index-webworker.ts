import { GameEngine } from './engine'
import Parser from './parser/parser'
import { Optional, INPUT_BUTTON, TypedMessageEvent, WorkerMessage, MESSAGE_TYPE, WorkerResponse } from './util'
import Serializer from './parser/serializer';

let currentEngine: Optional<GameEngine> = null

debugger

onmessage = function(event: TypedMessageEvent<WorkerMessage>) {
  debugger
  const response: WorkerResponse = handleMessage(event)
  this.postMessage(response, 'targetOrigin')
}

const handleMessage = (event: TypedMessageEvent<WorkerMessage>): WorkerResponse => {
  const msg = event.data
  switch(msg.type) {
    case MESSAGE_TYPE.LOAD_GAME: return {type: msg.type, payload: loadGame(msg.code)}
    case MESSAGE_TYPE.SET_LEVEL: return {type: msg.type, payload: setLevel(msg.levelNum)}
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

const loadGame = (code: string) => {
  const {data} = Parser.parse(code)
  currentEngine = new GameEngine(data)
  return (new Serializer(data)).toJson()
}

const setLevel = (levelNum: number) => {
  return getEngine().setLevel(levelNum)
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