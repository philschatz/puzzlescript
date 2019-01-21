window.addEventListener('load', () => {

    const WEBWORKER_URL = './puzzlescript-webworker.js'
    const GAME_STORAGE_ID = 'puzzlescriptGameProgress'
    const table = document.querySelector('#theGame')
    const gameSelection = document.querySelector('#gameSelection')
    const loadingIndicator = document.querySelector('#loadingIndicator')

    window.PuzzleScript.TimeAgo.addLocale(window.PuzzleScript.TimeAgoEn)
    const timeAgo = new window.PuzzleScript.TimeAgo('en-US')

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
            updateGameSelectionInfo()
        },
        onGameChange: function (gameData) {
            saveGameInfo(gameId, gameData.levels, gameData.title)
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
        if (!gameId) {
            return
        }
        fetch(`./games/${gameId}/script.txt`, {redirect: 'follow'})
        .then(resp => {
            if (resp.ok) {
                return resp.text().then(function(source) {
                    // Load the game
                    tableEngine.setGame(source, loadCurrentLevelNum(gameId) || 0)
                })
            } else {
                alert(`Problem finding game file. Please choose another one`)
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
    function saveGameInfo(gameId, levels, title) {
        const storage = loadStorage()
        storage[gameId] = storage[gameId] || {}
        storage[gameId].levelMaps = levels.map(l => l.type === 'LEVEL_MAP')
        storage[gameId].title = title
        storage[gameId].lastPlayedAt = Date.now()
        window.localStorage.setItem(GAME_STORAGE_ID, JSON.stringify(storage))
    }

    // store the original sort order so that we fall back to it.
    gameSelection.querySelectorAll('option').forEach((option, index) => {
        option.setAttribute('data-original-index', index)
    })

    function updateGameSelectionInfo() {
        const storage = loadStorage()

        // Update the last-updated time for all of the games and then sort them
        const gameOptions = [...gameSelection.querySelectorAll('option')]
        for (const option of gameOptions) {
            const gameId = option.getAttribute('value')
            const gameInfo = storage[gameId]
            if (gameInfo) {
                const currentMapLevels = gameInfo.levelMaps.slice(0, gameInfo.currentLevelNum - 1).filter(b => b).length
                const totalMapLevels = gameInfo.levelMaps.filter(b => b).length
                const percent = Math.floor(100 * currentMapLevels / totalMapLevels)
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
            const percent = Number.parseInt(option.getAttribute('data-percent-complete'))
            const lastPlayed = Number.parseInt(option.getAttribute('data-last-played-at'))
            const originalIndex = Number.parseInt(option.getAttribute('data-original-index'))
            
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
        const lastPlayedComparator = (a, b) => {
            const aLastPlayed = Number.parseInt(a.getAttribute('data-last-played-at'))
            const bLastPlayed = Number.parseInt(b.getAttribute('data-last-played-at'))
            return bLastPlayed - aLastPlayed
        }
        continuePlayingOptions.sort(lastPlayedComparator)
        uncompletedOptions.sort(lastPlayedComparator)
        completedOptions.sort(lastPlayedComparator)
        newGameOptions.sort((a, b) => {
            const aOriginalIndex = Number.parseInt(a.getAttribute('data-original-index'))
            const bOriginalIndex = Number.parseInt(b.getAttribute('data-original-index'))
            return aOriginalIndex - bOriginalIndex
        })

        gameSelection.value = null // clear the selection because we will be adding

        for (const option of gameOptions) {
            gameSelection.remove(option)
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

    function createSeparator(textContent) {
        const el = document.createElement('option')
        el.setAttribute('disabled', 'disabled')
        el.textContent = `--- ${textContent}`
        return el
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