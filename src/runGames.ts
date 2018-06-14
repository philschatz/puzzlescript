import { readFileSync, writeFileSync, existsSync } from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pify from 'pify'

import Parser from './parser/parser'
import { IGameNode } from './models/game'
import UI from './ui'
import { GameEngine } from './engine'
import { setAddAll, RULE_DIRECTION_ABSOLUTE } from './util';
import { start } from 'repl';
import { IRule } from './models/rule';
import { RULE_DIRECTION } from './enums';
import { saveCoverageFile } from './recordCoverage';
import {playSound} from './sounds';
import { closeSounds } from './models/sound';

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
    UI.setSmallTerminal(true)

    const files = await pify(glob)('./gists/*/script.txt')
    console.log(`Looping over ${files.length} games...`)
    console.log(`Screen size is ${process.stdout.columns} wide and ${process.stdout.rows} high`)

    for (let filename of files) {
        console.log(`Parsing and rendering ${filename}`)
        const gistId = path.basename(path.dirname(filename))

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

            // Draw the "first" level (after the messages)
            let level = data.levels.filter(level => level.isMap())[0]
            // have some default keypresses but load the most-recent partial if available
            let keypressesStr = [
                'WSSW',
                'ADDDA',
                'X',
                'SWWS',
                'DAAD'
            ].join('').split('').join('.')
            const recordingsPath = path.join(__dirname, `../gist-solutions/${gistId}.json`)
            if (existsSync(recordingsPath)) {
                const recordings = JSON.parse(readFileSync(recordingsPath, 'utf-8'))
                const x = recordings.filter(r => !!r)
                const recording = x[x.length - 1]
                if (recording) {
                    keypressesStr = recording.partial || recording.solution
                    level = data.levels[recordings.indexOf(recording)]
                }
            }

            if (level) {

                let startTime = Date.now()
                const engine = new GameEngine()
                const levelNum = data.levels.indexOf(level)
                engine.setGame(data)
                engine.setLevel(levelNum)
                if (process.env['LOG_LEVEL'] === 'debug') {
                    console.error('')
                    console.error('')
                    console.error(`Start playing "${data.title}". Level ${levelNum}`)
                }
                console.log(`Loading Cells into the level took ${Date.now() - startTime}ms`)

                // engine.on('cell:updated', cell => {
                //   UI.drawCellAt(cell, cell.rowIndex, cell.colIndex, false)
                // })

                UI.setGame(engine)
                UI.clearScreen()
                UI.renderScreen(true)
                UI.writeDebug(`Game: "${data.title}"`)


                startTime = Date.now()

                let maxTickAndRenderTime = -1
                for (var i = 0; i < keypressesStr.length; i++) {
                    switch (keypressesStr[i]) {
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
                            throw new Error(`BUG: Invalid keypress character "${keypressesStr[i]}"`)
                    }
                    startTime = Date.now()
                    const { changedCells, soundToPlay } = engine.tick()

                    // UI.renderScreen(data, engine.currentLevel)

                    // Draw any cells that moved
                    for (const cell of changedCells) {
                        UI.drawCell(cell, false)
                    }
                    if (i > 1) { // Skip the 1st couple because they might be cleaning up the level
                        maxTickAndRenderTime = Math.max(maxTickAndRenderTime, Date.now() - startTime)
                    }

                    const msg = `Tick ${i} of "${data.title}" (took ${Date.now() - startTime}ms)`
                    UI.writeDebug(msg.substring(0, 160))

                    // if (soundToPlay) {
                    //     await soundToPlay.play()
                    // }

                    await sleep(10)

                    // if (changedCells.size === 0) {
                    //     break
                    // }

                }
                console.log('Max tickAndRender Time (ms):', maxTickAndRenderTime);


                const absPath = path.resolve(filename)
                const gistName = path.basename(path.dirname(filename))
                saveCoverageFile(data, absPath, `gists-${gistName}`)
            }

            // UI.clearScreen()
        }
    }

    closeSounds()
}

run()
