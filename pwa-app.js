window.addEventListener('load', () => {

    const WEBWORKER_URL = './puzzlescript-webworker.js'
    const GAME_STORAGE_ID = 'puzzlescriptGameProgress'
    const table = document.querySelector('#theGame')
    const gameSelection = document.querySelector('#gameSelection')
    const loadingIndicator = document.querySelector('#loadingIndicator')
    let gameId // used for loading and saving game progress

    // Save when the user completes a level
    const handler = {
        onMessage: function (msg) {

            // Show a phone notification rather than an alert (if notifications are granted)
            // Just to show that notifications can be done and what they would look like
            const notificationOptions = {
                body: `${msg} (Just showing that notifications work. You can disable them)`,
                icon: './pwa-icon.png',
                badge: './pwa-icon.png',
                vibrate: [200, 100, 200],
                actions: [
                    { action: 'action-ok', title: 'ok' }
                ]
            }
            return new Promise((resolve) => {
                Notification.requestPermission(async (result) => {
                    // Safari does not support registration.showNotification() so we fall back to new Notification()
                    const fallback = () => {
                        const notification = new Notification('Annoying Test Message', notificationOptions)
                        // notification.onshow = () => resolve()
                        resolve()
                    }
                    if (result === 'granted') {
                        if (navigator.serviceWorker) {
                            // Mobile notification (Android Chrome)
                            const registration = await navigator.serviceWorker.ready
                            if (registration.showNotification) {
                                await registration.showNotification('Annoying Test Message', notificationOptions)
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
            })
        },
        onLevelChange: function (newLevelNum) {
            // Hide the Loading text because the level loaded
            loadingIndicator.classList.add('hidden')
            gameSelection.removeAttribute('disabled')

            saveCurrentLevelNum(gameId, newLevelNum)
        },
        onGameChange: function (gameData) {
            saveTotalLevelCount(gameId, gameData.levels.length, gameData.title)
        }
    }

    updateGameSelectionInfo() // update the % complete in the dropdown

    function startTableEngine() {

        const worker = new Worker(WEBWORKER_URL)
        const tableEngine = new window.PuzzleScript.WebworkerTableEngine(worker, table, handler)
        // const tableEngine = new window.PuzzleScript.SyncTableEngine(table, handler)

        startGamepadDetection(tableEngine)
        playSelectedGame(tableEngine)

        // Load the new game when the dropdown changes
        gameSelection.addEventListener('change', function () { playSelectedGame(tableEngine)})
    }

    function playSelectedGame(tableEngine) {
        loadingIndicator.classList.remove('hidden') // Show the "Loading..." text
        gameSelection.setAttribute('disabled', 'disabled')

        gameId = gameSelection.value
        fetch(`./games/${gameId}/script.txt`, {redirect: 'follow'})
        .then(resp => {
            if (resp.ok) {
                return resp.text().then(function(source) {
                    // Load the game
                    tableEngine.setGame(source, loadCurrentLevelNum(gameId) || 0)
                })
            } else {
                alert('Problem finding game game file. Please choose another one')
                loadingIndicator.classList.add('hidden')
                gameSelection.removeAttribute('disabled')
            }
        },
        err => {
            alert('Could not download the game. Are you connected to the internet?')
            loadingIndicator.classList.add('hidden')
            gameSelection.removeAttribute('disabled')
        })
    }




    startTableEngine()

    // Show/hide the "Add controller" message if a Gamepad is attached
    const gamepadIcon = document.querySelector('#gamepadIcon')
    const gamepadDisabled = document.querySelector('#gamepadDisabled')
    const gamepadRecognized = document.querySelector('#gamepadRecognized')
    const gamepadNotRecognized = document.querySelector('#gamepadNotRecognized')
    function startGamepadDetection(tableEngine) {
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

    // Functions for loading/saving game progress
    function loadStorage() {
        const storageStr = window.localStorage.getItem(GAME_STORAGE_ID)
        const storage = storageStr ? JSON.parse(storageStr) : { _version: 1 }
        return storage
    }
    function loadCurrentLevelNum(gameId) {
        const storage = loadStorage()
        const gameData = storage[gameId]
        return (gameData || null) && gameData.currentLevelNum
    }
    function saveCurrentLevelNum(gameId, levelNum) {
        const storage = loadStorage()
        storage[gameId] = storage[gameId] || {}
        storage[gameId].currentLevelNum = levelNum
        storage[gameId].completedLevelAt = Date.now()
        storage[gameId].lastPlayedAt = Date.now()
        window.localStorage.setItem(GAME_STORAGE_ID, JSON.stringify(storage))
        ga && ga('send', 'event', 'game', 'level', gameId, levelNum)
    }
    function saveTotalLevelCount(gameId, totalLevelCount, title) {
        const storage = loadStorage()
        storage[gameId] = storage[gameId] || {}
        storage[gameId].totalLevelCount = totalLevelCount
        storage[gameId].title = title
        storage[gameId].lastPlayedAt = Date.now()
        window.localStorage.setItem(GAME_STORAGE_ID, JSON.stringify(storage))
    }

    function updateGameSelectionInfo() {
        const storage = loadStorage()

        for (const option of gameSelection.querySelectorAll('option')) {
            const gameId = option.getAttribute('value')
            const gameInfo = storage[gameId]
            if (gameInfo) {
                if (gameInfo.currentLevelNum === gameInfo.totalLevelCount) {
                    // Game is complete
                } else {
                    // Game is in-progress
                }
            } else {
                // Game has not started
            }
        }
    }

    // Support toggling the "Enable CSS" checkbox
    const disableCss = document.querySelector('#disableCss')
    function setUi(skipAnalytics) {
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
    disableCss.addEventListener('change', setUi)
    setUi(true)




    // https://developers.google.com/web/fundamentals/app-install-banners/#listen_for_beforeinstallprompt
    const btnAdd = document.querySelector('#btnAdd')
    let deferredPrompt
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI notify the user they can add to home screen
        btnAdd.classList.remove('hidden')
    })

    btnAdd.addEventListener('click', (e) => {
        btnAdd.classList.add('hidden')
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice
        .then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
            } else {
                console.log('User dismissed the A2HS prompt');
            }
            deferredPrompt = null;
        });
    })


})