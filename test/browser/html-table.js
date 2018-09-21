/* eslint-env browser */
const { PuzzleScript } = window

const table = document.querySelector('#thegamecanbeidentifiedbyselector')
const tableEngine = new PuzzleScript.TableEngine(table)

window.HackTableStart = (source, initialLevel) => {
    // setTimeout(() => {throw new Error(`Checking if sourcemaps work in the browser in a separate tick`)}, 1)
    // throw new Error(`Checking if sourcemaps work in the browser while evaluating`)
    tableEngine.setGame(source, initialLevel)
    tableEngine.start()
}
window.HackTableStop = () => {
    tableEngine.stop()
}
