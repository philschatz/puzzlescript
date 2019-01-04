import { Button, BUTTON_TYPE, Gamepad, Keyboard, or } from 'contro'
import { Cell, GameEngine, ILoadingCellsEvent } from './engine'
import { GameData } from './models/game'
import Parser from './parser/parser'
import Serializer from './parser/serializer'
import { closeSounds, playSound } from './sounds'
import BaseUI from './ui/base'
import TableUI from './ui/table'
import { Optional, RULE_DIRECTION, INPUT_BUTTON, GameEngineHandlerOptional, pollingPromise, EmptyGameEngineHandler, Cellish, PuzzlescriptWorker, MESSAGE_TYPE, WorkerResponse, filterNulls } from './util'
import { LEVEL_TYPE, Soundish } from './parser/astTypes';
import { GameSprite } from './models/tile';

// Public API
export {
    Parser,
    Serializer,
    GameEngine,
    Cell,
    ILoadingCellsEvent,
    GameData,
    Optional,
    RULE_DIRECTION,
    BaseUI,
    TableUI,
    playSound,
    closeSounds
}

interface Control<T> {
    up: T,
    down: T,
    left: T,
    right: T,
    action: T,
    undo: T,
    restart: T
}

export class TableEngine {
    private inputWatcher: InputWatcher
    public tableUI: TableUI
    public engine: Optional<GameEngine>
    private timer: number

    constructor(table: HTMLTableElement, optionalHandler?: GameEngineHandlerOptional) {
        this.inputWatcher = new InputWatcher()

        this.timer = 0
        this.engine = null

        const handler = optionalHandler ? new EmptyGameEngineHandler([optionalHandler]) : new EmptyGameEngineHandler([])

        // TODO: wait until user is no longer pressing anything before
        // showing the alert().
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1346228
        const that = this // tslint:disable-line:no-this-assignment
        this.tableUI = new (class CustomTableUI extends TableUI {

            onPress(dir: INPUT_BUTTON) { super.onPress(dir); handler.onPress(dir) }
            onLevelChange(level: number, cells: Optional<Cellish[][]>, message: Optional<string>) { super.onLevelChange(level, cells, message); handler.onLevelChange(level, cells, message)}
            onWin() { super.onWin(); handler.onWin() }
            async onSound(sound: Soundish) { await super.onSound(sound); await handler.onSound(sound)}
            onTick(changedCells: Set<Cellish>, hasAgain: boolean) { super.onTick(changedCells, hasAgain); handler.onTick(changedCells, hasAgain)}
        
            public async onMessage(msg: string) {
                await handler.onMessage(msg)
                return pollingPromise<void>(10, () => {
                    if (that.inputWatcher.isSomethingPressed()) {
                        return false
                    }
                    alert(msg)
                    return true
                })
            }
        })(table)
    }

    public setGame(code: string, levelNum?: number) {
        const { data } = Parser.parse(code)
        this.engine = new GameEngine(data, this.tableUI)

        this.tableUI.setGameData(data)
        if (data.metadata.keyRepeatInterval) {
            this.inputWatcher.setKeyRepeatInterval(data.metadata.keyRepeatInterval)
        }
        if (levelNum !== undefined) {
            this.engine.setLevel(levelNum)
        }
    }

    public setEngine(engine: GameEngine) {
        this.engine = engine
        // this.tableUI.setGameData(engine.getGameData())
    }

    public async setLevel(levelNum: number) {
        await this.getEngine().setLevel(levelNum)
    }

    public start() {
        this.startTickHandler()
    }

    public stop() {
        cancelAnimationFrame(this.timer)
    }

    public startTickHandler() {
        const runLoop = async() => {
            const pendingKey = this.inputWatcher.pollControls()
            if (pendingKey) {
                this.engine && this.engine.press(pendingKey)
            }
            await this.getEngine().tick()
            this.timer = window.requestAnimationFrame(runLoop)
        }

        this.timer = window.requestAnimationFrame(runLoop)
    }

    public getEngine() {
        if (!this.engine) {
            throw new Error(`BUG: Engine has not been created yet`)
        }
        return this.engine
    }

}

export class TableEngine2 {
    private readonly table: HTMLTableElement
    private readonly resizeWatcher: ResizeWatcher
    private readonly subEngine: TableEngine

    constructor(table: HTMLTableElement, handler: GameEngineHandlerOptional) {
        this.table = table
        this.subEngine = new TableEngine(table, handler)
        this.resizeWatcher = new ResizeWatcher(table, this.handleResize.bind(this))
    }
    private handleResize(width: number) {
        if (!this.subEngine.getEngine().isCurrentLevelAMessage()) {
            this.table.setAttribute('style', `width: ${width}px;`)
        }
    }
    public setGame(source: string, level: number = 0) {
        this.subEngine.setGame(source, level)

        // TODO: Do this whenever the level changes
        // TODO: This needs to account for the viewable window as well
        const engine = this.subEngine.getEngine()
        if (engine.getCurrentLevel().type === LEVEL_TYPE.MAP) {
            const currentLevel = engine.getCurrentLevelCells()
            this.resizeWatcher.setLevel(currentLevel.length, currentLevel[0].length)
        }
        this.subEngine.start()
    }
    public dispose() {
        this.subEngine.stop()
        this.resizeWatcher.dispose()
    }
}

class ResizeWatcher {
    private readonly table: HTMLTableElement
    private readonly handler: (width: number) => void
    private readonly boundResizeHandler: any
    private columns: number
    private rows: number

    constructor(table: HTMLTableElement, handler: (width: number) => void) {
        this.table = table
        this.handler = handler
        this.columns = 1
        this.rows = 1
        this.boundResizeHandler = this.resizeHandler.bind(this)

        window.addEventListener('resize', this.boundResizeHandler)
    }

    setLevel(rows: number, columns: number) {
        this.rows = rows
        this.columns = columns
    }

    resizeHandler() {
        // Resize the table so that it fits.
        const levelRatio = this.columns / this.rows
        // Figure out if the width or the height is the limiting factor
        const availableWidth = window.innerWidth - this.table.offsetLeft
        const availableHeight = window.innerHeight - this.table.offsetTop
        let newWidth = 0
        if (availableWidth / availableHeight < levelRatio) {
            // Width is the limiting factor
            newWidth = availableWidth / levelRatio
        } else {
            // Height is the limiting factor
            newWidth = availableHeight * levelRatio
        }
        this.handler(Math.floor(newWidth))
    }   
    
    dispose() {
        window.removeEventListener('resize', this.boundResizeHandler)
    }
}

class InputWatcher {
    private polledInput: Optional<INPUT_BUTTON>
    private repeatIntervalInSeconds: Optional<number>
    private gamepad: Gamepad
    private controls: Control<{button: Button, lastPressed: Optional<number>}>
    private controlCheckers: Array<() => void>

    constructor() {
        const keyboard = new Keyboard()
        this.gamepad = new Gamepad()
        this.polledInput = null
        this.repeatIntervalInSeconds = null

        this.controls = {
            up: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_UP), keyboard.key('w')) },
            down: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_DOWN), keyboard.key('s')) },
            left: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_LEFT), keyboard.key('a')) },
            right: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_RIGHT), keyboard.key('d')) },
            action: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.CLUSTER_BOTTOM), keyboard.key('x'), keyboard.key('Space')) },
            undo: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.CLUSTER_LEFT), this.gamepad.button(BUTTON_TYPE.BUMPER_TOP_LEFT), keyboard.key('z'), keyboard.key('u')) },
            restart: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.CLUSTER_TOP), keyboard.key('r')) }
        }
        const makeChecker = (control: keyof Control<Button>, gameAction: () => void) => {
            return () => {
                const now = Date.now()
                const interval = this.repeatIntervalInSeconds || .25
                const { button, lastPressed } = this.controls[control]
                if (button.query()) {
                    if (!lastPressed || (lastPressed + interval * 1000) < now) {
                        gameAction()
                        this.controls[control].lastPressed = now
                    }
                } else {
                    this.controls[control].lastPressed = null
                }
            }
        }

        this.controlCheckers = [
            makeChecker('up', () => this.polledInput = INPUT_BUTTON.UP),
            makeChecker('down', () => this.polledInput = INPUT_BUTTON.DOWN),
            makeChecker('left', () => this.polledInput = INPUT_BUTTON.LEFT),
            makeChecker('right', () => this.polledInput = INPUT_BUTTON.RIGHT),
            makeChecker('action', () => this.polledInput = INPUT_BUTTON.ACTION),
            makeChecker('undo', () => this.polledInput = INPUT_BUTTON.UNDO),
            makeChecker('restart', () => this.polledInput = INPUT_BUTTON.RESTART)
        ]
    }

    public pollControls() {
        this.polledInput = null
        this.controlCheckers.forEach((fn) => fn())
        const input = this.polledInput
        this.polledInput = null
        return input
    }

    // TODO: This might not be needed. pollControls() might be sufficient
    public isSomethingPressed() {
        for (const entry of Object.values(this.controls)) {
            if (entry.button.query()) {
                return true
            }
        }
        return false
    }

    public setKeyRepeatInterval(repeatIntervalInSeconds: number) {
        this.repeatIntervalInSeconds = repeatIntervalInSeconds
    }

}

class ProxyCellish implements Cellish {
    public readonly rowIndex: number
    public readonly colIndex: number
    public sprites: GameSprite[]

    constructor(rowIndex: number, colIndex: number, sprites: GameSprite[]) {
        this.rowIndex = rowIndex
        this.colIndex = colIndex
        this.sprites = sprites
    }
    getSprites() {
        return this.sprites
    }
    getSpritesAsSet() {
        return new Set(this.sprites)
    }
    getWantsToMove() {
        return RULE_DIRECTION.STATIONARY
    }
}

export class WebworkerTableEngine {
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

    constructor(worker: PuzzlescriptWorker, table: HTMLTableElement, handler: GameEngineHandlerOptional) {
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
        this.handler = new EmptyGameEngineHandler([this.ui, handler])
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
    setGame(code: string, level: number) {
        this.worker.postMessage({type: MESSAGE_TYPE.LOAD_GAME, code, level})
    }

    dispose() {
        this.resizeWatcher.dispose()
        clearInterval(this.inputInterval)
    }

    press(button: INPUT_BUTTON) {
        this.worker.postMessage({type: MESSAGE_TYPE.PRESS, button})
    }

    pause() {
        this.worker.postMessage({type: MESSAGE_TYPE.PAUSE})
    }

    resume() {
        this.worker.postMessage({type: MESSAGE_TYPE.RESUME})
    }

    private async messageListener ({data} : {data: WorkerResponse}) {
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
                    this.handler.onLevelChange(data.level, data.cells.map(row => row.map((x) => this.convertToCellish(x))), null)
                } else {
                    this.handler.onLevelChange(data.level, null, data.message)
                }
                this.resizeWatcher.resizeHandler()
                this.table.focus()
                break
            case MESSAGE_TYPE.ON_MESSAGE:
                await this.handler.onMessage(data.message)
                this.worker.postMessage({ type: MESSAGE_TYPE.ON_MESSAGE_DONE})
                this.table.focus()
                break
            case MESSAGE_TYPE.ON_PRESS:
                this.handler.onPress(data.direction)
                break
            case MESSAGE_TYPE.ON_TICK:
                this.handler.onTick(new Set(data.changedCells.map((x) => this.convertToCellish(x))), data.hasAgain)
                break
            case MESSAGE_TYPE.TICK:
                break // less console noise
            default:
                console.log(`BUG: Unhandled Event occurred`, data) // tslint:disable-line:no-console
        }
    }

    private convertToCellish(c: {rowIndex: number, colIndex: number, spriteNames: string[]}) {
        const {rowIndex, colIndex, spriteNames} = c

        // Lazy-initialize all the proxy cells
        if (!this.cellCache[rowIndex]) {
            this.cellCache[rowIndex] = []
        }
        if (!this.cellCache[rowIndex][colIndex]) {
            this.cellCache[rowIndex][colIndex] = new ProxyCellish(rowIndex, colIndex, [])
        }
        
        this.cellCache[rowIndex][colIndex].sprites = filterNulls(spriteNames.map(name => {
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