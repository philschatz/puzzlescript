import { readFileSync } from 'fs'
import { GameEngine } from '../engine'
import { LEVEL_TYPE } from '../parser/astTypes'
import Parser from '../parser/parser'
import { SvgIconUi } from '../ui/svgIcon'

export function buildIcon(sourcePath: string) {

    const code = readFileSync(sourcePath, 'utf-8')

    const ui = new SvgIconUi()
    const { data } = Parser.parse(code)
    const engine = new GameEngine(data, ui)
    ui.onGameChange(data) // trigger the UI to know that the gameData is available. TODO: GameEngine should do that

    // Find the middle level to use for the screenshot
    const maps = data.levels.filter((l) => l.type === LEVEL_TYPE.MAP)
    const middle = Math.floor(maps.length / 2)
    const level = maps[middle]

    if (!level) {
        throw new Error('BUG: Could not find a non-message level')
    }

    engine.setLevel(data.levels.indexOf(level), null)
    ui.onLevelChange(engine.getCurrentLevelNum(), engine.getCurrentLevelCells(), null)
    ui.renderScreen(false, 0) // forgot to run this

    const {svg, popularColors} = ui.getSvg()
    return {
        title: data.title,
        author: data.metadata.author,
        homepage: data.metadata.homepage,
        backgroundColor: data.metadata.backgroundColor ? data.metadata.backgroundColor.toHex() : null,
        popularColors,
        svg
    }
}
