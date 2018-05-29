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

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// keypress(process.stdin)
// keypress.enableMouse(process.stdout)

var stdin = process.stdin;
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');

// stdin.on('data', function(key){

//     // console.log(toUnicode(key))

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
//     if (key == '\u001B\u005B\u0041') {
//         process.stdout.write('up');
//     }
//     if (key == '\u001B\u005B\u0043') {
//         process.stdout.write('right');
//     }
//     if (key == '\u001B\u005B\u0042') {
//         process.stdout.write('down');
//     }
//     if (key == '\u001B\u005B\u0044') {
//         process.stdout.write('left');
//     }

//     if (key == '\u0003') { process.exit(); }    // ctrl-c
// });

async function run() {
    const code = readFileSync('./gists/__simple-test/script.txt', 'utf-8')
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
                    UI.drawCell(data, cell, false)
                }
            }

            // https://stackoverflow.com/a/30687420
            stdin.on('data', function(key){
                UI.writeDebug(`pressed....: "${toUnicode(key)}"`)
                if (key === 'w' || key === '\u001B\u005B\u0041') {
                    doMove(RULE_DIRECTION_ABSOLUTE.UP)
                }
                if (key === 's' || key === '\u001B\u005B\u0042') {
                    doMove(RULE_DIRECTION_ABSOLUTE.DOWN)
                }
                if (key === 'a' || key === '\u001B\u005B\u0044') {
                    doMove(RULE_DIRECTION_ABSOLUTE.LEFT)
                }
                if (key === 'd' || key === '\u001B\u005B\u0043') {
                    doMove(RULE_DIRECTION_ABSOLUTE.RIGHT)
                }
                if (key === ' ') {
                    doMove(RULE_DIRECTION_ABSOLUTE.ACTION)
                }
                if (key === '\u0003') { process.exit(); }    // ctrl-c
            });

            // engine.on('cell:updated', cell => {
            //   UI.drawCellAt(data, cell, cell.rowIndex, cell.colIndex, false)
            // })

            UI.renderScreen(data, engine.currentLevel)
            UI.writeDebug(`Game: "${data.title}"`)

            for (var i = 0; i < 10000; i++) {
                await sleep(100)
                const changedCells = engine.tick()

                // UI.renderScreen(data, engine.currentLevel)

                // Draw any cells that moved
                for (const cell of changedCells) {
                    UI.drawCell(data, cell, false)
                }

                // const msg = `Tick ${i} of "${data.title}" (took ${Date.now() - startTime}ms) Changed: ${[...changedCells].map(cell => cell.rowIndex + ':' + cell.colIndex).join(', ') + '   '}`
                // UI.writeDebug(msg.substring(0, 160))

                await sleep(Math.max(500 - (Date.now() - startTime), 0))

                if (changedCells.size === 0) {
                    break
                }

            }
        }

        // UI.clearScreen()
    }
}

run()
