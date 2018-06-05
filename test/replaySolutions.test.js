/* eslint-env jasmine */
const fs = require('fs')
const path = require('path')
const pify = require('pify')
const glob = require('glob')
const { default: Engine } = require('../src/engine')
const { default: Parser } = require('../src/parser/parser')
const { default: UI } = require('../src/ui')

const SOLUTION_ROOT = path.join(__dirname, '../gist-solutions/')
const solutionFiles = fs.readdirSync(SOLUTION_ROOT)

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function parseEngine(code, levelNum = 0) {
    const { data, error } = Parser.parse(code)
    expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

    const engine = new Engine(data)
    return { engine, data }
}

const SHOW_STEPS = false
describe('replays levels of games', () => {

    solutionFiles.forEach(solutionFilename => {
        const GIST_ID = path.basename(solutionFilename).replace('.json', '')

        it(`plays all the solved levels of ${GIST_ID}`, async () => {
            const { engine, data } = parseEngine(fs.readFileSync(path.join(__dirname, `../gists/${GIST_ID}/script.txt`), 'utf-8'))
            const solutions = JSON.parse(fs.readFileSync(path.join(SOLUTION_ROOT, solutionFilename), 'utf-8'))

            for (let index = 0; index < solutions.length; index++) {
                const solution = solutions[index]
                if (!solution) {
                    continue // skip message-only levels
                }
                engine.setLevel(index)

                if (SHOW_STEPS) {
                    UI.setGame(data)
                }

                const DID_NOT_WIN = 'DID_NOT_WIN'
                let wonAtKeyIndex = DID_NOT_WIN
                const keypresses = solution.split('')

                // Do one tick in the beginning to make sure the sprites are all loaded up
                engine.tick()
                for (let i = 0; i < keypresses.length; i++) {
                    const key = keypresses[i]
                    switch(key) {
                        case 'u': engine.pressUp(); break
                        case 'd': engine.pressDown(); break
                        case 'l': engine.pressLeft(); break
                        case 'r': engine.pressRight(); break
                        case 'x': engine.pressAction(); break
                        case 'W': engine.pressUp(); break
                        case 'S': engine.pressDown(); break
                        case 'A': engine.pressLeft(); break
                        case 'D': engine.pressRight(); break
                        case 'X': engine.pressAction(); break
                        case '.':
                        case ',':
                            break
                        default:
                            throw new Error(`ERROR: Unsupported character "${key}"`)
                    }

                    let didWin = false
                    // do { // loop until we are done with animations
                        const {isWinning} = engine.tick()
                        didWin = didWin || isWinning
                    // } while(engine.hasAgain())

                    if (SHOW_STEPS) {
                        UI.renderScreen(engine.currentLevel)
                    }

                    if (didWin) {
                        wonAtKeyIndex = i
                        break
                    }
                }

                if (wonAtKeyIndex === DID_NOT_WIN || (wonAtKeyIndex !== keypresses.length - 1)) {
                    console.error('Screendump of level')
                    UI.setGame(data)
                    UI.renderScreen(engine.currentLevel)
                }

                expect({title: data.title, levelNumber: index, wonAtKeyIndex}).toEqual({title: data.title, levelNumber: index, wonAtKeyIndex: keypresses.length - 1})

            }
        })
    })

})
