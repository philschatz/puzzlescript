import { GameData } from '../models/game'
import { GameSprite } from '../models/tile'
import { LEVEL_TYPE } from '../parser/astTypes'
import Serializer from '../parser/serializer'
import TableUI from '../ui/table'
import { Cellish, EmptyGameEngineHandler, Engineish, filterNulls, GameEngineHandlerOptional, INPUT_BUTTON, MESSAGE_TYPE, Optional, pollingPromise, PuzzlescriptWorker, RULE_DIRECTION, WorkerResponse } from '../util'
import InputWatcher from './inputWatcher'
import ResizeWatcher from './resizeWatcher'

class ProxyCellish implements Cellish {
    public readonly rowIndex: number
    public readonly colIndex: number
    public sprites: GameSprite[]

    constructor(rowIndex: number, colIndex: number, sprites: GameSprite[]) {
        this.rowIndex = rowIndex
        this.colIndex = colIndex
        this.sprites = sprites
    }
    public getSprites() {
        return this.sprites
    }
    public getSpritesAsSet() {
        return new Set(this.sprites)
    }
    public getWantsToMove() {
        return RULE_DIRECTION.STATIONARY
    }
}

export default class WebworkerTableEngine implements Engineish {
    private readonly worker: PuzzlescriptWorker
    private readonly table: HTMLTableElement
    private readonly ui: TableUI
    private readonly handler: EmptyGameEngineHandler
    private readonly resizeWatcher: ResizeWatcher
    private readonly inputWatcher: InputWatcher
    private inputInterval: number

    private cellCache: ProxyCellish[][]
    private levelNum: number
    private gameData: Optional<GameData>

    constructor(worker: PuzzlescriptWorker, table: HTMLTableElement, handler?: GameEngineHandlerOptional) {
        this.worker = worker
        this.table = table

        // cache
        this.cellCache = []
        this.levelNum = -123456
        this.gameData = null

        const that = this
        this.ui = new (class CustomTableUI extends TableUI {
            public async onMessage(msg: string) {
                return pollingPromise<void>(10, () => {
                    if (that.inputWatcher.isSomethingPressed()) {
                        return false
                    }
                    alert(msg)
                    return true
                })
            }
        })(table)
        this.handler = new EmptyGameEngineHandler(handler ? [this.ui, handler] : [this.ui])
        this.resizeWatcher = new ResizeWatcher(table, this.handleResize.bind(this))
        this.inputWatcher = new InputWatcher()

        table.addEventListener('blur', this.pause.bind(this))
        table.addEventListener('focus', this.resume.bind(this))

        worker.addEventListener('message', this.messageListener.bind(this))
        this.inputInterval = window.setInterval(() => {
            const button = this.inputWatcher.pollControls()
            if (button) {
                this.press(button)
            }
        }, 10)
    }
    public setGame(code: string, level: number) {
        this.worker.postMessage({ type: MESSAGE_TYPE.LOAD_GAME, code, level })
    }

    public dispose() {
        this.resizeWatcher.dispose()
        clearInterval(this.inputInterval)
    }

    public press(button: INPUT_BUTTON) {
        this.worker.postMessage({ type: MESSAGE_TYPE.PRESS, button })
    }

    public pause() {
        this.worker.postMessage({ type: MESSAGE_TYPE.PAUSE })
    }

    public resume() {
        this.worker.postMessage({ type: MESSAGE_TYPE.RESUME })
    }

    private async messageListener({ data }: {data: WorkerResponse}) {
        console.log(`Received from worker: ${data.type}`, data)
        switch (data.type) {
            case MESSAGE_TYPE.LOAD_GAME:
                const gameData = Serializer.fromJson(data.payload, '**source not included because of laziness**')
                this.gameData = gameData
                this.ui.setGameData(gameData)
                break
            case MESSAGE_TYPE.ON_LEVEL_CHANGE:
                this.cellCache = [] // clear the cache since the level dimensions are different
                this.levelNum = data.level
                if (data.cells) {
                    this.handler.onLevelChange(data.level, data.cells.map((row) => row.map((x) => this.convertToCellish(x))), null)
                } else {
                    this.handler.onLevelChange(data.level, null, data.message)
                }
                this.resizeWatcher.resizeHandler()
                this.table.focus()
                break
            case MESSAGE_TYPE.ON_MESSAGE:
                await this.handler.onMessage(data.message)
                this.worker.postMessage({ type: MESSAGE_TYPE.ON_MESSAGE_DONE })
                this.table.focus()
                break
            case MESSAGE_TYPE.ON_PRESS:
                this.handler.onPress(data.direction)
                break
            case MESSAGE_TYPE.ON_TICK:
                this.handler.onTick(new Set(data.changedCells.map((x) => this.convertToCellish(x))), data.hasAgain)
                break
            case MESSAGE_TYPE.ON_SOUND:
                this.handler.onSound({soundCode: data.soundCode})
                break
            case MESSAGE_TYPE.ON_PAUSE:
                this.handler.onPause()
                break
            case MESSAGE_TYPE.ON_RESUME:
                this.handler.onResume()
                break
            
            case MESSAGE_TYPE.TICK:
                break // less console noise
            default:
                console.log(`BUG: Unhandled Event occurred`, data) // tslint:disable-line:no-console
        }
    }

    private convertToCellish(c: {rowIndex: number, colIndex: number, spriteNames: string[]}) {
        const { rowIndex, colIndex, spriteNames } = c

        // Lazy-initialize all the proxy cells
        if (!this.cellCache[rowIndex]) {
            this.cellCache[rowIndex] = []
        }
        if (!this.cellCache[rowIndex][colIndex]) {
            this.cellCache[rowIndex][colIndex] = new ProxyCellish(rowIndex, colIndex, [])
        }

        this.cellCache[rowIndex][colIndex].sprites = filterNulls(spriteNames.map((name) => {
            if (!this.getGameData()._getSpriteByName(name)) {
                console.log(`Could not find sprite "${name}"`)
            }
            return this.getGameData()._getSpriteByName(name) // could be null
        })) // filter out all the sprites that could not be found

        return this.cellCache[rowIndex][colIndex]
    }

    private getGameData() {
        if (!this.gameData) {
            throw new Error(`BUG: Game Data has not been retreived from the worker yet`)
        }
        return this.gameData
    }
    private isCurrentLevelAMessage() {
        return this.getGameData().levels[this.levelNum].type === LEVEL_TYPE.MESSAGE
    }
    private handleResize(width: number) {
        if (!this.isCurrentLevelAMessage()) {
            this.table.setAttribute('style', `width: ${width}px;`)
        }
    }
}
