import 'babel-polyfill' // tslint:disable-line:no-implicit-dependencies
import { Workbox } from 'workbox-window'
import { BUTTON_TYPE } from '../browser/controller/controller'
import { Optional } from '../util'
import { browseGames } from './browseGames'
import { Dialog, playGame, runMigrations, tableEngine } from './playGame'
import { getElement, sendAnalytics } from './util'

type PromptEvent = Event & {
    prompt: () => void
    userChoice: Promise<{outcome: 'accepted' | 'rejected' | 'default'}>
}

if ('serviceworker' in navigator) {
    const wb = new Workbox('./pwa-service-worker.js');

    // Add an event listener to detect when the registered
    // service worker has installed but is waiting to activate.
    wb.addEventListener('waiting', (event) => {
        // `event.wasWaitingBeforeRegister` will be false if this is
        // the first time the updated service worker is waiting.
        // When `event.wasWaitingBeforeRegister` is true, a previously
        // updated same service worker is still waiting.
        // You may want to customize the UI prompt accordingly.

        // Assumes your app has some sort of prompt UI element
        // that a user can either accept or reject.
        const prompt = confirm('A new version is available. Would you like to reload?')
        if (prompt) {
            // Assuming the user accepted the update, set up a listener
            // that will reload the page as soon as the previously waiting
            // service worker has taken control.
            wb.addEventListener('controlling', (event) => {
                window.location.reload()
            })

            // Send a message telling the service worker to skip waiting.
            // This will trigger the `controlling` event handler above.
            // Note: for this to work, you have to add a message
            // listener in your service worker. See below.
            wb.messageSW({type: 'SKIP_WAITING'})
        }
    })

    wb.register()

}

window.addEventListener('load', () => {
    alert('I am newer!!!!!!!!!!!!!!!')

    const htmlTitle = getElement('title')
    const body = getElement('body')
    const testShowNotificationButton = getElement('#testShowNotificationButton')
    const iosInstallInstructions = getElement('#iosInstallInstructions')

    runMigrations()

    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
        iosInstallInstructions.classList.remove('hidden')
    }

    // Populate the dropdown with the current game in the hash
    let previousHash: Optional<string> = null

    const originalTitle = htmlTitle.textContent
    function handleHashChange() {
        const { hash } = window.location
        if (previousHash !== hash) {
            if (!previousHash && hash) {
                // Play a game!
                const [ gameId, levelStr, showTableStr ] = window.location.hash.substring(1).replace(/^\//, '').split('/')
                body.setAttribute('data-mode', 'playingGame')
                const showTable = !!showTableStr && showTableStr.toLowerCase() === 'true'
                playGame(gameId, levelStr ? Number.parseInt(levelStr, 10) : null, showTable)
            } else if (!hash) {
                // Browse the games
                htmlTitle.textContent = originalTitle
                body.setAttribute('data-mode', 'browseGames')
                body.classList.remove('is-background-dark')
                body.removeAttribute('style') // clear the background color
                browseGames()
            }
            previousHash = hash
        }
    }
    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()

    // Show/hide the "Add controller" message if a Gamepad is attached
    const gamepadIcon = getElement('#gamepadIcon')
    const gamepadDisabled = getElement('#gamepadDisabled')
    const gamepadRecognized = getElement('#gamepadRecognized')
    const gamepadNotRecognized = getElement('#gamepadNotRecognized')
    const messageDialog = getElement<Dialog>('#messageDialog')
    const messageDialogClose = getElement<Dialog>('#messageDialogClose')

    if (tableEngine.inputWatcher) {
        setInterval(() => {
            if (tableEngine.inputWatcher.gamepad.isRecognized()) {
                // Send GA when someone adds a gamepad
                if (!gamepadIcon.classList.contains('enabled')) {
                    sendAnalytics('send', 'event', 'gamepad', 'recognized')
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
                    sendAnalytics('send', 'event', 'gamepad', 'something-connected')
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

    testShowNotificationButton.addEventListener('click', async() => {
        const msg = `You are playing a game! (just a test notification)`

        // Show a phone notification rather than an alert (if notifications are granted)
        // Just to show that notifications can be done and what they would look like
        const notificationOptions = {
            body: msg,
            icon: './pwa-icon-144.png',
            badge: './pwa-icon-144.png',
            vibrate: [200, 100, 200],
            actions: [
                { action: 'action-1', title: 'Option 1' },
                { action: 'action-2', title: 'Option 2' }
            ]
        }
        await new Promise((resolve) => {
            // Notification is not available on iOS
            if (typeof Notification !== 'undefined') { // tslint:disable-line:strict-type-predicates
                Notification.requestPermission(async(result) => { // tslint:disable-line:no-floating-promises
                    // Safari does not support registration.showNotification() so we fall back to new Notification()
                    const fallback = () => {
                        new Notification('Test Title', notificationOptions) // tslint:disable-line:no-unused-expression
                        resolve()
                    }
                    if (result === 'granted') {
                        if (navigator.serviceWorker) {
                            // Mobile notification (Android Chrome)
                            const registration = await navigator.serviceWorker.ready
                            if (registration.showNotification) {
                                await registration.showNotification('Test Title', notificationOptions)
                                resolve()
                            } else {
                                fallback()
                            }
                        } else {
                            // Desktop notification Fallback (Firefox)
                            fallback()
                        }
                    } else {
                        alert(msg)
                        resolve()
                    }
                })
            } else {
                alert(msg)
                resolve()
            }
        })

    })

})
