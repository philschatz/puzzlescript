import { Button, BUTTON_TYPE, Gamepad, Keyboard, or } from 'contro'
import { Cell, GameEngine, ILoadingCellsEvent } from './engine'
import { GameData } from './models/game'
import { IGameTile } from './models/tile'
import { SoundItem } from './parser/astTypes'
import Parser from './parser/parser'
import { closeSounds, playSound } from './sounds'
import BaseUI from './ui/base'
import TableUI from './ui/table'
import { Optional, RULE_DIRECTION } from './util'

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

export interface ICustomTableEngineEvents {
    onSound?(sound: SoundItem<IGameTile>): (void | Promise<any>)
    onLevelComplete?(newLevel: number): (void | Promise<any>)
    onMessage?(message: string): (void | Promise<any>)
    onWin?(): (void | Promise<any>)
}

export interface ITableEngineEvents {
    onSound(sound: SoundItem<IGameTile>): (void | Promise<any>)
    onLevelComplete(newLevel: number): (void | Promise<any>)
    onMessage(message: string): (void | Promise<any>)
    onWin(): (void | Promise<any>)
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
    private timer: number
    private currentLevel: number
    private controls: Control<{button: Button, lastPressed: Optional<number>}>
    private controlCheckers: Array<() => void>
    private readonly eventHandler: ITableEngineEvents

    constructor(table: HTMLTableElement, customHandler?: ICustomTableEngineEvents) {
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
            makeChecker('up', () => this.tableUI.pressUp()),
            makeChecker('down', () => this.tableUI.pressDown()),
            makeChecker('left', () => this.tableUI.pressLeft()),
            makeChecker('right', () => this.tableUI.pressRight()),
            makeChecker('action', () => this.tableUI.pressAction()),
            makeChecker('undo', () => this.tableUI.pressUndo()),
            makeChecker('restart', () => this.tableUI.pressRestart())
        ]

        this.tableUI = new TableUI(table)
        this.timer = 0
        this.currentLevel = 0

        const defaultEventHandler = {
            onSound: (sound: SoundItem<IGameTile>) => {
                // let sounds play while the game loads or player keeps moving
                playSound(sound) // tslint:disable-line:no-floating-promises
                return
            },
            onLevelComplete: () => {
                if (!this.tableUI.isCurrentLevelAMessage()) {
                    alert(`Congratulations! You completed the level.`)
                }
            },
            onMessage: (message: string) => alert(message),
            onWin: () => alert(`You WON!`)
        }

        this.eventHandler = {
            onSound: (customHandler ? customHandler.onSound : null) || defaultEventHandler.onSound,
            onLevelComplete: (customHandler ? customHandler.onLevelComplete : null) || defaultEventHandler.onLevelComplete,
            onMessage: (customHandler ? customHandler.onMessage : null) || defaultEventHandler.onMessage,
            onWin: (customHandler ? customHandler.onWin : null) || defaultEventHandler.onWin
        }
    }

    public setGame(source: string, levelNum: number) {
        this.tableUI.setGame(source)
        this.tableUI.setLevel(levelNum)
        this.currentLevel = levelNum
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

    private isSomethingPressed() {
        for (const entry of Object.values(this.controls)) {
            if (entry.button.query()) {
                return true
            }
        }
        return false
    }

    public startTickHandler() {
        const runLoop = async() => {
            this.pollControls()
            await this.tick()
            this.timer = window.requestAnimationFrame(runLoop)
        }

        this.timer = window.requestAnimationFrame(runLoop)
    }

    public async tick() {
        if (this.tableUI.isCurrentLevelAMessage()) {
            // wait until user is no longer pressing anything before
            // showing the alert().
            // https://bugzilla.mozilla.org/show_bug.cgi?id=1346228
            if (this.isSomethingPressed()) {
                return
            }
            await this.eventHandler.onMessage(this.tableUI.getCurrentLevelMessage())
            this.currentLevel++
            this.tableUI.setLevel(this.currentLevel)
            await this.eventHandler.onLevelComplete(this.currentLevel)
        }
        const {
            // changedCells,
            didLevelChange,
            didWinGame,
            messageToShow,
            soundToPlay
            // wasAgainTick
        } = this.tableUI.tick()

        if (soundToPlay) {
            await this.eventHandler.onSound(soundToPlay)
        }
        if (didWinGame) {
            await this.eventHandler.onWin()
            cancelAnimationFrame(this.timer)
            return // make sure we don't call window.requestAnimationFrame again
        } else if (didLevelChange) {
            this.currentLevel += 1
            this.tableUI.setLevel(this.currentLevel)
            await this.eventHandler.onLevelComplete(this.currentLevel)
        } else if (messageToShow) {
            await this.eventHandler.onMessage(messageToShow)
            this.tableUI.pressAction() // Tell the engine we are ready to continue
        }
    }
}
