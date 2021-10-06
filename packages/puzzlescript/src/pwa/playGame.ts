import dialogPolyfill from 'dialog-polyfill' // tslint:disable-line:no-implicit-dependencies
import { GameData } from '..'
// import TimeAgo from 'javascript-time-ago' // tslint:disable-line:no-implicit-dependencies
// import TimeAgoEn from 'javascript-time-ago/locale/en' // tslint:disable-line
import WebworkerTableEngine from '../browser/WebworkerTableEngine'
import { CellSaveState } from '../engine'
import { HexColor } from '../models/colors'
import { GameEngineHandlerOptional, INPUT_BUTTON, Optional, pollingPromise } from '../util'
import { changePage, getElement, sendAnalytics } from './util'

interface StorageCheckpoint {
    levelNum: number,
    data: CellSaveState
}

export interface StorageGameInfo {
    currentLevelNum: number
    completedLevelAt: number
    lastPlayedAt: number
    levelMaps?: boolean[]
    title: string
}

interface Storage { [gameId: string]: StorageGameInfo }

export interface Dialog extends HTMLElement {
    open: Optional<boolean>
    show(): void
    showModal(): void
    close(returnValue?: string): void
}

const CURRENT_STORAGE_VERSION = 2
const WEBWORKER_URL = './puzzlescript-webworker.js'
const GAME_STORAGE_ID = 'puzzlescriptGameProgress'
const GAME_STORAGE_CHECKPOINT_PREFIX = 'puzzlescriptGameCheckpoint'
const LARGE_LEVEL_SIZE = 400 // if there are many cells it will likely take a long time to load
const LARGE_SOURCE_SIZE = 40000 // if there are many characters in the source it will likely take a long time to load
const htmlTitle = getElement('title')
const table: HTMLTableElement = getElement('#theGame')
const loadingDialog = getElement<HTMLDialogElement>('#loadingDialog')
const loadingDialogCancel = getElement('#loadingDialogCancel')
const loadingIndicator = getElement('#loadingIndicator')
const fullscreenTitle = getElement('#fullscreenTitle')
const fullscreenPercentage = getElement('#fullscreenPercentage')
const authorInfo = getElement('#authorInfo')
const gameButtonUndo = getElement('#gameButtonUndo')
const gameButtonRestart = getElement('#gameButtonRestart')
const gameInstructionsButton2 = getElement('#gameInstructionsButton2')
const gameInstructionsDialog = getElement<HTMLDialogElement>('#gameInstructionsDialog')
const gameInstructionsDialogClose = getElement('#gameInstructionsDialogClose')
const messageDialog = getElement<HTMLDialogElement>('#messageDialog')
const messageDialogText = getElement('#messageDialogText')
const messageDialogClose = getElement('#messageDialogClose')
dialogPolyfill.registerDialog(loadingDialog)
dialogPolyfill.registerDialog(messageDialog)
dialogPolyfill.registerDialog(gameInstructionsDialog)

// TimeAgo.addLocale(TimeAgoEn)
// const timeAgo = new TimeAgo('en-US')

// Functions for loading/saving game progress
export const currentInfo = new class {
    public levelNum: Optional<number>
    public gameId: string
    public gameData: Optional<GameData>

    constructor() {
        this.gameId = ''
        this.levelNum = null
        this.gameData = null
    }

    public getGameId() {
        if (this.gameId === '') {
            throw new Error(`BUG: Did not set game id`)
        }
        return this.gameId
    }
    public hasGame() {
        return !!this.gameId
    }
    public getLevelNum() {
        if (this.levelNum === null) {
            throw new Error(`BUG: Did not set level num`)
        }
        return this.levelNum
    }
    public setGameAndLevel(gameId: string, levelNum: Optional<number>) {
        this.gameId = gameId
        this.levelNum = levelNum
    }
    public loadStorage() {
        const storage = this.loadJson(GAME_STORAGE_ID, { _version: CURRENT_STORAGE_VERSION })
        return storage as Storage
    }
    public loadCurrentLevelNum() {
        const gameId = this.getGameId()
        const storage = this.loadStorage()
        const gameData = storage[gameId]
        return (gameData || null) && gameData.currentLevelNum
    }
    public loadCheckpoint(): Optional<StorageCheckpoint> {
        const gameId = this.getGameId()
        return this.loadJson(`${GAME_STORAGE_CHECKPOINT_PREFIX}.${gameId}`, null)
    }
    public saveCurrentLevelNum(levelNum: number) {
        const gameId = this.getGameId()
        const storage = this.loadStorage()
        storage[gameId] = storage[gameId] || {}
        storage[gameId].currentLevelNum = levelNum
        storage[gameId].completedLevelAt = Date.now()
        storage[gameId].lastPlayedAt = Date.now()
        // storage[gameId].checkpoint = null
        this.saveJson(GAME_STORAGE_ID, storage)
        sendAnalytics('send', 'event', 'game', 'level', gameId, levelNum)

        currentInfo.levelNum = levelNum

        const gameInfo = storage[gameId]
        if (gameInfo.levelMaps) {
            const completedMapLevels = gameInfo.levelMaps.slice(0, gameInfo.currentLevelNum).filter((b) => b).length
            const totalMapLevels = gameInfo.levelMaps.filter((b) => b).length
            const percent = Math.floor(100 * completedMapLevels / totalMapLevels)
            if (percent > 0) {
                fullscreenPercentage.textContent = `(${percent}%)`
            }
        }

    }
    public saveGameInfo(gameData: GameData) {
        const { levels, title } = gameData
        const gameId = this.getGameId()
        const storage = this.loadStorage()
        this.gameData = gameData
        storage[gameId] = storage[gameId] || {}
        storage[gameId].levelMaps = levels.map((l) => l.type === 'LEVEL_MAP')
        storage[gameId].title = title
        storage[gameId].lastPlayedAt = Date.now()
        this.saveJson(GAME_STORAGE_ID, storage)
    }
    public saveCheckpoint(checkpoint: CellSaveState) {
        const gameId = this.getGameId()
        const storage = { _version: CURRENT_STORAGE_VERSION, levelNum: this.getLevelNum(), data: checkpoint }
        this.saveJson(`${GAME_STORAGE_CHECKPOINT_PREFIX}.${gameId}`, storage)
    }
    public getNumberOfPlayedGames() {
        const storage = this.loadStorage()
        return Object.keys(storage).length - 1 // for _version
    }
    public forEachGame(fn: (gameId: string, item: StorageGameInfo) => void) {
        const storage = this.loadStorage()
        for (const gameId in storage) {
            if (gameId !== '_version') {
                fn(gameId, storage[gameId])
            }
        }
    }

    public loadJson<T>(key: string, defaultValue: T) {
        const str = window.localStorage.getItem(key)
        return str ? JSON.parse(str) : defaultValue
    }
    public saveJson<T>(key: string, value: T) {
        window.localStorage.setItem(key, JSON.stringify(value))
    }
}()

messageDialogClose.addEventListener('click', () => {
    messageDialog.close()
    table.focus()
})

gameInstructionsButton2.addEventListener('click', () => {
    gameInstructionsDialog.showModal()
})
gameInstructionsDialogClose.addEventListener('click', () => {
    gameInstructionsDialog.close()
    table.focus()
})

loadingDialogCancel.addEventListener('click', () => {
    closeLoadingDialog()
})

let openTimeout: Optional<NodeJS.Timeout> = null

function openLoadingDialog() {
    const delayMs = 500
    if (!loadingDialog.open) {
        if (openTimeout) {
            clearTimeout(openTimeout)
        }
        openTimeout = setTimeout(() => {
            loadingDialog.showModal()
        }, delayMs)
    }
}

function closeLoadingDialog() {
    if (openTimeout) {
        clearTimeout(openTimeout)
    }
    if (loadingDialog.open) {
        loadingDialog.close()
    }
}

// Save when the user completes a level
const handler: GameEngineHandlerOptional = {
    async onMessage(msg) {

        // Wait for keys to stop being pressed, show the dialog, and then wait for the dialog to close
        await pollingPromise<void>(10, () => {
            return !tableEngine.inputWatcher.isSomethingPressed()
        })
        messageDialogText.textContent = msg
        messageDialog.showModal()
        messageDialogClose.focus()

        await pollingPromise<void>(10, () => {
            // Wait until the dialog has closed (and no keys are pressed down)
            return !messageDialog.open
        })
    },
    onLevelLoad(level: number, newLevelSize: Optional<{rows: number, cols: number}>) {
        const isLarge = newLevelSize && newLevelSize.rows * newLevelSize.cols > LARGE_LEVEL_SIZE
        loadingIndicator.setAttribute('data-size', isLarge ? 'large' : 'small')
        openLoadingDialog()
    },
    onLevelChange(newLevelNum, cells) {
        // Hide the Loading text because the level loaded
        closeLoadingDialog()
        table.focus()

        // Only change the hash when the user views a non-message level.
        // That way the Back button works.
        if (cells) {
            changePage(currentInfo.getGameId(), newLevelNum)
            currentInfo.saveCurrentLevelNum(newLevelNum)
        }
    },
    onGameChange(gameData) {
        // Set the background color to be that of the game
        let { backgroundColor } = gameData.metadata
        backgroundColor = backgroundColor || new HexColor({ code: '', sourceOffset: 0 }, '#000000')

        if (backgroundColor.toRgb().isDark()) {
            window.document.body.classList.add('is-background-dark')
        } else {
            window.document.body.classList.remove('is-background-dark')
        }
        window.document.body.style.backgroundColor = backgroundColor.toHex()

        function toUrl(url: string) {
            return /^https?:\/\//.test(url) ? url : /@/.test(url) ? `mailto:${url}` : `http://${url}`
        }
        const { author, homepage } = gameData.metadata
        if (author) {
            authorInfo.textContent = author
            if (homepage) {
                authorInfo.setAttribute('href', toUrl(homepage))
            } else {
                authorInfo.removeAttribute('href')
            }
        }

        currentInfo.saveGameInfo(gameData)
        fullscreenTitle.textContent = gameData.title
        htmlTitle.textContent = `Puzzle Games - ${gameData.title}`
    },
    onTick(_changedCells, checkpoint) {
        if (checkpoint) {
            // Ideally, include the level number so we can verify the checkpoint applies to the level
            // This might require creating an onCheckpoint(levelNum, checkpoint) event
            currentInfo.saveCheckpoint(checkpoint)
        }
    },
    onPause() {
        document.body.setAttribute('data-ps-state', 'paused')
    },
    onResume() {
        document.body.setAttribute('data-ps-state', 'running')
    }
}

const worker = new Worker(WEBWORKER_URL)
export const tableEngine = new WebworkerTableEngine(worker, table, handler)
// const tableEngine = new window.PuzzleScript.SyncTableEngine(table, handler)

gameButtonUndo.addEventListener('click', () => {
    tableEngine.press(INPUT_BUTTON.UNDO)
    table.focus()
})

gameButtonRestart.addEventListener('click', () => {
    tableEngine.press(INPUT_BUTTON.RESTART)
    table.focus()
})

export function playGame(gameId: string, levelNum: Optional<number>, showTable: boolean) {
    currentInfo.setGameAndLevel(gameId, levelNum)

    loadingIndicator.setAttribute('data-size', 'small')
    openLoadingDialog()

    fetch(`./games/${currentInfo.getGameId()}/script.txt`, { redirect: 'follow' })
    .then((resp) => {
        if (resp.ok) {
            return resp.text().then((source) => {
                if (source.length > LARGE_SOURCE_SIZE) {
                    loadingIndicator.setAttribute('data-size', 'large')
                }
                // Load the game
                levelNum = currentInfo.levelNum !== null ? currentInfo.levelNum : currentInfo.loadCurrentLevelNum()
                const checkpoint = currentInfo.loadCheckpoint()
                if (checkpoint) {
                    // verify that the currentLevelNum is the same as the checkpoint level num
                    const { levelNum: checkpointLevelNum, data: checkpointData } = checkpoint
                    if (levelNum !== checkpointLevelNum) {
                        throw new Error(`BUG: Checkpoint level number (${checkpointLevelNum}) does not match current level number (${levelNum})`)
                    }
                    tableEngine.setGame(source, levelNum || 0, checkpointData)
                } else {
                    tableEngine.setGame(source, levelNum || 0, null)
                }
                disableCss.checked = showTable
            })
        } else {
            alert(`Problem finding game file. Please choose another one`)
            closeLoadingDialog()
        }
    },
    (err) => {
        alert('Could not download the game. Are you connected to the internet?')
        console.error(err) // tslint:disable-line:no-console
        closeLoadingDialog()
    })
}

// Support toggling the "Enable CSS" checkbox
const disableCss: HTMLInputElement = getElement('#disableCss')
function setUi(skipAnalytics: boolean) {
    if (!skipAnalytics) {
        sendAnalytics('send', 'event', 'accessibility', 'toggle', disableCss.checked ? 'show' : 'hide')
    }
    if (disableCss.checked) {
        table.classList.add('ps-ui-disabled')
    } else {
        table.classList.remove('ps-ui-disabled')
    }
    table.focus()
}
disableCss.addEventListener('change', () => setUi(false))
setUi(true)

export function runMigrations() {
    const storage = currentInfo.loadStorage()
    const storageVersion = storage as any as { _version: number }
    if (storageVersion._version === 1) {
        const gameMigration = new Map<string, string>()
        gameMigration.set('gist-f0b9b8e95d0bc87c9fb9e411756daa23', 'icecrates')
        gameMigration.set('gist-7f4470ab80d9f7ffe4b9e28c83b26adc', 'push')
        gameMigration.set('pot-wash-panic_itch', 'pot-wash-panic')
        gameMigration.set('gist-457c6d8be68ffb6d921211d40ca48c15', 'pants-shirt-cap⁣')
        gameMigration.set('gist-e13482e035a5f75e9b0e4d0b5f28f8b6', 'pushcat-jr⁣')
        gameMigration.set('separation_itch', 'separation⁣')
        gameMigration.set('roll-those-sixes-itch', 'roll-those-sixes⁣')
        gameMigration.set('gist-6daa8b63cf79202cd085c1b168048c09', 'rock-paper-scissors')
        gameMigration.set('gist-c5ec035de4e0c145a85327942fb76098', 'some-lines-crossed⁣')
        gameMigration.set('sleepy-player_itch', 'sleepy-players⁣')
        gameMigration.set('skipping-stones_d6fd6fcf84de185e2584', 'skipping-stones')
        gameMigration.set('gist-8074d60a0af768f970ef055d4460414d', 'bubble-butler')
        gameMigration.set('gist-ee39bfe12012c774acfc5e3d32fb4f89', 'boxes-and-balloons⁣')
        gameMigration.set('mirror-isles_219a7db6511dad557b84', 'mirror-isles⁣')
        gameMigration.set('gist-e86e1d6cf24307499c1cd1aaaa733a91', 'swapbot⁣')
        gameMigration.set('spikes-n-stuff_dc5c4a669e362e389e994025075f7d0b', 'spikes-n-stuff⁣')
        gameMigration.set('aunt-floras-mansion', 'aunt-flora-s-mansion')
        gameMigration.set('spacekoban_6a6c07f71d7039e4155e', 'spacekoban⁣')
        gameMigration.set('gist-181f370a15625905ca6e844a972a4abf', 'miss-direction⁣')
        gameMigration.set('gist-711d6220e4fe2a36254cc544c6ba4885', 'castlemouse⁣')
        gameMigration.set('rosden.itch.io_islands', 'islands⁣')
        gameMigration.set('rosden.itch.io_bomb-n-ice', 'bomb-n-ice⁣')
        gameMigration.set('cyber-lasso-e3e444f7c63fb21b6ec0', 'cyber-lasso⁣')
        gameMigration.set('boxes-love-bloxing_c2d717a77f9aa02ecb1b793111f3a921', 'boxes-love-bloxing-gloves⁣')
        gameMigration.set('hack-the-net_8b5eb39cb825277832d261b3142f084b', 'hack-the-net⁣')
        gameMigration.set('spooky-pumpkin_7242443', 'spooky-pumpkin-game⁣')
        gameMigration.set('gist-b6c8ba9363b4cca270d8ce5e88f79abf', 'vacuum⁣')
        gameMigration.set('gist-542b97948cb1d377dce6d276c0bcd9d5', 'sokoboros⁣')
        gameMigration.set('gist-2b9ece642cd7cdfb4a5f2c9fa8455e40', 'beam-islands⁣')
        gameMigration.set('entanglement', 'entanglement-one')

        for (const [oldGameId, newGameId] of gameMigration.entries()) {
            const value = storage[oldGameId]
            if (value) {
                delete storage[oldGameId]
                storage[newGameId] = value
            }

            // check if the checkpoint file needs to be migrated too
            const checkpointKey = `${GAME_STORAGE_CHECKPOINT_PREFIX}.${oldGameId}`
            const checkpointStr = window.localStorage.getItem(checkpointKey)
            if (checkpointStr) {
                // const checkpoint = JSON.parse(checkpointStr) as StorageCheckpoint
                window.localStorage.setItem(`${GAME_STORAGE_CHECKPOINT_PREFIX}.${newGameId}`, checkpointStr)
                window.localStorage.removeItem(checkpointKey)
            }
        }
        storageVersion._version = 2
        currentInfo.saveJson(GAME_STORAGE_ID, storage)
    }

    // Some games contained an extra character. Remove it.
    // Object.keys(storage).forEach((name) => {
    //     if (name.endsWith('\u2063')) {
    //         const fix = name.substring(0, name.length - 1)
    //         storage[fix] = storage[name]
    //     }
    // })
}
