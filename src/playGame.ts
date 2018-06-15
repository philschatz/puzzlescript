import { readFileSync, writeFileSync, existsSync } from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pify from 'pify'
import * as inquirer from 'inquirer'
import * as autocomplete from 'inquirer-autocomplete-prompt'
import * as firstline from 'firstline'
import chalk from 'chalk'

import Parser from './parser/parser'
import UI from './ui'
import { GameEngine } from './engine'
import { saveCoverageFile } from './recordCoverage';
import { closeSounds } from './models/sound';
import { RULE_DIRECTION_ABSOLUTE } from './util';
import { GameData } from './models/game';


async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// keypress(process.stdin)
// keypress.enableMouse(process.stdout)


function toUnicode(theString) {
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

run()


async function run() {
    const gists = await pify(glob)('./gists/*/script.txt')

    const games: GameInfo[] = []

    for (const filePath of gists) {
        games.push({
            id: path.basename(path.dirname(filePath)),
            title: (await firstline(filePath)).replace(/title /i, ''),
            filePath: filePath
        })
    }

    console.log(``)
    console.log(``)
    console.log(`Let's play some ${chalk.bold.redBright('P')}${chalk.bold.greenBright('U')}${chalk.bold.blueBright('Z')}${chalk.bold.yellowBright('Z')}${chalk.bold.cyanBright('L')}${chalk.bold.magentaBright('E')}${chalk.bold.whiteBright('S')}!`)
    console.log(``)
    console.log(``)

    // loop indefinitely
    let wantsToPlayAgain = false
    do {
        const { filePath: gamePath, id: gistId } = await promptGame(games)
        const absPath = path.resolve(gamePath)
        const code = readFileSync(absPath, 'utf-8')
        const startTime = Date.now()
        const { data, error, trace, validationMessages } = Parser.parse(code)

        if (error) {
            console.log(trace.toString())
            console.log(error.message)
            throw new Error(error.message)
        } else {
            showControls();
            // check to see if the terminal is too small
            await promptPixelSize(data);

            // Load the solutions file (if it exists) so we can append to it
            const solutionsPath = path.join(__dirname, `../gist-solutions/${gistId}.json`)
            let recordings = []
            if (existsSync(solutionsPath)) {
                recordings = JSON.parse(readFileSync(solutionsPath, 'utf-8'))
            }

            let currentLevelNum = await promptChooseLevel(recordings, data)

            // Allow the user to resume from where they left off
            let ticksToRunFirst = ''
            if (recordings[currentLevelNum] && (recordings[currentLevelNum].partial || recordings[currentLevelNum].solution)) {
                const { shouldResume } = await inquirer.prompt<{ shouldResume: boolean }>({
                    type: 'confirm',
                    name: 'shouldResume',
                    message: 'Would you like to resume where you left off?',
                })
                if (shouldResume) {
                    ticksToRunFirst = recordings[currentLevelNum].partial || recordings[currentLevelNum].solution
                }
            }

            // Prepare the keyboard handler
            process.stdin.setRawMode(true)
            process.stdin.resume()
            process.stdin.setEncoding('utf8')

            UI.clearScreen()

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


async function playGame(data: GameData, currentLevelNum: number, recordings: any, ticksToRunFirst: string, absPath: string, solutionsPath: string) {
    if (process.env['LOG_LEVEL'] === 'debug') {
        console.error(`Start playing "${data.title}". Level ${currentLevelNum}`)
    }

    const level = data.levels[currentLevelNum]
    let startTime = Date.now()
    const engine = new GameEngine()
    engine.on('loading-cells', ({ cellStart, cellEnd, cellTotal, key }) => {
        // UI.writeDebug(`Loading cells ${cellStart}-${cellEnd} of ${cellTotal}. SpriteKey="${key}"`)
        const loading = `Loading... [`
        const barChars = '                    '
        UI.writeDebug(loading + barChars)
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
            UI._drawPixel(i + offset, 0, fgColor, null, char)
        }
    })
    engine.setGame(data)
    engine.setLevel(data.levels.indexOf(level))


    function restartLevel() {
        engine.pressRestart()
        UI.renderScreen(true)
        keypresses = [] // clear key history
    }

    let keypresses = []
    let pendingKey = null
    let shouldExitGame: boolean = false
    // https://stackoverflow.com/a/30687420
    process.stdin.on('data', handleKeyPress)
    function handleKeyPress(key) {
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
                pendingKey = 'X'; break
            case 'r':
                return restartLevel()
            case 'c':
                UI.clearScreen()
                UI.renderScreen(false)
                return
            case '\u0003': // Ctrl+C
                closeSounds()
                return process.exit(1)
            case '\u001B': // Escape
                saveCoverageFile(data, absPath, 'playgame')
                // Save the partially-completed steps
                if (keypresses.join('').replace(/\./g, '').length > 0) { // skip just empty ticks
                    recordings[currentLevelNum] = recordings[currentLevelNum] || {}
                    recordings[currentLevelNum].partial = keypresses.join('')
                    writeFileSync(solutionsPath, JSON.stringify(recordings, null, 2))
                }
                closeSounds()
                shouldExitGame = true
                return
            default:
                UI.writeDebug(`pressed....: "${toUnicode(key)}"`)
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

    UI.setGame(engine)
    UI.clearScreen()
    UI.renderScreen(false)
    UI.writeDebug(`Game: "${data.title}"`)

    let currentlyPlayingSoundPromise = null // stack the sounds so we know if one is playing

    // Run a bunch of ticks in case the user partially played a level
    let maxTickAndRenderTime = -1
    for (var keyNum = 0; keyNum < ticksToRunFirst.length; keyNum++) {
        doPress(ticksToRunFirst[keyNum], true)
        startTime = Date.now()
        const { changedCells, soundToPlay, didLevelChange } = engine.tick()

        if (soundToPlay) {
            if (!currentlyPlayingSoundPromise) {
                currentlyPlayingSoundPromise = soundToPlay.play().then(() => currentlyPlayingSoundPromise = null)
            }
        }

        // UI.renderScreen(data, engine.currentLevel)

        // Draw any cells that moved
        for (const cell of changedCells) {
            UI.drawCell(cell, false)
        }

        if (didLevelChange) {
            currentLevelNum = engine.getCurrentLevelNum()
            UI.clearScreen()
            UI.renderScreen(false)
        }

        if (keyNum > 1) { // Skip the 1st couple because they might be cleaning up the level
            maxTickAndRenderTime = Math.max(maxTickAndRenderTime, Date.now() - startTime)
        }

        const msg = `Playback ${keyNum}/${ticksToRunFirst.length} of "${data.title}" (took ${Date.now() - startTime}ms)`
        UI.writeDebug(msg.substring(0, 160))

        await sleep(1) // sleep long enough to play sounds
        // await sleep(Math.max(100 - (Date.now() - startTime), 0))
    }

    let tickNum = 0
    while (true) {
        // Exit the game if the user pressed escape
        if (shouldExitGame) {
            break // so we can detach key listeners
        }

        if (pendingKey && !engine.hasAgain()) {
            doPress(pendingKey, true/*record*/)
        }
        const startTime = Date.now()
        const { changedCells, soundToPlay, didLevelChange, wasAgainTick } = engine.tick()

        if (soundToPlay) {
            if (!currentlyPlayingSoundPromise) {
                currentlyPlayingSoundPromise = soundToPlay.play().then(() => currentlyPlayingSoundPromise = null)
            }
        }

        if (didLevelChange) {
            // Save the solution
            const newSolution = keypresses.join('')
            if (!recordings[currentLevelNum]) {
                recordings[currentLevelNum] = { solution: keypresses.join('') }
                writeFileSync(solutionsPath, JSON.stringify(recordings, null, 2))
            } else if (!recordings[currentLevelNum].solution) {
                recordings[currentLevelNum].solution = keypresses.join('')
                writeFileSync(solutionsPath, JSON.stringify(recordings, null, 2))
            }
            keypresses = []
            pendingKey = null

            // Skip the messages since they are not implmented yet
            currentLevelNum = engine.getCurrentLevelNum()
            while (!data.levels[currentLevelNum].isMap()) {
                currentLevelNum++
            }
            if (currentLevelNum !== engine.getCurrentLevelNum()) {
                engine.setLevel(currentLevelNum)
            }

            UI.clearScreen()
            UI.renderScreen(true)

            continue
        }

        // Draw any cells that moved
        for (const cell of changedCells) {
            UI.drawCell(cell, false)
        }

        const msg = `Tick: ${tickNum} took ${Date.now() - startTime}ms. Moves: ${[...keypresses].reverse().join('').substring(0, 20)}`
        UI.writeDebug(msg.substring(0, 160))

        if (wasAgainTick) {
            keypresses.push(',')
        } else {
            if (!pendingKey && changedCells.size > 0) {
                keypresses.push('.') // Add a "tick"
            }
            pendingKey = null
        }

        await sleep(Math.max(50 - (Date.now() - startTime), 0))

        tickNum++
    }

    process.stdin.off('data', handleKeyPress)
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

async function promptChooseLevel(recordings: any[], data: GameData) {
    const levels = data.levels
    const firstUncompletedLevel = levels
    .indexOf(levels
        .filter((l, index) => !(recordings[index] && recordings[index].solution))
        .filter(l => l.isMap())[0]
    )

    const { currentLevelNum } = await inquirer.prompt<{
        currentLevelNum: number;
    }>([{
        type: 'list',
        name: 'currentLevelNum',
        message: 'Which Level would you like to play?',
        default: firstUncompletedLevel,
        pageSize: Math.max(15, process.stdout.rows - 15),
        choices: levels.map((levelMap, index) => {
            const hasSolution = recordings[index] && recordings[index].solution;
            if (levelMap.isMap()) {
                const rows = levelMap.getRows();
                const cols = rows[0];
                let width = cols.length;
                let height = rows.length;
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
                const isTooWide = process.stdout.columns < width * 5 * UI.PIXEL_WIDTH;
                const isTooTall = process.stdout.rows < height * 5 * UI.PIXEL_HEIGHT;
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
                return {
                    name: chalk.dim('... just a message (not playable)'),
                    value: index
                };
            }
        })
    }])

    return currentLevelNum
}

async function promptPixelSize(data) {
    if (!UI.willAllLevelsFitOnScreen(data)) {
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
            default: process.env['NODE_ENV'] === 'production',
            message: 'Would you like to use small characters when rendering the game?',
        });
        if (useCompressedCharacters) {
            UI.setSmallTerminal(true);
        }
    }
}

async function promptGame(games: GameInfo[]) {
    inquirer.registerPrompt('autocomplete', autocomplete)
    const question: inquirer.Question = <inquirer.Question>{
        type: 'autocomplete',
        name: 'gameTitle',
        message: 'Which game would you like to play?',
        pageSize: Math.max(15, process.stdout.rows - 15),
        source: async (answers, input) => {
            if (!input) {
                return Promise.resolve(games.map(game => game.title))
            }
            return Promise.resolve(games.filter(({ id, title, filePath }) => {
                return title.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }).map(game => game.title))
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

    return games.filter(game => game.title === gameTitle)[0]
}


function showControls() {
    function prettyKey(keyCode) {
        return chalk.whiteBright.bgWhite(`[${chalk.black(keyCode)}]`);
    }
    console.log(`-------------------------------------`);
    console.log(`Controls:`);
    console.log(`  ${prettyKey('W')} or ${prettyKey('up')}    : Move Up`);
    console.log(`  ${prettyKey('S')} or ${prettyKey('down')}  : Move Down`);
    console.log(`  ${prettyKey('A')} or ${prettyKey('left')}  : Move Left`);
    console.log(`  ${prettyKey('D')} or ${prettyKey('right')} : Move Right`);
    console.log(`  ${prettyKey('X')} or ${prettyKey('space')} : Perform Action`);
    console.log(`  ${prettyKey('R')}            : Restart the current level`);
    console.log(`  ${prettyKey('C')}            : Clear and redraw the screen`);
    console.log(`  ${prettyKey('esc')}          : Exit the Game`);
    console.log(`-------------------------------------`);
}

