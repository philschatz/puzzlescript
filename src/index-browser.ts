import * as keymaster from 'keymaster'
import { Cell, GameEngine, ILoadingCellsEvent } from './engine'
import { GameData } from './models/game'
import { GameSound } from './models/sound'
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
    keymaster,
    playSound,
    closeSounds
}

export interface ICustomTableEngineEvents {
    onSound?(sound: GameSound): (void | Promise<any>)
    onLevelComplete?(newLevel: number): (void | Promise<any>)
    onMessage?(message: string): (void | Promise<any>)
    onWin?(): (void | Promise<any>)
}

export interface ITableEngineEvents {
    onSound(sound: GameSound): (void | Promise<any>)
    onLevelComplete(newLevel: number): (void | Promise<any>)
    onMessage(message: string): (void | Promise<any>)
    onWin(): (void | Promise<any>)
}

export class TableEngine {
    private tableUI: TableUI
    private timer: number
    private currentLevel: number
    private readonly eventHandler: ITableEngineEvents

    constructor(table: HTMLTableElement, customHandler?: ICustomTableEngineEvents) {
        this.tableUI = new TableUI(table)
        this.timer = 0
        this.currentLevel = 0

        const defaultEventHandler = {
            onSound: (sound: GameSound) => {
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
        this.startKeyboardListener()
        this.startTickHandler()
    }

    public stop() {
        cancelAnimationFrame(this.timer)
    }

    public startKeyboardListener() {
        keymaster('w', (e) => { e.preventDefault(); this.tableUI.pressUp() })
        keymaster('s', (e) => { e.preventDefault(); this.tableUI.pressDown() })
        keymaster('a', (e) => { e.preventDefault(); this.tableUI.pressLeft() })
        keymaster('d', (e) => { e.preventDefault(); this.tableUI.pressRight() })
        keymaster('x', (e) => { e.preventDefault(); this.tableUI.pressAction() })
        keymaster('z, u', (e) => { e.preventDefault(); this.tableUI.pressUndo() })
        keymaster('r', (e) => { e.preventDefault(); this.tableUI.pressRestart() })
    }

    public startTickHandler() {
        const runLoop = async() => {
            while (this.tableUI.isCurrentLevelAMessage()) {
                await this.eventHandler.onMessage(this.tableUI.getCurrentLevelMessage())
                this.currentLevel++
                this.tableUI.setLevel(this.currentLevel)
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
            this.timer = window.requestAnimationFrame(runLoop)
        }

        this.timer = window.requestAnimationFrame(runLoop)
    }
}
