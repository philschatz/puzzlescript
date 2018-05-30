import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pify from 'pify'
import * as keypress from 'keypress'

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

var stdin = process.stdin;
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');

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
    const gameFile = './gists/__simple-test/script.txt'
    const absPath = path.resolve(gameFile)
    const code = readFileSync(absPath, 'utf-8')
    const startTime = Date.now()
    const { data, error, trace, validationMessages } = Parser.parse(code)
    console.log(`Parsing took ${Date.now() - startTime}ms`)

    if (error) {
        console.log(trace.toString())
        console.log(error.message)
        throw new Error(error.message)
    } else {
        // Draw the "last" level (after the messages)
        const level = data.levels.filter(level => level.isMap())[0]
        if (level) {
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

            // https://stackoverflow.com/a/30687420
            stdin.on('data', function(key){
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

            for (var i = 0; i < 10000; i++) {

                const startTime = Date.now()
                const changedCells = engine.tick()

                // Draw any cells that moved
                for (const cell of changedCells) {
                    UI.drawCell(cell, false)
                }

                const msg = `Tick ${i} took ${Date.now() - startTime}ms. Changed: ${[...changedCells].map(cell => cell.rowIndex + ':' + cell.colIndex).join(', ') + '   '}`
                UI.writeDebug(msg.substring(0, 160))

                await sleep(Math.max(100 - (Date.now() - startTime), 0))

                if (changedCells.size === 0) {
                    break
                }

            }
        }

        // UI.clearScreen()
    }
}

run()
