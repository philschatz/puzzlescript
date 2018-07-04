/* eslint-env jasmine */
const fs = require('fs')
const path = require('path')
const { GameEngine } = require('../../lib/engine')
const { default: Parser } = require('../../lib/parser/parser')
const { RULE_DIRECTION } = require('../../lib/util')
const { saveCoverageFile } = require('../../lib/recordCoverage')

const SOLUTION_ROOT = path.join(__dirname, '../../gist-solutions/')
const solutionFiles = fs.readdirSync(SOLUTION_ROOT)

function parseEngine(code, levelNum = 0) {
    const { data, error } = Parser.parse(code)
    expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

    const engine = new GameEngine(data)
    return { engine, data }
}

const SHOW_STEPS = false

function createTests(moduloNumber, moduloTotal) {
    describe('replays levels of games', () => {

        solutionFiles.forEach((solutionFilename, solutionIndex) => {
            // Skip the README.md file
            if (!solutionFilename.endsWith('.json')) {
                return
            }
            // Only run 1/4 of all the games. This is so JEST can run them concurrently
            if (solutionIndex % moduloTotal !== moduloNumber) {
                return
            }
            const GIST_ID = path.basename(solutionFilename).replace('.json', '')

            it(`plays the solved levels of ${GIST_ID}`, async () => {
                const gistFilename = path.join(__dirname, `../../gists/${GIST_ID}/script.txt`)
                const { engine, data } = parseEngine(fs.readFileSync(gistFilename, 'utf-8'))
                const recordings = JSON.parse(fs.readFileSync(path.join(SOLUTION_ROOT, solutionFilename), 'utf-8')).solutions
                for (let index = 0; index < recordings.length; index++) {
                    const recording = recordings[index]
                    if (!recording || !recording.solution) {
                        continue // skip message-only levels or levels that do not have a solution
                    }


                    engine.setLevel(index)

                    // UI.setGame(engine)

                    const DID_NOT_WIN = 'DID_NOT_WIN'
                    let wonAtKeyIndex = DID_NOT_WIN
                    const keypresses = recording.solution.split('')

                    // Do one tick in the beginning to make sure the sprites are all loaded up
                    engine.tick()
                    for (let i = 0; i < keypresses.length; i++) {
                        const key = keypresses[i]
                        switch(key) {
                            case 'W': engine.press(RULE_DIRECTION.UP); break
                            case 'S': engine.press(RULE_DIRECTION.DOWN); break
                            case 'A': engine.press(RULE_DIRECTION.LEFT); break
                            case 'D': engine.press(RULE_DIRECTION.RIGHT); break
                            case 'X': engine.press(RULE_DIRECTION.ACTION); break
                            case '.':
                            case ',':
                                break
                            default:
                                throw new Error(`ERROR: Unsupported character "${key}"`)
                        }

                        let didWin = false
                        // do { // loop until we are done with animations
                            const {didLevelChange, didWinGame} = engine.tick()
                            didWin = didWin || didWinGame || didLevelChange
                        // } while(engine.hasAgain())

                        // if (SHOW_STEPS) {
                        //     UI.renderScreen(false)
                        // }

                        if (didWin) {
                            wonAtKeyIndex = i
                            break
                        }
                    }

                    if (wonAtKeyIndex === DID_NOT_WIN || (wonAtKeyIndex !== keypresses.length - 1)) {
                        console.error('Screendump of level')
                        // UI.setGame(engine)
                        // UI.dumpScreen()
                    }

                    expect({title: data.title, levelNumber: index, wonAtKeyIndex}).toEqual({title: data.title, levelNumber: index, wonAtKeyIndex: keypresses.length - 1})
                }
                saveCoverageFile(data, gistFilename, `${GIST_ID}-playgame`)
            })
        })

    })

}


module.exports = { createTests }