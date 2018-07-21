import { readFileSync, writeFileSync, existsSync, createReadStream } from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pify from 'pify'
import * as supportsColor from 'supports-color'
import * as inquirer from 'inquirer'
import PromptModule, * as autocomplete from 'inquirer-autocomplete-prompt'
import chalk from 'chalk'

import {Parser, GameEngine, LoadingCellsEvent, closeSounds, GameData, Optional, RULE_DIRECTION} from './'
import TerminalUI, { getTerminalSize } from './ui'
import { saveCoverageFile } from './recordCoverage';

export type GameRecording = {
    version: number,
    solutions: LevelRecording[]
}
export type LevelRecording = {
    partial?: string,
    solution?: string
}


async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function first2Lines(filePath: string) {

    const opts = {
        encoding: 'utf8',
        lineEnding: '\n'
    }
    return new Promise<string>((resolve, reject) => {
        const rs = createReadStream(filePath, { encoding: opts.encoding });
        let acc = ''
        let pos = 0
        let index
        rs
            .on('data', (chunk: string) => {
                index = chunk.indexOf(opts.lineEnding)
                acc += chunk
                if (index === -1) {
                    pos += chunk.length
                } else {
                    index = chunk.indexOf(opts.lineEnding, index + 1)
                    if (index >= 0) {
                        pos += index
                        rs.close()
                    } else {
                        pos+= chunk.length
                    }
                }
            })
            .on('close', () => resolve(acc.slice(acc.charCodeAt(0) === 0xFEFF ? 1 : 0, pos)))
            .on('error', err => reject(err))
    })
}

// keypress(process.stdin)
// keypress.enableMouse(process.stdout)


function toUnicode(theString: string) {
    var unicodeString = '';
    for (var i = 0; i < theString.length; i++) {
        var theUnicode = theString.charCodeAt(i).toString(16).toUpperCase();
        while (theUnicode.length < 4) {
            theUnicode = '0' + theUnicode;
        }
        theUnicode = '\\u' + theUnicode;
        unicodeString += theUnicode;
    }
    return unicodeString;
}

type GameInfo = { id: string, title: string, filePath: string }
type SaveFile = { version: number, solutions: { solution?: string, partial?: string }[] }

run()


async function run() {
    inquirer.registerPrompt('autocomplete', <PromptModule>autocomplete)
    const gists = await pify(glob)(path.join(__dirname, '../gists/*/script.txt'))

    const games: GameInfo[] = []

    const titleRegexp = /title/i
    for (const filePath of gists) {
        const lines = await first2Lines(filePath)
        const linesAry = lines.split('\n')
        let title
        if (titleRegexp.test(linesAry[0])) {
            title = linesAry[0].replace(/title /i, '')
        } else if (titleRegexp.test(linesAry[1])) {
            title = linesAry[1].replace(/title /i, '')
        } else {
            throw new Error(`BUG: Game does not have a title section in the 1st 2 lines`)
        }

        games.push({
            id: path.basename(path.dirname(filePath)),
            title: title,
            filePath: filePath
        })
    }

    console.log(``)
    console.log(``)
    console.log(`Let's play some ${chalk.bold.redBright('P')}${chalk.bold.greenBright('U')}${chalk.bold.blueBright('Z')}${chalk.bold.yellowBright('Z')}${chalk.bold.cyanBright('L')}${chalk.bold.magentaBright('E')}${chalk.bold.whiteBright('S')}!`)
    console.log(``)
    console.log(``)
    console.log(`${chalk.dim('Games that are')} ${chalk.bold.whiteBright('white')} ${chalk.dim('are great to start out,')} ${chalk.bold.white('gray')} ${chalk.dim('are fun and run, and')} ${chalk.bold.dim('dark')} ${chalk.dim('may or may not run.')}`)
    console.log(``)

    // loop indefinitely
    let wantsToPlayAgain = false
    do {
        const { filePath: gamePath, id: gistId } = await promptGame(games)
        const absPath = path.resolve(gamePath)
        const code = readFileSync(absPath, 'utf-8')
        const { data, error, trace } = Parser.parse(code)

        if (error && trace) {
            console.log(trace.toString())
            console.log(error.message)
            throw new Error(error.message)
        } else {
            if (!data) {
                throw new Error(`BUG: did not load gameData`)
            }
            showControls();
            // check to see if the terminal is too small
            await promptPixelSize(data);

            // Load the solutions file (if it exists) so we can append to it
            const solutionsPath = path.join(__dirname, `../gist-solutions/${gistId}.json`)
            let recordings: { version: number, solutions: LevelRecording[], title: string, totalLevels: number, totalMapLevels: number }
            if (existsSync(solutionsPath)) {
                recordings = JSON.parse(readFileSync(solutionsPath, 'utf-8'))
            } else {
                recordings = { version: 1, solutions: [], title: data.title, totalLevels: data.levels.length, totalMapLevels: data.levels.filter(l => l.isMap()).length } // default
            }

            let currentLevelNum = await promptChooseLevel(recordings, data)

            // Allow the user to resume from where they left off
            let ticksToRunFirst = ''
            if (recordings.solutions[currentLevelNum] && (recordings.solutions[currentLevelNum].partial || recordings.solutions[currentLevelNum].solution)) {
                const { shouldResume } = await inquirer.prompt<{ shouldResume: boolean }>({
                    type: 'confirm',
                    name: 'shouldResume',
                    message: 'Would you like to resume where you left off?',
                })
                if (shouldResume) {
                    ticksToRunFirst = recordings.solutions[currentLevelNum].partial || recordings.solutions[currentLevelNum].solution || ''
                }
            }

            // Prepare the keyboard handler
            if (process.stdin.setRawMode) {
                process.stdin.setRawMode(true)
            } else {
                throw new Error(`ERROR: stdin does not allow setting setRawMode (we need that for keyboard input`)
            }
            process.stdin.resume()
            process.stdin.setEncoding('utf8')

            TerminalUI.clearScreen()

            await playGame(data, currentLevelNum, recordings, ticksToRunFirst, absPath, solutionsPath)

            wantsToPlayAgain = await promptPlayAnother()
        }

    } while (wantsToPlayAgain)

    console.log(``)
    console.log(``)
    console.log(`Thanks for playing PuzzleScript Games! Check out these links for more:`)
    console.log(``)
    console.log(`- ${chalk.blueBright('https://puzzlescript.net')} : The PuzzleScript homepage`)
    console.log(`- ${chalk.blueBright('https://github.com/philschatz/puzzlescript-cli')} : Code for this program (${chalk.green('Help improve our code!')})`)
    console.log(``)
}


async function playGame(data: GameData, currentLevelNum: number, recordings: { version: number, solutions: { solution?: string, partial?: string }[] }, ticksToRunFirst: string, absPath: string, solutionsPath: string) {
    if (process.env['LOG_LEVEL'] === 'debug') {
        console.error(`Start playing "${data.title}". Level ${currentLevelNum}`)
    }

    const level = data.levels[currentLevelNum]
    let startTime = Date.now()
    const engine = new GameEngine(data)
    engine.on('loading-cells', ({ cellStart, cellEnd, cellTotal }: LoadingCellsEvent) => {
        // UI.writeDebug(`Loading cells ${cellStart}-${cellEnd} of ${cellTotal}. SpriteKey="${key}"`)
        const loading = `Loading... [`
        const barChars = '                    '
        TerminalUI.writeDebug(loading + barChars)
        const offset = loading.length + 1
        const barLength = barChars.length
        const percentStartYellow = Math.floor(barLength * cellStart / cellTotal)
        const percentStartBlack = Math.floor(barLength * (cellStart + cellEnd) / cellTotal)
        for (let i = 0; i < barLength; i++) {
            let fgColor = '#707070'
            let char = '█'
            if (i <= percentStartYellow) {
                fgColor = '#00ff00' // green
            } else if (i <= percentStartBlack) {
                fgColor = '#ffff00' // yellow
                // char = '▒' // ░▒▓
            }
            TerminalUI._drawPixel(i + offset, 0, fgColor, null, char)
        }
    })
    TerminalUI.clearScreen()
    engine.setLevel(data.levels.indexOf(level))


    function restartLevel() {
        engine.pressRestart()
        TerminalUI.renderScreen(true)
        keypresses = [] // clear key history
    }

    let keypresses = [...ticksToRunFirst]
    let pendingKey = null
    let shouldExitGame: boolean = false
    // https://stackoverflow.com/a/30687420
    process.stdin.on('data', handleKeyPress)
    function handleKeyPress(key: string) {
        switch (key) {
            case 'w':
            case '\u001B\u005B\u0041': // UP-ARROW
                pendingKey = 'W'; break
            case 's':
            case '\u001B\u005B\u0042': // DOWN-ARROW
                pendingKey = 'S'; break
            case 'a':
            case '\u001B\u005B\u0044': // LEFT-ARROW
                pendingKey = 'A'; break
            case 'd':
            case '\u001B\u005B\u0043': // RIGHT-ARROW
                pendingKey = 'D'; break
            case 'x':
            case ' ':
            case '\u000D':
                pendingKey = 'X'; break
            case 'r':
                return restartLevel()
            case 'u':
            case 'z':
                // update keypresses so that it does not contain the most-recent key
                let lastKey = null
                while ((lastKey = keypresses[keypresses.length - 1]) !== null) {
                    keypresses.pop()
                    if (lastKey === '.' || lastKey === ',') {
                    } else {
                        break
                    }
                }
                engine.pressUndo()
                TerminalUI.renderScreen(false)
                return
            case 'c':
                TerminalUI.clearScreen()
                TerminalUI.renderScreen(false)
                return
            case 'i':
                TerminalUI.moveInspector(RULE_DIRECTION.UP)
                return
            case 'j':
                TerminalUI.moveInspector(RULE_DIRECTION.LEFT)
                return
            case 'k':
                TerminalUI.moveInspector(RULE_DIRECTION.DOWN)
                return
            case 'l':
                TerminalUI.moveInspector(RULE_DIRECTION.RIGHT)
                return
            case 'p':
                const players = data.getPlayer().getCellsThatMatch()
                if (players.size === 1) {
                    TerminalUI.moveInspectorTo([...players][0])
                } else {
                    console.log(`There are ${players.size} players. Use tab to select which one`)
                }
                return
            case '\u0003': // Ctrl+C
                closeSounds()
                return process.exit(1)
            case '\u001B': // Escape
                saveCoverageFile(data, absPath, 'playgame')
                // Save the partially-completed steps
                if (keypresses.join('').replace(/\./g, '').length > 0) { // skip just empty ticks
                    recordings.solutions[currentLevelNum] = recordings.solutions[currentLevelNum] || {}
                    recordings.solutions[currentLevelNum].partial = keypresses.join('')
                    writeFileSync(solutionsPath, JSON.stringify(recordings, null, 2))
                }
                closeSounds()
                shouldExitGame = true
                return
            default:
                TerminalUI.writeDebug(`pressed....: "${toUnicode(key)}"`)
        }
    }

    function doPress(key: string, recordPress: boolean) {
        switch (key) {
            case 'W': engine.pressUp(); break
            case 'S': engine.pressDown(); break
            case 'A': engine.pressLeft(); break
            case 'D': engine.pressRight(); break
            case 'X': engine.pressAction(); break
            case '.':
            case ',':
                // just .tick()
                break
            default:
                throw new Error(`BUG: Invalid keypress character "${ticksToRunFirst[keyNum]}"`)
        }
        if (recordPress) {
            keypresses.push(key)
        }
    }

    // engine.on('cell:updated', cell => {
    //   UI.drawCellAt(data, cell, cell.rowIndex, cell.colIndex, false)
    // })

    TerminalUI.setGame(engine)
    TerminalUI.clearScreen()
    TerminalUI.renderScreen(false)
    TerminalUI.writeDebug(`Game: "${data.title}"`)

    let currentlyPlayingSoundPromise: Optional<Promise<void>> = null // stack the sounds so we know if one is playing

    // Run a bunch of ticks in case the user partially played a level
    let maxTickAndRenderTime = -1
    for (var keyNum = 0; keyNum < ticksToRunFirst.length; keyNum++) {
        doPress(ticksToRunFirst[keyNum], true)
        startTime = Date.now()
        const { changedCells, soundToPlay, didLevelChange, messageToShow } = engine.tick()

        if (soundToPlay) {
            if (!currentlyPlayingSoundPromise) {
                currentlyPlayingSoundPromise = soundToPlay.play().then(() => {
                    currentlyPlayingSoundPromise = null
                    return
                })
            }
        }

        if (messageToShow) {
            TerminalUI.renderMessageScreen(messageToShow)
        }

        // UI.renderScreen(data, engine.currentLevel)

        // Draw any cells that moved
        TerminalUI.drawCells(changedCells, false)

        if (didLevelChange) {
            currentLevelNum = engine.getCurrentLevelNum()
            TerminalUI.clearScreen()
            TerminalUI.renderScreen(false)
        }

        if (keyNum > 1) { // Skip the 1st couple because they might be cleaning up the level
            maxTickAndRenderTime = Math.max(maxTickAndRenderTime, Date.now() - startTime)
        }

        const msg = `Playback ${keyNum}/${ticksToRunFirst.length} of "${data.title}" (took ${Date.now() - startTime}ms)`
        TerminalUI.writeDebug(msg.substring(0, 160))

        await sleep(1) // sleep long enough to play sounds
        // await sleep(Math.max(100 - (Date.now() - startTime), 0))
    }

    let tickNum = 0
    while (true) {
        let maxSleepTime = 50
        // Exit the game if the user pressed escape
        if (shouldExitGame) {
            break // so we can detach key listeners
        }

        if (pendingKey && !engine.hasAgain()) {
            doPress(pendingKey, true/*record*/)
        }
        const startTime = Date.now()
        const { changedCells, soundToPlay, messageToShow, didLevelChange, wasAgainTick } = engine.tick()

        if (soundToPlay) {
            if (!currentlyPlayingSoundPromise) {
                currentlyPlayingSoundPromise = soundToPlay.play().then(() => {
                    currentlyPlayingSoundPromise = null
                    return
                })
            }
        }

        if (didLevelChange) {
            if (!supportsColor.stdout) {
                console.log('You beat the level!')
            }

            // Save the solution
            recordings.solutions[currentLevelNum] = { solution: keypresses.join('') }
            writeFileSync(solutionsPath, JSON.stringify(recordings, null, 2))
            keypresses = []
            pendingKey = null
            currentLevelNum = engine.getCurrentLevelNum()

            TerminalUI.clearScreen()
            TerminalUI.renderScreen(true)

            continue
        }

        // do this after cells are rendered (so they don't cover the message)
        if (messageToShow) {
            TerminalUI.renderMessageScreen(messageToShow)
        } else {
            // Draw any cells that moved
            TerminalUI.drawCells(changedCells, false)
        }

        const msg = `Tick: ${tickNum} took ${Date.now() - startTime}ms. Moves: ${[...keypresses].reverse().join('').substring(0, 20)}`
        TerminalUI.writeDebug(msg.substring(0, 160))

        if (wasAgainTick) {
            keypresses.push(',')
        } else {
            if (!pendingKey && changedCells.size > 0) {
                keypresses.push('.') // Add a "tick"
                if (process.env.NODE_ENV === 'development') {
                    maxSleepTime = 500 // Slow down when every "." matters (for recording)
                }
            }
            pendingKey = null
        }

        await sleep(Math.max(maxSleepTime - (Date.now() - startTime), 0))

        tickNum++
    }

    // Some versions of node do not offer this method (e.g. maybe v8.11.1)
    if (process.stdin.off) {
        process.stdin.off('data', handleKeyPress)
    }
}

async function promptPlayAnother() {
    const { playAnotherGame } = await inquirer.prompt<{
        playAnotherGame: boolean;
    }>({
        type: 'confirm',
        name: 'playAnotherGame',
        message: 'Would you like to play another game?',
    })
    return playAnotherGame
}

async function promptChooseLevel(recordings: SaveFile, data: GameData) {
    const levels = data.levels
    const firstUncompletedLevel = levels
        .indexOf(levels
            .filter((l, index) => !(recordings.solutions[index] && recordings.solutions[index].solution))[0]
        )

    const { currentLevelNum } = await inquirer.prompt<{
        currentLevelNum: number;
    }>([{
        type: 'list',
        name: 'currentLevelNum',
        message: 'Which Level would you like to play?',
        default: firstUncompletedLevel,
        pageSize: Math.max(15, getTerminalSize().rows - 15),
        choices: levels.map((levelMap, index) => {
            const hasSolution = recordings.solutions[index] && recordings.solutions[index].solution;
            if (levelMap.isMap()) {
                const levelRows = levelMap.getRows();
                const cols = levelRows[0];
                let width = cols.length;
                let height = levelRows.length;
                // If flickscreen or zoomscreen is enabled, then change the level size
                // that is reported
                const { zoomscreen, flickscreen } = data.metadata;
                if (flickscreen) {
                    height = flickscreen.height;
                    width = flickscreen.width;
                }
                if (zoomscreen) {
                    height = zoomscreen.height;
                    width = zoomscreen.width;
                }
                const { columns, rows } = getTerminalSize()
                const isTooWide = columns < width * 5 * TerminalUI.PIXEL_WIDTH;
                const isTooTall = rows < height * 5 * TerminalUI.PIXEL_HEIGHT;
                let message = '';
                if (isTooWide && isTooTall) {
                    message = `(too tall & wide for your terminal)`;
                }
                else if (isTooWide) {
                    message = `(too wide for your terminal)`;
                }
                else if (isTooTall) {
                    message = `(too tall for your terminal)`;
                }
                if (hasSolution) {
                    return {
                        name: `${chalk.green(`${index}`)} ${chalk.dim(`(${width} x ${height}) ${chalk.green('(SOLVED)')}`)} ${chalk.yellowBright(message)}`,
                        value: index,
                    };
                }
                else {
                    if (message) {
                        return {
                            name: `${chalk.whiteBright(`${index}`)} ${chalk.red(`(${width} x ${height})`)} ${chalk.yellowBright(message)}`,
                            value: index,
                        };
                    }
                    else {
                        return {
                            name: `${chalk.whiteBright(`${index}`)} ${chalk.green(`(${width} x ${height})`)}`,
                            value: index,
                        };
                    }
                }
            }
            else {
                const message = levelMap.getMessage()
                let snippet = message.split('\n')[0] // just use the 1st line
                if (snippet.length > 40) {
                    snippet = `${snippet.substring(0, 40)}...`
                }
                return {
                    name: chalk.dim(`... "${snippet}"`),
                    value: index
                };
            }
        })
    }])

    return currentLevelNum
}

async function promptPixelSize(data: GameData) {
    if (!TerminalUI.willAllLevelsFitOnScreen(data)) {
        // Draw some example sprites
        console.log('Some of the levels in this game are too large for your terminal.');
        console.log('You can resize your terminal or use compact sprites.');
        console.log('There may be some graphical artifacts if you use compact sprites.');
        console.log('Below are examples of a compact sprite and a non-compacted sprite:');
        console.log('');
        const b = chalk.bgBlueBright(' ');
        const y = chalk.bgYellowBright(' ');
        const k = chalk.bgBlack(' ');
        const by = chalk.bgBlueBright.yellowBright('▄');
        const yb = chalk.bgYellowBright.blueBright('▄');
        const yk = chalk.black.bgYellowBright('▄');
        const ky = chalk.bgBlack.yellowBright('▄');
        const bk = chalk.bgBlueBright.black('▄');
        console.log(b + b + b + b + b + b + b + b + b + b + b + b + b + b);
        console.log(b + b + b + b + y + y + y + y + y + y + b + b + b + b);
        console.log(b + b + y + y + k + k + y + y + k + k + y + y + b + b);
        console.log(b + b + k + k + y + y + y + y + y + y + k + k + b + b);
        console.log(b + b + y + y + k + k + k + k + k + k + y + y + b + b);
        console.log(b + b + b + b + y + y + y + y + y + y + b + b + b + b);
        console.log(b + b + b + b + b + b + b + b + b + b + b + b + b + b);
        console.log('');
        console.log('');
        console.log(b + b + by + by + by + b + b);
        console.log(b + yk + ky + y + ky + yk + b);
        console.log(b + yb + ky + ky + ky + yb + b);
        console.log(bk + bk + bk + bk + bk + bk + bk);
        const { useCompressedCharacters } = await inquirer.prompt<{
            useCompressedCharacters: boolean;
        }>({
            type: 'confirm',
            name: 'useCompressedCharacters',
            default: true,
            message: 'Would you like to use small characters when rendering the game?',
        });
        if (useCompressedCharacters) {
            TerminalUI.setSmallTerminal(true);
        }
    }
}

async function promptGame(games: GameInfo[]) {
    // Sort games by games that are fun and should be played first
    const firstGames = [
        'Pot Wash Panic',
        'PUSH',
        'Beam Islands',
        'Pants, Shirt, Cap',
        'Entanglement - Chapter One',
        'Mirror Isles',
        'IceCrates',
        'Boxes & Balloons',
        'Boxes Love Bloxing Gloves',
        'Cyber-Lasso',
        'Pushcat Jr',
        'Skipping Stones to Lonely Homes',
        'Hack the Net',
        'Garten der Medusen',
        'SwapBot',
        'Separation',
        'Roll those Sixes',
        'Spacekoban',
        "Spikes 'n' Stuff",
        'Rock, Paper, Scissors (v0.90 = v1.alpha)',
        'Spooky Pumpkin Game',
        'Vacuum',
        'Miss Direction',
        'Alien Disco',
        'Some lines were meant to be crossed',
        'Flying Kick⁣',
        'Memories Of Castlemouse',
        'Bubble Butler: CMD REORGANIZE',
        'Sokoboros',
        'Sleepy players',
        // rosden games
        'bomb n ice',
        'compressed',
        'consumed to 1',
        'duality',
        'dup-block',
        'fire in winter',
        'fuse to green',
        'inbetween',
        'infected',
        'interconnection',
        'Path lines',
        'pull and push',
        'purple',
        'rows and columns',
        'shifting',
        'sticky',
        'Teleporters',
        'The art of storage',
        'the big dig',
        'the copying',
        'the walls you leave behind',
        'tile step',
        'using pushers',
        // End rosden games
        'Airport Aggression',
        'Coin Counter',
        'Dangerous Dungeon',
        'Easy Enigma',
        "Spider's Hollow",
        'MazezaM',
        'pretender to the crown',
        'Vines',
        'Unconventional Guns⁣',
        'Dungeon Janitor',
        'It Dies In The Light',
        'Collapse',
        'JAM3 Game',
        'Collapsable Sokoban',
        'Element Walkers',
        'Telefrag',
        'Count Mover',
        'ESL Puzzle Game -- CHALLENGE MODE アダムのパズルゲーム'
    ]
    function getGameIndexForSort(gameInfo: GameInfo) {
        let gameIndex = firstGames.indexOf(gameInfo.title)
        if (gameIndex < 0) {
            gameIndex = firstGames.length
        }
        return gameIndex
    }
    games = games.sort((a, b) => {
        return getGameIndexForSort(a) - getGameIndexForSort(b)
    })

    const question: inquirer.Question = <inquirer.Question>{
        type: 'autocomplete',
        name: 'gameTitle',
        message: 'Which game would you like to play?',
        pageSize: Math.max(15, getTerminalSize().rows - 15),
        source: async (answers: void, input: string) => {
            let filteredGames
            if (!input) {
                filteredGames = games
            } else {
                filteredGames = games.filter(({ id, title, filePath }) => {
                    return title.toLowerCase().indexOf(input.toLowerCase()) >= 0
                })
            }
            return Promise.resolve(filteredGames.map(game => {
                // dim the games that are not recommended
                const index = firstGames.indexOf(game.title)
                if (index < 0) {
                    return chalk.dim('\u2063' + game.title + '\u2063') // add an invisible unicode character so we can unescape the title later
                } else if (index <= 10) {
                    return chalk.bold.whiteBright('\u2063' + game.title + '\u2063')
                } else {
                    return chalk.white('\u2063' + game.title + '\u2063') // add an invisible unicode character so we can unescape the title later
                }
            }))
        },
        // choices: games.map(({id, title, filePath}) => {
        //     return {
        //         name: `${title} ${chalk.dim(`(${id})`)}`,
        //         value: filePath,
        //         short: id,
        //     }
        // })
    }
    const { gameTitle } = await inquirer.prompt<{ gameTitle: string }>([question])

    // Filter out the DIM escape codes (to give the game titles a color)
    const firstInvisible = gameTitle.indexOf('\u2063')
    const lastInvisible = gameTitle.lastIndexOf('\u2063')
    let uncoloredGameTitle: string
    if (firstInvisible >= 0) {
        uncoloredGameTitle = gameTitle.substring(firstInvisible + 1, lastInvisible)
    } else {
        uncoloredGameTitle = gameTitle
    }

    const chosenGame = games.filter(game => game.title === uncoloredGameTitle)[0]

    if (!chosenGame) {
        throw new Error(`BUG: Could not find game "${uncoloredGameTitle}"`)
    }
    return chosenGame
}


function showControls() {
    function prettyKey(keyCode: string) {
        return chalk.whiteBright.bgWhite(`[${chalk.black(keyCode)}]`);
    }
    console.log(`-------------------------------------`);
    console.log(`Controls:`);
    console.log(`  ${prettyKey('W')} or ${prettyKey('up')}    : Move Up`);
    console.log(`  ${prettyKey('S')} or ${prettyKey('down')}  : Move Down`);
    console.log(`  ${prettyKey('A')} or ${prettyKey('left')}  : Move Left`);
    console.log(`  ${prettyKey('D')} or ${prettyKey('right')} : Move Right`);
    console.log(`  ${prettyKey('X')} or ${prettyKey('space')} : Perform Action`);
    console.log(`  ${prettyKey('Z')} or ${prettyKey('U')}     : Undo`);
    console.log(`  ${prettyKey('R')}            : Restart the current level`);
    console.log(`  ${prettyKey('C')}            : Clear and redraw the screen`);
    console.log(`  ${prettyKey('esc')}          : Exit the Game`);
    console.log(`-------------------------------------`);
    console.log(`Accessibility Controls: (for inspecting which sprites are in the puzzle)`);
    console.log(`  ${prettyKey('I')}            : Move Inspector Up`);
    console.log(`  ${prettyKey('K')}            : Move Inspector Down`);
    console.log(`  ${prettyKey('J')}            : Move Inspector Left`);
    console.log(`  ${prettyKey('L')}            : Move Inspector Right`);
    console.log(`  ${prettyKey('P')}            : Move Inspector onto the Player`);
    console.log(`-------------------------------------`);
}

