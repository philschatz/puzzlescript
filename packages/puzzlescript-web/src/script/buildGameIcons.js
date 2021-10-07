// This generates SVG icons for each game
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs')
const glob = require('glob')
const { basename, join } = require('path')
const svgToPng = require('svg-to-png') // tslint:disable-line:no-implicit-dependencies
const { GameEngine, LEVEL_TYPE, Parser } = require('puzzlescript')
const { ALL_GAMES } = require('../pwa/allGames')
const { SvgIconUi } = require('./svgIcon')
const pify = require('pify') // tslint:disable-line:no-var-requires

function buildIcon(sourcePath) {

    const code = readFileSync(sourcePath, 'utf-8')

    const ui = new SvgIconUi()
    const { data } = Parser.parse(code)
    const engine = new GameEngine(data, ui)
    ui.onGameChange(data) // trigger the UI to know that the gameData is available. TODO: GameEngine should do that

    // Determine the size of the levels
    const levelStats = data.levels.map((l) => l.type === LEVEL_TYPE.MAP ? { rows: l.cells.length, cols: l.cells[0].length } : null)
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

    const { svg, popularColors } = ui.getSvg()
    return {
        title: data.title,
        author: data.metadata.author,
        homepage: data.metadata.homepage,
        backgroundColor: data.metadata.backgroundColor ? data.metadata.backgroundColor.toHex() : null,
        popularColors,
        levels: levelStats,
        svg
    }
}

const GAMES_ROOT_PATH = join(__dirname, '../../../puzzlescript/games')
const SOLUTIONS_GLOB = join(__dirname, '../../../puzzlescript/game-solutions/*.json') // relative to the lib/script/ directory
const BROWSE_GAMES_DIR = join(__dirname, '../../static/game-thumbnails') // relative to the lib/script/ directory
const allGamesPath = join(__dirname, '../../src/pwa/allGames.ts') // relative to the lib/script/ directory

run().then(null, (err) => console.error(err)) // tslint:disable-line:no-console

async function run() {
    const gists = await pify(glob)(SOLUTIONS_GLOB)

    const svgFilesToConvert = []

    let i = 0
    for (const f of gists) {
        if (!existsSync(BROWSE_GAMES_DIR)) {
            mkdirSync(BROWSE_GAMES_DIR)
        }
        const gameId = basename(f).replace('.json', '')
        const sourcePath = join(GAMES_ROOT_PATH, `${gameId}/script.txt`) // relative to lib/cli/
        const destPath = join(BROWSE_GAMES_DIR, `${gameId}.svg`)
        const pngPath = join(BROWSE_GAMES_DIR, `${gameId}.png`)

        if (!existsSync(pngPath)) {
            svgFilesToConvert.push(destPath)
        }

        if (!existsSync(destPath) || !ALL_GAMES.get(gameId)) {
            try {
                console.log(`${i}/${gists.length} ${gameId}`) // tslint:disable-line:no-console
                const { svg, title, author, homepage, backgroundColor, popularColors, levels } = buildIcon(sourcePath)

                ALL_GAMES.set(gameId, { id: gameId, title, author, homepage, backgroundColor, popularColors, levels })

                writeFileSync(destPath, svg)

            } catch (err) {
                // problem loading the game
                svgFilesToConvert.pop() // do not generate a PNG file of it.
                console.error(`Problem building an SVG image for ${gameId}. ${err.message}`) // tslint:disable-line:no-console
            }
        }

        i++
    }

    const allGamesSource = [
        `// This file is autogenerated. Do not edit it directly. See buildGameIcons.ts
// tslint:disable:max-line-length
import { Optional } from 'puzzlescript'

export interface GameInfo {
    id: string
    title: string
    author: Optional<string>
    homepage: Optional<string>
    backgroundColor: Optional<string>
    popularColors: string[]
    levels: Array<Optional<{rows: number, cols: number}>>
}

export const ALL_GAMES: Map<string, GameInfo> = new Map()
`
    ]
    for (const [key, value] of ALL_GAMES.entries()) {
        allGamesSource.push(`ALL_GAMES.set(${JSON.stringify(key)}, ${JSON.stringify(value)})`)
    }
    writeFileSync(allGamesPath, allGamesSource.join('\n'))

    // Convert SVG images to PNG images
    console.log(`Generating ${svgFilesToConvert.length} PNG files... to ${BROWSE_GAMES_DIR}`) // tslint:disable-line:no-console
    if (svgFilesToConvert.length > 0) {
        svgToPng.convert(svgFilesToConvert, BROWSE_GAMES_DIR, {
            defaultWidth: 100,
            defaultHeight: 100
        })
    }
}
