window.addEventListener('load', () => {

    const table = document.querySelector('#theGame')
    const gameSelection = document.querySelector('#gameSelection')
    const loadingIndicator = document.querySelector('#loadingIndicator')
    let gameId // used for loading and saving game progress

    // Save when the user completes a level
    const handler = {
        onLevelChange: function (newLevelNum) {
            // Hide the Loading text because the level loaded
            loadingIndicator.classList.add('hidden')
            gameSelection.removeAttribute('disabled')

            setStorage(gameId, newLevelNum)
        }
    }


    function startTableEngine(webworkerUrl) {

        const worker = new Worker(webworkerUrl)
        const tableEngine = new window.PuzzleScript.WebworkerTableEngine(worker, table, handler)
        // const tableEngine = new window.PuzzleScript.SyncTableEngine(table, handler)

        startGamepadDetection(tableEngine)
        playSelectedGame(tableEngine)

        // Load the new game when the dropdown changes
        gameSelection.addEventListener('change', function () { playSelectedGame(tableEngine)})
    }


    let cacheApi
    if (window.caches) {
        cacheApi = window.caches
    } else {
        // In-memory polyfill for browsers that do not support https://developer.mozilla.org/en-US/docs/Web/API/Cache
        const memCaches = new Map()
        class InMemoryCache {
            constructor() { this.map = new Map() }
            put(request, response) { this.map.set(request.url, response.clone()) }
            match(request) { 
                const ret = this.map.get(request.url)
                if (ret) {
                    return Promise.resolve(ret.clone())
                } else {
                    return Promise.reject(`Cache miss for ${request.url}`)
                }
            }
        }
        cacheApi = {
            open: function (cacheName) {
                let ret = memCaches.get(cacheName) || new InMemoryCache()
                memCaches.set(cacheName, ret)
                return Promise.resolve(ret)
            }
        }
    }

    // From https://stackoverflow.com/a/39367408
    const CACHE_NAME = 'puzzlescript'
    function cacheFetch(url, options) {
        const request = new Request(url, options)
        const requestURL = new URL(request.url)
        const freshResource = fetch(request).then(function (response) {
            const clonedResponse = response.clone()
            // Don't update the cache with error pages!
            if (response.ok) {
                // All good? Update the cache with the network response
                cacheApi.open(CACHE_NAME).then(function (cache) {
                    cache.put(request, clonedResponse)
                })
            }
            return response
        })
        const cachedResource = cacheApi.open(CACHE_NAME).then(function (cache) {
            return cache.match(request).then(function(response) {
                return response || freshResource
            })
        }).catch(function (e) {
            return freshResource
        })
        return cachedResource
    }

    function playSelectedGame(tableEngine) {
        loadingIndicator.classList.remove('hidden') // Show the "Loading..." text
        gameSelection.setAttribute('disabled', 'disabled')

        gameId = gameSelection.value
        cacheFetch(`./games/${gameId}/script.txt`, {redirect: 'follow'})
        .then(resp => {
            if (resp.ok) {
                return resp.text().then(function(source) {
                    // Load the game
                    tableEngine.setGame(source, getStorage(gameId) || 0)
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




    startTableEngine('./lib/puzzlescript-webworker.js')

    // Show/hide the "Add controller" message if a Gamepad is attached
    const gamepadIcon = document.querySelector('#gamepadIcon')
    const gamepadDisabled = document.querySelector('#gamepadDisabled')
    const gamepadRecognized = document.querySelector('#gamepadRecognized')
    const gamepadNotRecognized = document.querySelector('#gamepadNotRecognized')
    function startGamepadDetection(tableEngine) {
        if (tableEngine.inputWatcher) {
            setInterval(() => {
                if (tableEngine.inputWatcher.gamepad.isRecognized()) {
                    gamepadIcon.classList.add('enabled')
                    gamepadDisabled.classList.add('hidden')
                    gamepadRecognized.classList.remove('hidden')
                    gamepadNotRecognized.classList.add('hidden')
                } else if (tableEngine.inputWatcher.gamepad.isSomethingConnected()) {
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

    // See https://gist.github.com/willywongi/5780151#file-2-index-html-L86
    function loadRemoteWebworker(webworkerUrl, callback) {
        return cacheFetch(webworkerUrl, {redirect: 'follow'})
        .then(function (resp) {
            return resp.text()
            .then(function (source) {
                callback(window.URL.createObjectURL(new Blob([source])))
            })
        })
    }

    // Functions for loading/saving game progress
    function getStorage(gameId) {
        const storageStr = window.localStorage.getItem('puzzlescriptGameProgress')
        if (storageStr) {
            return JSON.parse(storageStr)[gameId]
        } else {
            return null
        }
    }
    function setStorage(gameId, levelNum) {
        const storageStr = window.localStorage.getItem('puzzlescriptGameProgress')
        const storage = storageStr ? JSON.parse(storageStr) : {}
        storage[gameId] = levelNum
        window.localStorage.setItem('puzzlescriptGameProgress', JSON.stringify(storage))
    }

    // Support toggling the "Enable CSS" checkbox
    const disableCss = document.querySelector('#disableCss')
    function setUi() {
        if (disableCss.checked) {
            table.classList.add('ps-ui-disabled')
        } else {
            table.classList.remove('ps-ui-disabled')
        }
        table.focus()
    }
    disableCss.addEventListener('change', setUi)
    setUi()




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