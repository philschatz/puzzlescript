import { readFileSync, writeFileSync, existsSync } from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pify from 'pify'
import * as keypress from 'keypress'
import * as inquirer from 'inquirer'
import * as autocomplete from 'inquirer-autocomplete-prompt'
import * as firstline from 'firstline'
import chalk from 'chalk'

import Parser from './parser/parser'
import { IGameNode } from './models/game'
import UI from './ui'
import Engine from './engine'
import { setAddAll, RULE_DIRECTION_ABSOLUTE } from './util';
import { start } from 'repl';
import { IRule } from './models/rule';
import { RULE_DIRECTION } from './enums';
import { saveCoverageFile } from './recordCoverage';
import { closeSounds } from './models/sound';


async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// keypress(process.stdin)
// keypress.enableMouse(process.stdout)


function toUnicode(theString) {
    var unicodeString = '';
    for (var i=0; i < theString.length; i++) {
      var theUnicode = theString.charCodeAt(i).toString(16).toUpperCase();
      while (theUnicode.length < 4) {
        theUnicode = '0' + theUnicode;
      }
      theUnicode = '\\u' + theUnicode;
      unicodeString += theUnicode;
    }
    return unicodeString;
  }

async function run() {
    const gists = await pify(glob)('./gists/*/script.txt')

    const games: {id: string, title: string, filePath: string}[] = []

    for (const filePath of gists) {
        games.push({
            id: path.basename(path.dirname(filePath)),
            title: (await firstline(filePath)).replace(/title /i, ''),
            filePath: filePath
        })
    }

    inquirer.registerPrompt('autocomplete', autocomplete)
    const question: inquirer.Question = <inquirer.Question> {
        type: 'autocomplete',
        name: 'gameTitle',
        message: 'Which game would you like to play?',
        pageSize: Math.max(15, process.stdout.rows - 15),
        source: async (answers, input) => {
            if (!input) {
                return Promise.resolve(games.map(game => game.title))
            }
            return Promise.resolve(games.filter(({id, title, filePath}) => {
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
    const {gameTitle} = await inquirer.prompt<{gameTitle: string}>([question])

    const {filePath: gamePath, id: gistId} = games.filter(game => game.title === gameTitle)[0]
    const absPath = path.resolve(gamePath)
    const code = readFileSync(absPath, 'utf-8')
    const startTime = Date.now()
    const { data, error, trace, validationMessages } = Parser.parse(code)
    console.log(`Parsing took ${Date.now() - startTime}ms`)

    if (error) {
        console.log(trace.toString())
        console.log(error.message)
        throw new Error(error.message)
    } else {
        function prettyKey(keyCode) {
            return chalk.whiteBright.bgWhite(`[${chalk.black(keyCode)}]`)
        }
        console.log(`-------------------------------------`)
        console.log(`Controls:`)
        console.log(`  ${prettyKey('W')} or ${prettyKey('up')}    : Move Up`)
        console.log(`  ${prettyKey('S')} or ${prettyKey('down')}  : Move Down`)
        console.log(`  ${prettyKey('A')} or ${prettyKey('left')}  : Move Left`)
        console.log(`  ${prettyKey('D')} or ${prettyKey('right')} : Move Right`)
        console.log(`  ${prettyKey('X')} or ${prettyKey('space')} : Perform Action`)
        console.log(`  ${prettyKey('R')}            : Restart the current level`)
        console.log(`  ${prettyKey('esc')}          : Exit the Game`)
        console.log(`-------------------------------------`)

        // Load the solutions file (if it exists) so we can append to it
        const solutionsPath = path.join(__dirname, `../gist-solutions/${gistId}.json`)
        let recordings = []
        if (existsSync(solutionsPath)) {
            recordings = JSON.parse(readFileSync(solutionsPath, 'utf-8'))
        }

        const levels = data.levels
        const firstUncompletedLevel = levels
        .indexOf(levels
            .filter((l, index) => !(recordings[index] && recordings[index].solution))
            .filter(l => l.isMap())[0]
        )

        let {chosenLevel} = await inquirer.prompt<{chosenLevel: number}>([{
            type: 'list',
            name: 'chosenLevel',
            message: 'Which Level would you like to play?',
            default: firstUncompletedLevel, // 1st non-message level
            pageSize: Math.max(15, process.stdout.rows - 15),
            choices: levels.map((levelMap, index) => {
                const hasSolution = recordings[index] && recordings[index].solution
                if (levelMap.isMap()) {
                    const rows = levelMap.getRows()
                    const cols = rows[0]
                    let width = cols.length
                    let height = rows.length
                    // If flickscreen or zoomscreen is enabled, then change the level size
                    // that is reported
                    const {zoomscreen, flickscreen} = data.metadata
                    if (flickscreen) {
                        height = flickscreen.height
                        width = flickscreen.width
                    }
                    if (zoomscreen) {
                        height = zoomscreen.height
                        width = zoomscreen.width
                    }
                    const isTooWide = process.stdout.columns < width * 5 * 2
                    const isTooTall = process.stdout.rows < height * 5
                    let message = ''
                    if (isTooWide && isTooTall) {
                        message = `(too tall & wide for your terminal)`
                    } else if (isTooWide) {
                        message = `(too wide for your terminal)`
                    } else if (isTooTall) {
                        message = `(too tall for your terminal)`
                    }
                    if (hasSolution) {
                        return {
                            name: `${chalk.green(`${index}`)} ${chalk.dim(`(${width} x ${height}) ${chalk.green('(SOLVED)')}`)} ${chalk.yellowBright(message)}`,
                            value: index,
                        }
                    } else {
                        if (message) {
                            return {
                                name: `${chalk.whiteBright(`${index}`)} ${chalk.red(`(${width} x ${height})`)} ${chalk.yellowBright(message)}`,
                                value: index,
                            }
                        } else {
                            return {
                                name: `${chalk.whiteBright(`${index}`)} ${chalk.green(`(${width} x ${height})`)}`,
                                value: index,
                            }
                        }
                    }
                } else {
                    return {
                        name: chalk.dim('... just a message (not playable)'),
                        value: index
                    }
                }

            })
        }])

        // Allow the user to resume from where they left off
        let ticksToRunFirst = ''
        if (recordings[chosenLevel] && recordings[chosenLevel].partial) {
            const {shouldResume} = await inquirer.prompt<{shouldResume: boolean}>({
                type: 'confirm',
                name: 'shouldResume',
                message: 'Would you like to resume where you left off?',
            })
            if (shouldResume) {
                ticksToRunFirst = recordings[chosenLevel].partial
            }
        }

        // Prepare the keyboard handler
        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')


        // Draw the "last" level (after the messages)
        const level = levels[chosenLevel]
        let startTime = Date.now()
        const engine = new Engine(data)
        engine.setLevel(data.levels.indexOf(level))


        function doMove(direction: RULE_DIRECTION_ABSOLUTE) {
            engine.press(direction)
            // const {changedCells} = engine.tick()
            // // Draw any cells that moved
            // for (const cell of changedCells) {
            //     UI.drawCell(cell, false)
            // }
        }

        function restartLevel() {
            engine.pressRestart(chosenLevel)
            UI.renderScreen()
            keypresses = [] // clear key history
        }

        let keypresses = []

        // https://stackoverflow.com/a/30687420
        process.stdin.on('data', function(key){
            handleKeyPress(key)
        })
        function handleKeyPress(key) {
            switch (key) {
                case 'w':
                case '\u001B\u005B\u0041': // UP-ARROW
                    keypresses.push('W')
                    return doMove(RULE_DIRECTION_ABSOLUTE.UP)
                case 's':
                case '\u001B\u005B\u0042': // DOWN-ARROW
                    keypresses.push('S')
                    return doMove(RULE_DIRECTION_ABSOLUTE.DOWN)
                case 'a':
                case '\u001B\u005B\u0044': // LEFT-ARROW
                    keypresses.push('A')
                    return doMove(RULE_DIRECTION_ABSOLUTE.LEFT)
                case 'd':
                case '\u001B\u005B\u0043': // RIGHT-ARROW
                    keypresses.push('D')
                    return doMove(RULE_DIRECTION_ABSOLUTE.RIGHT)
                case 'x':
                case ' ':
                    keypresses.push('X')
                    return doMove(RULE_DIRECTION_ABSOLUTE.ACTION)
                case 'r':
                    return restartLevel()
                case '\u0003': // Ctrl+C
                    closeSounds()
                    return process.exit(1)
                case '\u001B': // Escape
                    saveCoverageFile(data, absPath, 'playgame')
                    // Save the partially-completed steps
                    recordings[chosenLevel] = recordings[chosenLevel] || {}
                    recordings[chosenLevel].partial = keypresses.join('')
                    writeFileSync(solutionsPath, JSON.stringify(recordings, null, 2))
                    closeSounds()
                    return process.exit(0)
                default:
                    UI.writeDebug(`pressed....: "${toUnicode(key)}"`)
            }
        }

        // engine.on('cell:updated', cell => {
        //   UI.drawCellAt(data, cell, cell.rowIndex, cell.colIndex, false)
        // })

        UI.setGame(engine)
        UI.clearScreen()
        UI.renderScreen()
        UI.writeDebug(`Game: "${data.title}"`)

        let currentlyPlayingSoundPromise = null // stack the sounds so we know if one is playing

        // Run a bunch of ticks in case the user partially played a level
        let maxTickAndRenderTime = -1
        for (var keyNum = 0; keyNum < ticksToRunFirst.length; keyNum++) {
            switch (ticksToRunFirst[keyNum]) {
                case 'W':
                    engine.press(RULE_DIRECTION_ABSOLUTE.UP)
                    break
                case 'S':
                    engine.press(RULE_DIRECTION_ABSOLUTE.DOWN)
                    break
                case 'A':
                    engine.press(RULE_DIRECTION_ABSOLUTE.LEFT)
                    break
                case 'D':
                    engine.press(RULE_DIRECTION_ABSOLUTE.RIGHT)
                    break
                case 'X':
                    engine.press(RULE_DIRECTION_ABSOLUTE.ACTION)
                    break
                case '.':
                case ',':
                    // just .tick()
                    break
                default:
                    throw new Error(`BUG: Invalid keypress character "${ticksToRunFirst[keyNum]}"`)
            }
            startTime = Date.now()
            const { changedCells, soundToPlay } = engine.tick()

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
            if (keyNum > 1) { // Skip the 1st couple because they might be cleaning up the level
                maxTickAndRenderTime = Math.max(maxTickAndRenderTime, Date.now() - startTime)
            }

            const msg = `Key ${keyNum} of "${data.title}" (took ${Date.now() - startTime}ms) Changed: ${[...changedCells].map(cell => cell.rowIndex + ':' + cell.colIndex).join(', ') + '   '}`
            UI.writeDebug(msg.substring(0, 160))

            await sleep(1) // sleep long enough to play sounds
            // await sleep(Math.max(100 - (Date.now() - startTime), 0))
        }

        let tickNum = 0
        while(true) {

            const startTime = Date.now()
            const hasAgain = engine.hasAgain()
            const {changedCells, isWinning, soundToPlay} = engine.tick()

            if (soundToPlay) {
                if (!currentlyPlayingSoundPromise) {
                    currentlyPlayingSoundPromise = soundToPlay.play().then(() => currentlyPlayingSoundPromise = null)
                }
            }

            if (isWinning) {
                // Save the solution
                const newSolution = keypresses.join('')
                if (!recordings[chosenLevel]) {
                    recordings[chosenLevel] = { solution: keypresses.join('')}
                    writeFileSync(solutionsPath, JSON.stringify(recordings, null, 2))
                } else if (!recordings[chosenLevel].solution || recordings[chosenLevel].solution.length > newSolution.length) {
                    recordings[chosenLevel].solution = keypresses.join('')
                    writeFileSync(solutionsPath, JSON.stringify(recordings, null, 2))
                }
                keypresses = []
                chosenLevel++
                // Skip the messages since they are not implmented yet
                while(!data.levels[chosenLevel].isMap()) {
                    chosenLevel++
                }

                engine.pressRestart(chosenLevel)
                UI.renderScreen()

                continue
            }

            // Draw any cells that moved
            for (const cell of changedCells) {
                UI.drawCell(cell, false)
            }

            const msg = `Level: ${chosenLevel} Tick: ${tickNum} took ${Date.now() - startTime}ms. Moves: ${[...keypresses].reverse().join('').substring(0, 20)}`
            UI.writeDebug(msg.substring(0, 160))

            await sleep(Math.max(500 - (Date.now() - startTime), 0))
            if (hasAgain) {
                keypresses.push(',')
            } else {
                if (changedCells.size > 0) {
                    keypresses.push('.') // Add a "tick"
                }
            }
            tickNum++
        }

        // UI.clearScreen()
    }

}

run()
