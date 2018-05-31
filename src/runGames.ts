import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pify from 'pify'

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

async function run() {
    const files = await pify(glob)('./gists/*/script.txt')
    console.log(`Looping over ${files.length} games...`)

    for (let filename of files) {
        console.log(`Parsing and rendering ${filename}`)
        const code = readFileSync(filename, 'utf-8')
        const startTime = Date.now()
        const { data, error, trace, validationMessages } = Parser.parse(code)
        console.log(`Parsing took ${Date.now() - startTime}ms`)

        if (error) {
            console.log(trace.toString())
            console.log(error.message)
            throw new Error(filename)
        } else {
            // console.log(data.title)
            // return

            if (validationMessages) {
                validationMessages.forEach(({ gameNode, level, message }) => {
                    const { lineNum, colNum } = gameNode.__getSourceLineAndColumn()
                    console.warn(`(${lineNum}:${colNum}) ${level} : ${message}`)
                })
            }

            // Draw the "last" level (after the messages)
            const level = data.levels.filter(level => level.isMap())[0]
            if (level) {
                let startTime = Date.now()
                const engine = new Engine(data)
                engine.setLevel(data.levels.indexOf(level))
                console.log(`Loading Cells into the level took ${Date.now() - startTime}ms`)

                // engine.on('cell:updated', cell => {
                //   UI.drawCellAt(cell, cell.rowIndex, cell.colIndex, false)
                // })

                UI.setGame(data)
                UI.renderScreen(engine.currentLevel)
                UI.writeDebug(`Game: "${data.title}"`)


                startTime = Date.now()
                global['max_time_spent_updating'] = 0
                global['cells_updated_count'] = 0
                global['rules_updated_count'] = 0

                const keypresses = [
                    RULE_DIRECTION_ABSOLUTE.UP, RULE_DIRECTION_ABSOLUTE.DOWN, RULE_DIRECTION_ABSOLUTE.DOWN, RULE_DIRECTION_ABSOLUTE.UP,
                    RULE_DIRECTION_ABSOLUTE.LEFT, RULE_DIRECTION_ABSOLUTE.RIGHT, RULE_DIRECTION_ABSOLUTE.RIGHT, RULE_DIRECTION_ABSOLUTE.RIGHT, RULE_DIRECTION_ABSOLUTE.LEFT,
                    RULE_DIRECTION_ABSOLUTE.ACTION,
                    RULE_DIRECTION_ABSOLUTE.DOWN, RULE_DIRECTION_ABSOLUTE.UP, RULE_DIRECTION_ABSOLUTE.UP, RULE_DIRECTION_ABSOLUTE.DOWN,
                    RULE_DIRECTION_ABSOLUTE.RIGHT, RULE_DIRECTION_ABSOLUTE.LEFT, RULE_DIRECTION_ABSOLUTE.LEFT, RULE_DIRECTION_ABSOLUTE.RIGHT,
                    RULE_DIRECTION_ABSOLUTE.ACTION
                ]

                let maxTickAndRenderTime = -1
                for (var i = 0; i < keypresses.length; i++) {
                    engine.press(keypresses[i])
                    startTime = Date.now()
                    const changedCells = engine.tick()

                    // UI.renderScreen(data, engine.currentLevel)

                    // Draw any cells that moved
                    for (const cell of changedCells) {
                        UI.drawCell(cell, false)
                    }
                    if (i > 1) { // Skip the 1st couple because they might be cleaning up the level
                        maxTickAndRenderTime = Math.max(maxTickAndRenderTime, Date.now() - startTime)
                    }

                    const msg = `Tick ${i} of "${data.title}" (took ${Date.now() - startTime}ms) Changed: ${[...changedCells].map(cell => cell.rowIndex + ':' + cell.colIndex).join(', ') + '   '}`
                    UI.writeDebug(msg.substring(0, 160))

                    await sleep(Math.max(200 - (Date.now() - startTime), 0))

                    // if (changedCells.size === 0) {
                    //     break
                    // }

                }
                console.log('Max time spent updating:', global['max_time_spent_updating']);
                console.log('Number of cell update calls:', global['cells_updated_count']);
                console.log('Number of rules updated:', global['rules_updated_count']);
                console.log('Max tickAndRender Time (ms):', maxTickAndRenderTime);


                const absPath = path.resolve(filename)
                const gistName = path.basename(path.dirname(filename))
                saveCoverageFile(data, absPath, `gists-${gistName}`)
            }

            // UI.clearScreen()
        }
    }
}

run()
