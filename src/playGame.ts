import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pify from 'pify'
import * as keypress from 'keypress'
import * as inquirer from 'inquirer'
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
            title: (await firstline(filePath)).replace('title ', ''),
            filePath: filePath
        })
    }

    const chosenGame = await inquirer.prompt<{gamePath: string}>([{
        type: 'list',
        name: 'gamePath',
        message: 'Which game would you like to play?',
        pageSize: Math.max(15, process.stdout.rows - 15),
        choices: games.map(({id, title, filePath}) => {
            return {
                name: `${title} ${chalk.dim(`(${id})`)}`,
                value: filePath,
                short: id,
            }
        })
    }])

    const {gamePath} = chosenGame
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

        const levels = data.levels
        const {chosenLevel} = await inquirer.prompt<{chosenLevel: string}>([{
            type: 'list',
            name: 'chosenLevel',
            message: 'Which Level would you like to play?',
            default: levels.indexOf(levels.filter(l => l.isMap())[0]), // 1st non-message level
            pageSize: Math.max(15, process.stdout.rows - 15),
            choices: levels.map((levelMap, index) => {
                if (levelMap.isMap()) {
                    const rows = levelMap.getRows()
                    const cols = rows[0]
                    const isTooWide = process.stdout.columns < cols.length * 5 * 2
                    const isTooTall = process.stdout.rows < rows.length * 5
                    let message = ''
                    if (isTooWide && isTooTall) {
                        message = `(too tall & wide for your terminal)`
                    } else if (isTooWide) {
                        message = `(too wide for your terminal)`
                    } else if (isTooTall) {
                        message = `(too tall for your terminal)`
                    }
                    if (message) {
                        return {
                            name: `${chalk.whiteBright(`${index}`)} ${chalk.red(`(${cols.length} x ${rows.length})`)} ${chalk.yellowBright(message)}`,
                            value: index,
                        }
                    } else {
                        return {
                            name: `${chalk.whiteBright(`${index}`)} ${chalk.green(`(${cols.length} x ${rows.length})`)}`,
                            value: index,
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
            const changedCells = engine.tick()
            // Draw any cells that moved
            for (const cell of changedCells) {
                UI.drawCell(cell, false)
            }
        }

        function restartLevel() {
            engine.pressRestart(chosenLevel)
            UI.renderScreen(engine.currentLevel)
        }

        // https://stackoverflow.com/a/30687420
        process.stdin.on('data', function(key){
            switch (key) {
                case 'w':
                case '\u001B\u005B\u0041': // UP-ARROW
                    return doMove(RULE_DIRECTION_ABSOLUTE.UP)
                case 's':
                case '\u001B\u005B\u0042': // DOWN-ARROW
                    return doMove(RULE_DIRECTION_ABSOLUTE.DOWN)
                case 'a':
                case '\u001B\u005B\u0044': // LEFT-ARROW
                    return doMove(RULE_DIRECTION_ABSOLUTE.LEFT)
                case 'd':
                case '\u001B\u005B\u0043': // RIGHT-ARROW
                    return doMove(RULE_DIRECTION_ABSOLUTE.RIGHT)
                case 'x':
                case ' ':
                    return doMove(RULE_DIRECTION_ABSOLUTE.ACTION)
                case 'r':
                    return restartLevel()
                case '\u0003': // Ctrl+C
                    return process.exit(1)
                case '\u001B':
                    saveCoverageFile(data, absPath, 'playgame')
                    return process.exit(0)
                default:
                    UI.writeDebug(`pressed....: "${toUnicode(key)}"`)
            }
        })

        // engine.on('cell:updated', cell => {
        //   UI.drawCellAt(data, cell, cell.rowIndex, cell.colIndex, false)
        // })

        UI.setGame(data)
        UI.renderScreen(engine.currentLevel)
        UI.writeDebug(`Game: "${data.title}"`)

        let i = 0
        while(true) {

            const startTime = Date.now()
            const changedCells = engine.tick()

            // Draw any cells that moved
            for (const cell of changedCells) {
                UI.drawCell(cell, false)
            }

            const msg = `Tick ${i} took ${Date.now() - startTime}ms. Changed: ${[...changedCells].map(cell => cell.rowIndex + ':' + cell.colIndex).join(', ') + '   '}`
            UI.writeDebug(msg.substring(0, 160))

            await sleep(Math.max(100 - (Date.now() - startTime), 0))
            i++
        }

        // UI.clearScreen()
    }
}

run()
