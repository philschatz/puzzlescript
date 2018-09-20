/* eslint-env browser */
const { PuzzleScript } = window

const table = document.querySelector('#thegamecanbeidentifiedbyselector')
const tableEngine = new PuzzleScript.TableEngine(table)

window.HackTableStart = (source, initialLevel) => {
    tableEngine.setGame(source, initialLevel)
    tableEngine.start()
}
window.HackTableStop = () => {
    tableEngine.stop()
}
