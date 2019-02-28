import 'babel-polyfill' // tslint:disable-line:no-implicit-dependencies
import * as dialogPolyfill from 'dialog-polyfill' // tslint:disable-line:no-implicit-dependencies
import TimeAgo from 'javascript-time-ago' // tslint:disable-line:no-implicit-dependencies
import TimeAgoEn from 'javascript-time-ago/locale/en' // tslint:disable-line
import { BUTTON_TYPE } from './browser/controller/controller'
import WebworkerTableEngine from './browser/WebworkerTableEngine'
import { CellSaveState } from './engine'
import { IGameTile } from './models/tile'
import { Level } from './parser/astTypes'
import { GameEngineHandlerOptional, Optional, pollingPromise } from './util'

declare const ga: (a1: string, a2: string, a3: string, a4: string, a5?: string, a6?: number) => void

type PromptEvent = Event & {
    prompt: () => void
    userChoice: Promise<{outcome: 'accepted' | 'rejected' | 'default'}>
}

// type NotificationEvent = Event & {
//     action: Optional<string>
//     notification: Notification
// }

interface StorageCheckpoint {
    levelNum: number,
    data: CellSaveState
}

interface StorageGameInfo {
    currentLevelNum: number
    completedLevelAt: number
    lastPlayedAt: number
    levelMaps: boolean[]
    title: string
}

interface Storage { [gameId: string]: StorageGameInfo }

interface Dialog extends HTMLElement {
    open: Optional<boolean>
    show(): void
    showModal(): void
    close(returnValue?: string): void
}

function getElement<T extends HTMLElement>(selector: string) {
    const el: Optional<T> = document.querySelector(selector)
    if (!el) {
        throw new Error(`BUG: Could not find "${selector}" in the page`)
    }
    return el
}

function getAllElements<T extends Element>(selector: string, root: Element) {
    const ret: T[] = []
    root.querySelectorAll(selector).forEach((el) => ret.push(el as T))
    return ret
}

window.addEventListener('load', () => {

    const WEBWORKER_URL = './puzzlescript-webworker.js'
    const GAME_STORAGE_ID = 'puzzlescriptGameProgress'
    const GAME_STORAGE_CHECKPOINT_PREFIX = 'puzzlescriptGameCheckpoint'
    const table: HTMLTableElement = getElement('#theGame')
    const gameSelection: HTMLSelectElement = getElement('#gameSelection')
    const loadingIndicator = getElement('#loadingIndicator')
    const messageDialog = getElement<Dialog>('#messageDialog')
    const messageDialogText = getElement('#messageDialogText')
    const messageDialogClose = getElement('#messageDialogClose')
    dialogPolyfill.registerDialog(messageDialog)

    TimeAgo.addLocale(TimeAgoEn)
    const timeAgo = new TimeAgo('en-US')

    if (!gameSelection) { throw new Error(`BUG: Could not find game selection dropdown`) }
    if (!loadingIndicator) { throw new Error(`BUG: Could not find loading indicator`) }

    messageDialogClose.addEventListener('click', () => {
        messageDialog.close()
    })

    // Functions for loading/saving game progress
    const currentInfo = new class {
        private gameId: string
        private levelNum: number

        constructor() {
            this.gameId = 'INVALID_GAME'
            this.levelNum = -1
        }

        public setGameId(gameId: string) {
            this.gameId = gameId
            this.levelNum = -1
        }
        public getGameId() {
            if (this.gameId === 'INVALID_GAME') {
                throw new Error(`BUG: Did not set game id`)
            }
            return this.gameId
        }
        public getLevelNum() {
            if (this.levelNum < 0) {
                throw new Error(`BUG: Did not set level num`)
            }
            return this.levelNum
        }
        public loadStorage() {
            const storage = this.loadJson(GAME_STORAGE_ID, { _version: 1 })
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
            ga && ga('send', 'event', 'game', 'level', gameId, levelNum)

            currentInfo.levelNum = levelNum
        }
        public saveGameInfo(levels: Array<Level<IGameTile>>, title: string) {
            const gameId = this.getGameId()
            const storage = this.loadStorage()
            storage[gameId] = storage[gameId] || {}
            storage[gameId].levelMaps = levels.map((l) => l.type === 'LEVEL_MAP')
            storage[gameId].title = title
            storage[gameId].lastPlayedAt = Date.now()
            this.saveJson(GAME_STORAGE_ID, storage)
        }
        public saveCheckpoint(checkpoint: CellSaveState) {
            const gameId = this.getGameId()
            const storage = { _version: 1, levelNum: this.getLevelNum(), data: checkpoint }
            this.saveJson(`${GAME_STORAGE_CHECKPOINT_PREFIX}.${gameId}`, storage)
        }

        private loadJson<T>(key: string, defaultValue: T) {
            const str = window.localStorage.getItem(key)
            return str ? JSON.parse(str) : defaultValue
        }
        private saveJson<T>(key: string, value: T) {
            window.localStorage.setItem(key, JSON.stringify(value))
        }
    }()

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
            // // Show a phone notification rather than an alert (if notifications are granted)
            // // Just to show that notifications can be done and what they would look like
            // const notificationOptions = {
            //     body: `${msg} (Just showing that notifications work. You can disable them)`,
            //     icon: './pwa-icon.png',
            //     badge: './pwa-icon.png',
            //     vibrate: [200, 100, 200],
            //     actions: [
            //         { action: 'action-ok', title: 'ok' }
            //     ]
            // }
            // return new Promise((resolve) => {
            //     // Notification is not available on iOS
            //     if (typeof Notification !== 'undefined') { // tslint:disable-line:strict-type-predicates
            //         Notification.requestPermission(async(result) => { // tslint:disable-line:no-floating-promises
            //             // Safari does not support registration.showNotification() so we fall back to new Notification()
            //             const fallback = () => {
            //                 new Notification('Annoying Test Message', notificationOptions) // tslint:disable-line:no-unused-expression
            //                 resolve()
            //             }
            //             if (result === 'granted') {
            //                 if (navigator.serviceWorker) {
            //                     // Mobile notification (Android Chrome)
            //                     const registration = await navigator.serviceWorker.ready
            //                     if (registration.showNotification) {
            //                         await registration.showNotification('Annoying Test Message', notificationOptions)
            //                         resolve()
            //                     } else {
            //                         fallback()
            //                     }
            //                 } else {
            //                     // Desktop notification Fallback (Firefox)
            //                     fallback()
            //                 }
            //             } else {
            //                 alert(msg)
            //                 resolve()
            //             }
            //         })
            //     } else {
            //         alert(msg)
            //         resolve()
            //     }
            // })
        },
        onLevelChange(newLevelNum) {
            // Hide the Loading text because the level loaded
            loadingIndicator.classList.add('hidden')
            gameSelection.removeAttribute('disabled')

            currentInfo.saveCurrentLevelNum(newLevelNum)
            updateGameSelectionInfo()
        },
        onGameChange(gameData) {
            currentInfo.saveGameInfo(gameData.levels, gameData.title)
        },
        onTick(_changedCells, checkpoint) {
            if (checkpoint) {
                // Ideally, include the level number so we can verify the checkpoint applies to the level
                // This might require creating an onCheckpoint(levelNum, checkpoint) event
                currentInfo.saveCheckpoint(checkpoint)
            }
        }
    }

    updateGameSelectionInfo() // update the % complete in the dropdown

    // startTableEngine
    if (!table) { throw new Error(`BUG: Could not find table on the page`) }

    const worker = new Worker(WEBWORKER_URL)
    const tableEngine = new WebworkerTableEngine(worker, table, handler)
    // const tableEngine = new window.PuzzleScript.SyncTableEngine(table, handler)

    startGamepadDetection()
    playSelectedGame()

    // Load the new game when the dropdown changes
    gameSelection.addEventListener('change', () => playSelectedGame())

    function playSelectedGame() {
        loadingIndicator.classList.remove('hidden') // Show the "Loading..." text
        gameSelection.setAttribute('disabled', 'disabled')

        currentInfo.setGameId(gameSelection.value)
        if (!currentInfo.getGameId()) {
            return
        }
        fetch(`./games/${currentInfo.getGameId()}/script.txt`, { redirect: 'follow' })
        .then((resp) => {
            if (resp.ok) {
                return resp.text().then((source) => {
                    // Load the game
                    const levelNum = currentInfo.loadCurrentLevelNum()
                    const checkpoint = currentInfo.loadCheckpoint()
                    if (checkpoint) {
                        // verify that the currentLevelNum is the same as the checkpoint level num
                        const { levelNum: checkpointLevelNum, data: checkpointData } = checkpoint
                        if (levelNum !== checkpointLevelNum) {
                            throw new Error(`BUG: Checkpoint level number (${checkpointLevelNum}) does not match current level number (${levelNum})`)
                        }
                        tableEngine.setGame(source, currentInfo.loadCurrentLevelNum() || 0, checkpointData)
                    } else {
                        tableEngine.setGame(source, currentInfo.loadCurrentLevelNum() || 0, null)
                    }
                })
            } else {
                alert(`Problem finding game file. Please choose another one`)
                loadingIndicator.classList.add('hidden')
                gameSelection.removeAttribute('disabled')
            }
        },
        (err) => {
            alert('Could not download the game. Are you connected to the internet?')
            console.error(err) // tslint:disable-line:no-console
            loadingIndicator.classList.add('hidden')
            gameSelection.removeAttribute('disabled')
        })
    }

    // Show/hide the "Add controller" message if a Gamepad is attached
    const gamepadIcon = getElement('#gamepadIcon')
    const gamepadDisabled = getElement('#gamepadDisabled')
    const gamepadRecognized = getElement('#gamepadRecognized')
    const gamepadNotRecognized = getElement('#gamepadNotRecognized')
    function startGamepadDetection() {
        if (tableEngine.inputWatcher) {
            setInterval(() => {
                if (tableEngine.inputWatcher.gamepad.isRecognized()) {
                    // Send GA when someone adds a gamepad
                    if (!gamepadIcon.classList.contains('enabled')) {
                        ga && ga('send', 'event', 'gamepad', 'recognized')
                    }
                    gamepadIcon.classList.add('enabled')
                    gamepadDisabled.classList.add('hidden')
                    gamepadRecognized.classList.remove('hidden')
                    gamepadNotRecognized.classList.add('hidden')

                    // Dismiss dialogs via the gamepad
                    if (messageDialog.open && tableEngine.inputWatcher.gamepad.isButtonPressed(BUTTON_TYPE.CLUSTER_BOTTOM)) {
                        messageDialogClose.click()
                    }
                } else if (tableEngine.inputWatcher.gamepad.isSomethingConnected()) {
                    // Send GA when someone adds a gamepad
                    if (gamepadNotRecognized.classList.contains('hidden')) {
                        ga && ga('send', 'event', 'gamepad', 'something-connected')
                    }
                    gamepadIcon.classList.remove('enabled')
                    gamepadDisabled.classList.add('hidden')
                    gamepadRecognized.classList.add('hidden')
                    gamepadNotRecognized.classList.remove('hidden')
                } else {
                    gamepadIcon.classList.remove('enabled')
                    gamepadDisabled.classList.remove('hidden')
                    gamepadRecognized.classList.add('hidden')
                    gamepadNotRecognized.classList.add('hidden')
                }
            }, 200)
        }

    }

    // store the original sort order so that we fall back to it.
    gameSelection.querySelectorAll('option').forEach((option, index) => {
        option.setAttribute('data-original-index', `${index}`)
    })

    function updateGameSelectionInfo() {
        const storage = currentInfo.loadStorage()

        // Update the last-updated time for all of the games and then sort them
        const gameOptions = getAllElements('option', gameSelection)
        for (const option of gameOptions) {
            const gameId = option.getAttribute('value')
            if (!gameId) {
                continue
            }
            const gameInfo = storage[gameId]
            if (gameInfo) {
                const completedMapLevels = gameInfo.levelMaps.slice(0, gameInfo.currentLevelNum - 1).filter((b) => b).length
                const totalMapLevels = gameInfo.levelMaps.filter((b) => b).length
                const percent = Math.floor(100 * completedMapLevels / totalMapLevels)
                option.setAttribute('data-percent-complete', `${percent}`)
                option.setAttribute('data-last-played-at', `${gameInfo.lastPlayedAt}`)
                option.textContent = `${gameInfo.title} (${percent}% ${timeAgo.format(gameInfo.lastPlayedAt)})`
            } else if (gameId) {
                option.setAttribute('data-percent-complete', `0`)
                option.setAttribute('data-last-played-at', '0')
            }
        }

        const selectedGameId = gameSelection.value
        const continuePlayingOptions = []
        const newGameOptions = []
        const uncompletedOptions = []
        const completedOptions = []

        const oneMonthAgo = Date.now() - 1 * 30 * 24 * 60 * 60 * 1000
        for (const option of gameOptions) {
            const percent = Number.parseInt(option.getAttribute('data-percent-complete') || `0`, 10)
            const lastPlayed = Number.parseInt(option.getAttribute('data-last-played-at') || `0`, 10)

            if (!option.getAttribute('value')) {
                // discard separators
            } else if (percent === 100) {
                completedOptions.push(option)
            } else if (!lastPlayed) {
                newGameOptions.push(option)
            } else if (lastPlayed < oneMonthAgo) {
                uncompletedOptions.push(option)
            } else {
                continuePlayingOptions.push(option)
            }
        }

        // Sort the lists
        const lastPlayedComparator = (a: Element, b: Element) => {
            const aLastPlayed = Number.parseInt(a.getAttribute('data-last-played-at') || `0`, 10)
            const bLastPlayed = Number.parseInt(b.getAttribute('data-last-played-at') || `0`, 10)
            return bLastPlayed - aLastPlayed
        }
        continuePlayingOptions.sort(lastPlayedComparator)
        uncompletedOptions.sort(lastPlayedComparator)
        completedOptions.sort(lastPlayedComparator)
        newGameOptions.sort((a, b) => {
            const aOriginalIndex = Number.parseInt(a.getAttribute('data-original-index') || `0`, 10)
            const bOriginalIndex = Number.parseInt(b.getAttribute('data-original-index') || `0`, 10)
            return aOriginalIndex - bOriginalIndex
        })

        gameSelection.value = '' // clear the selection because we will be adding

        for (const option of gameOptions) {
            gameSelection.removeChild(option)
        }

        if (continuePlayingOptions.length > 0) {
            continuePlayingOptions.unshift(createSeparator('Continue playing'))
        }
        if (newGameOptions.length > 0) {
            newGameOptions.unshift(createSeparator('New'))
        }
        if (uncompletedOptions.length > 0) {
            uncompletedOptions.unshift(createSeparator('Uncompleted'))
        }
        if (completedOptions.length > 0) {
            completedOptions.unshift(createSeparator('Completed'))
        }
        gameSelection.append(...continuePlayingOptions, ...newGameOptions, ...uncompletedOptions, ...completedOptions)
        gameSelection.value = selectedGameId
    }

    function createSeparator(textContent: string) {
        const el = document.createElement('option')
        el.setAttribute('disabled', 'disabled')
        el.textContent = `--- ${textContent}`
        return el
    }

    // Support toggling the "Enable CSS" checkbox
    const disableCss: HTMLInputElement = getElement('#disableCss')
    function setUi(skipAnalytics: boolean) {
        if (!skipAnalytics) {
            ga && ga('send', 'event', 'accessibility', 'toggle', disableCss.checked ? 'show' : 'hide')
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

    // https://developers.google.com/web/fundamentals/app-install-banners/#listen_for_beforeinstallprompt
    const btnAdd = getElement('#btnAdd')
    let deferredPrompt: Optional<PromptEvent> = null
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault()
        // Stash the event so it can be triggered later.
        deferredPrompt = e as PromptEvent
        // Update UI notify the user they can add to home screen
        btnAdd.classList.remove('hidden')
    })

    btnAdd.addEventListener('click', (e) => {
        btnAdd.classList.add('hidden')
        deferredPrompt && deferredPrompt.prompt()
        // Wait for the user to respond to the prompt
        deferredPrompt && deferredPrompt.userChoice
        .then(() => {
            deferredPrompt = null
        })
    })

})
