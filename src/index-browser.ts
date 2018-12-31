import { Button, BUTTON_TYPE, Gamepad, Keyboard, or } from 'contro'
import { Cell, GameEngine, ILoadingCellsEvent } from './engine'
import { GameData } from './models/game'
import Parser from './parser/parser'
import { closeSounds, playSound } from './sounds'
import BaseUI from './ui/base'
import TableUI from './ui/table'
import { Optional, RULE_DIRECTION } from './util'

// const worker: PuzzlescriptWorker = new Worker('./lib/webpack-output-webworker.js')

// worker.postMessage({type: MESSAGE_TYPE.LOAD_GAME, level: 0, code: `title Hello World
// ========
// OBJECTS
// ========

// Background .
// BLACK

// Player P
// YELLOW

// ================
// COLLISIONLAYERS
// ================

// Background
// Player

// =======
// LEVELS
// =======

// .P.
// `})
// worker.addEventListener('message', (event) => {
//     const { data } = event
//     switch (data.type) {
//         case MESSAGE_TYPE.LOAD_GAME:
//             console.log(`Loaded game. Here is the serialized payload`, data.payload) // tslint:disable-line:no-console
//             worker.postMessage({ type: MESSAGE_TYPE.PRESS, button: INPUT_BUTTON.RIGHT })
//             break
//         case MESSAGE_TYPE.TICK:
//             console.log(`Tick happened. This is what changed`, data.payload) // tslint:disable-line:no-console
//             worker.postMessage({ type: MESSAGE_TYPE.PAUSE })
//             break
//         default:
//             console.log(`BUG: Unhandled Event occurred`, data) // tslint:disable-line:no-console
//     }
// })

// Public API
export {
    Parser,
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
    public gamepad: Gamepad
    private tableUI: TableUI
    private engine: Optional<GameEngine>
    private timer: number
    private controls: Control<{button: Button, lastPressed: Optional<number>}>
    private controlCheckers: Array<() => void>

    constructor(table: HTMLTableElement) {
        const keyboard = new Keyboard()
        this.gamepad = new Gamepad()
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
                const interval = this.tableUI.getGameData().metadata.keyRepeatInterval || .25
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
            makeChecker('up', () => this.getEngine().pressUp()),
            makeChecker('down', () => this.getEngine().pressDown()),
            makeChecker('left', () => this.getEngine().pressLeft()),
            makeChecker('right', () => this.getEngine().pressRight()),
            makeChecker('action', () => this.getEngine().pressAction()),
            makeChecker('undo', () => this.getEngine().pressUndo()),
            makeChecker('restart', () => this.getEngine().pressRestart())
        ]

        this.timer = 0
        this.engine = null
        // TODO: wait until user is no longer pressing anything before
        // showing the alert().
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1346228
        const that = this // tslint:disable-line:no-this-assignment
        this.tableUI = new (class CustomTableUI extends TableUI {
            public onMessage(msg: string) {
                const p = new Promise<void>((resolve) => {
                    const timer = setInterval(() => {
                        if (!that.isSomethingPressed()) {
                            alert(msg)
                            clearInterval(timer)
                            resolve()
                        }
                    }, 10)
                })
                return p
            }
        })(table)
    }

    public setGame(code: string, levelNum?: number) {
        const { data } = Parser.parse(code)
        this.engine = new GameEngine(data, this.tableUI)

        this.tableUI.setGameData(data)
        if (levelNum !== undefined) {
            this.engine.setLevel(levelNum)
        }
    }

    public setLevel(levelNum: number) {
        this.getEngine().setLevel(levelNum)
    }

    public start() {
        this.startTickHandler()
    }

    public stop() {
        cancelAnimationFrame(this.timer)
    }

    public pollControls() {
        this.controlCheckers.forEach((fn) => fn())
    }

    public startTickHandler() {
        const runLoop = async() => {
            this.pollControls()
            await this.getEngine().tick()
            this.timer = window.requestAnimationFrame(runLoop)
        }

        this.timer = window.requestAnimationFrame(runLoop)
    }

    private getEngine() {
        if (!this.engine) {
            throw new Error(`BUG: Engine has not been created yet`)
        }
        return this.engine
    }

    private isSomethingPressed() {
        for (const entry of Object.values(this.controls)) {
            if (entry.button.query()) {
                return true
            }
        }
        return false
    }
}
