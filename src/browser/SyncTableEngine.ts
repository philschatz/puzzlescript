import InputWatcher from '../browser/InputWatcher'
import ResizeWatcher from '../browser/ResizeWatcher'
import { GameEngine } from '../engine'
import { LEVEL_TYPE, Soundish } from '../parser/astTypes'
import Parser from '../parser/parser'
import TableUI from '../ui/table'
import { Cellish, EmptyGameEngineHandler, Engineish, GameEngineHandlerOptional, INPUT_BUTTON, Optional, pollingPromise, GameEngineHandler } from '../util'

class OldTableEngine {
    public tableUI: TableUI
    public engine: Optional<GameEngine>
    private inputWatcher: InputWatcher
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

            public onPress(dir: INPUT_BUTTON) { super.onPress(dir); handler.onPress(dir) }
            public onLevelChange(level: number, cells: Optional<Cellish[][]>, message: Optional<string>) { super.onLevelChange(level, cells, message); handler.onLevelChange(level, cells, message)}
            public onWin() { super.onWin(); handler.onWin() }
            public onPause() { super.onPause(); handler.onPause() }
            public onResume() { super.onResume(); handler.onResume() }
            public async onSound(sound: Soundish) { await super.onSound(sound); await handler.onSound(sound)}
            public onTick(changedCells: Set<Cellish>, hasAgain: boolean) { super.onTick(changedCells, hasAgain); handler.onTick(changedCells, hasAgain)}

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

export default class SyncTableEngine implements Engineish {
    private readonly table: HTMLTableElement
    private readonly resizeWatcher: ResizeWatcher
    private readonly subEngine: OldTableEngine
    private readonly handler: GameEngineHandler

    constructor(table: HTMLTableElement, handler: GameEngineHandlerOptional) {
        this.table = table
        this.subEngine = new OldTableEngine(table, handler)
        this.resizeWatcher = new ResizeWatcher(table, this.handleResize.bind(this))

        this.handler = new EmptyGameEngineHandler([handler, this.subEngine.tableUI])
        table.addEventListener('blur', this.pause.bind(this))
        table.addEventListener('focus', this.resume.bind(this))
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
    private handleResize(width: number) {
        if (!this.subEngine.getEngine().isCurrentLevelAMessage()) {
            this.table.setAttribute('style', `width: ${width}px;`)
        }
    }
    public pause() {
        this.handler.onPause()
    }
    public resume() {
        this.handler.onResume()
    }
}
