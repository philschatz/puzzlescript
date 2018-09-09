// tslint:disable:no-console
import { existsSync, readFileSync } from 'fs'
import * as glob from 'glob'
import * as path from 'path'
import * as pify from 'pify'

import { GameEngine, Parser, RULE_DIRECTION } from '.'
import { ILevelRecording } from './playGame'
import { saveCoverageFile } from './recordCoverage'
import { closeSounds } from './sounds'
import TerminalUI from './ui/terminal'

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
    TerminalUI.setSmallTerminal(true)

    const files = await pify(glob)('./gists/*/script.txt')
    console.log(`Looping over ${files.length} games...`)
    console.log(`Screen size is ${process.stdout.columns} wide and ${process.stdout.rows} high`)

    for (const filename of files) {
        console.log(`Parsing and rendering ${filename}`)
        const gistId = path.basename(path.dirname(filename))

        const code = readFileSync(filename, 'utf-8')
        let startTime = Date.now()
        const { data, error, trace, validationMessages } = Parser.parse(code)
        console.log(`Parsing took ${Date.now() - startTime}ms`)

        if (error && trace) {
            console.log(trace.toString())
            console.log(error.message)
            throw new Error(filename)
        } else {
            if (!data) {
                throw new Error(`BUG: gameData was not set yet`)
            }
                // console.log(data.title)
            // return

            if (validationMessages) {
                validationMessages.forEach(({ gameNode, level, message }) => {
                    const { lineNum, colNum } = gameNode.__getSourceLineAndColumn()
                    console.warn(`(${lineNum}:${colNum}) ${level} : ${message}`)
                })
            }

            // Draw the "first" level (after the messages)
            let currentLevel = data.levels.filter((level) => level.isMap())[0]
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
                const recordings: ILevelRecording[] = JSON.parse(readFileSync(recordingsPath, 'utf-8')).solutions
                // TODO: Use the following rules for finding which recording to play:
                // - find the last partially (or) completed Map
                // - pick the first Map
                if (recordings) {
                    recordings.forEach((recording, index) => {
                        if (recording && data.levels[index].isMap()) {
                            keypressesStr = recording.partial || recording.solution || ''
                            // Trim the keypresses down so the game does not take too long to run
                            keypressesStr = keypressesStr.substring(0, 500)
                            currentLevel = data.levels[index]
                        }
                    })
                } else {
                    currentLevel = data.levels.filter((l) => l.isMap())[0]
                }
            }

            if (currentLevel) {

                startTime = Date.now()
                const engine = new GameEngine(data)
                const levelNum = data.levels.indexOf(currentLevel)
                engine.setLevel(levelNum)
                if (process.env.LOG_LEVEL === 'debug') {
                    console.error('')
                    console.error('')
                    console.error(`Start playing "${data.title}". Level ${levelNum}`)
                }
                console.log(`Loading Cells into the level took ${Date.now() - startTime}ms`)

                // engine.on('cell:updated', cell => {
                //   UI.drawCellAt(cell, cell.rowIndex, cell.colIndex, false)
                // })

                TerminalUI.setGameEngine(engine)
                TerminalUI.clearScreen()
                TerminalUI.renderScreen(true)
                TerminalUI.writeDebug(`"${data.title}"`, 0)

                startTime = Date.now()

                let maxTickAndRenderTime = -1
                for (let i = 0; i < keypressesStr.length; i++) {
                    switch (keypressesStr[i]) {
                        case 'W':
                            engine.press(RULE_DIRECTION.UP)
                            break
                        case 'S':
                            engine.press(RULE_DIRECTION.DOWN)
                            break
                        case 'A':
                            engine.press(RULE_DIRECTION.LEFT)
                            break
                        case 'D':
                            engine.press(RULE_DIRECTION.RIGHT)
                            break
                        case 'X':
                            engine.press(RULE_DIRECTION.ACTION)
                            break
                        case '.':
                        case ',':
                            // just .tick()
                            break
                        default:
                            throw new Error(`BUG: Invalid keypress character "${keypressesStr[i]}"`)
                    }
                    startTime = Date.now()
                    const { changedCells } = engine.tick()

                    // UI.renderScreen(data, engine.currentLevel)

                    // Draw any cells that moved
                    TerminalUI.drawCells(changedCells, false)
                    if (i > 1) { // Skip the 1st couple because they might be cleaning up the level
                        maxTickAndRenderTime = Math.max(maxTickAndRenderTime, Date.now() - startTime)
                    }

                    const msg = `Tick ${i} of "${data.title}" (took ${Date.now() - startTime}ms)`
                    TerminalUI.writeDebug(msg.substring(0, 160), 0)

                    // if (soundToPlay) {
                    //     await soundToPlay.play()
                    // }

                    await sleep(1)

                    // if (changedCells.size === 0) {
                    //     break
                    // }

                }
                console.log('Max tickAndRender Time (ms):', maxTickAndRenderTime)

                const absPath = path.resolve(filename)
                const gistName = path.basename(path.dirname(filename))
                saveCoverageFile(data, absPath, `gists-${gistName}`)
            }

            // UI.clearScreen()
        }
    }

    closeSounds()
}

run().catch((err) => { throw err })
