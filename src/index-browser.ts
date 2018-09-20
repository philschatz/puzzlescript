import * as keymaster from 'keymaster'
import { BaseUI, Cell, closeSounds, GameData, GameEngine, ILoadingCellsEvent, Optional, Parser, playSound, RULE_DIRECTION } from '.'
import TableUI from './ui/table'

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
    keymaster,
    playSound,
    closeSounds
}

export class TableEngine {
    private tableUI: TableUI
    private timer: number
    private currentLevel: number

    constructor(table: HTMLTableElement) {
        this.tableUI = new TableUI(table)
        this.timer = 0
        this.currentLevel = 0
    }

    public setGame(source: string, levelNum: number) {
        this.tableUI.setGame(source)
        this.tableUI.setLevel(levelNum)
        this.currentLevel = levelNum
    }

    public start() {
        this.startKeyboardListener()
        this.startTickHandler()
    }

    public stop() {
        cancelAnimationFrame(this.timer)
    }

    public startKeyboardListener() {
        keymaster('up, w', () => this.tableUI.pressUp())
        keymaster('down, s', () => this.tableUI.pressDown())
        keymaster('left, a', () => this.tableUI.pressLeft())
        keymaster('right, d', () => this.tableUI.pressRight())
        keymaster('space, x', () => this.tableUI.pressAction())
        keymaster('z, u', () => this.tableUI.pressUndo())
        keymaster('r', () => this.tableUI.pressRestart())
    }

    public startTickHandler() {
        const runLoop = async() => {
            const {
                // changedCells,
                didLevelChange,
                didWinGame,
                messageToShow,
                soundToPlay
                // wasAgainTick
            } = this.tableUI.tick()

            if (soundToPlay) {
                // let sounds play while the game loads or player keeps moving
                /* await */ playSound(soundToPlay) // tslint:disable-line:no-floating-promises
            }
            if (didWinGame) {
                alert(`You Won!`)
                cancelAnimationFrame(this.timer)
            } else if (didLevelChange) {
                alert(`Congratulations! You completed the level.`)
                this.currentLevel += 1
                this.tableUI.setLevel(this.currentLevel)
            } else if (messageToShow) {
                alert(messageToShow)
            }
            this.timer = window.requestAnimationFrame(runLoop)
        }

        this.timer = window.requestAnimationFrame(runLoop)
    }
}
