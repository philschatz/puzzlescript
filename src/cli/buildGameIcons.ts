// This generates SVG icons for each game
import { existsSync, readFileSync, writeFileSync } from 'fs'
import * as glob from 'glob'
import { basename, join } from 'path'
import pify from 'pify'
import * as svgToPng from 'svg-to-png' // tslint:disable-line:no-implicit-dependencies
import { GameEngine } from '../engine'
import { LEVEL_TYPE } from '../parser/astTypes'
import Parser from '../parser/parser'
import { SvgIconUi } from '../ui/svgIcon'

function buildIcon(sourcePath: string) {

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

    const { svg, popularColors } = ui.getSvg()
    return {
        title: data.title,
        author: data.metadata.author,
        homepage: data.metadata.homepage,
        backgroundColor: data.metadata.backgroundColor ? data.metadata.backgroundColor.toHex() : null,
        popularColors,
        svg
    }
}

const SOLUTIONS_GLOB = join(__dirname, '../game-solutions/*.json')

run().then(null, (err) => console.error(err)) // tslint:disable-line:no-console

async function run() {
    const gists = await pify(glob)(SOLUTIONS_GLOB)

    const jsonMetadataPath = join(__dirname, '../browse-games/_metadata.json')

    const metadata = existsSync(jsonMetadataPath) ? JSON.parse(readFileSync(jsonMetadataPath, 'utf-8')) : {}
    const svgFilesToConvert = []
    const html = [`<html><head><style>
    body { font-family: sans-serif; }
    figure {
        width: 150px;
        display: inline-block;

        /* look like a button */
        cursor: pointer;
        padding: 0.5rem;
        border: 1px solid #666;
        border-radius: 6px;
        box-shadow: 0 3px 7px rgba(0, 0, 0, 0.3);

    }
    figcaption .game-title,
    figcaption .game-author {
        width: 150px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    figcaption .game-title { color: black; text-align: center; font-weight: bold; }
    figcaption .game-author { font-size: 80%; color: #ccc; }
    .thumbnail-wrapper {
        width: 150px;
        height: 150px;
        display: flex;
    }

    img {
        max-width: 100px;
        margin: auto;
        max-height: 100px;
    }
    </style></head><body>`]

    let i = 0
    for (const f of gists) {
        const gameId = basename(f).replace('.json', '')
        const sourcePath = join(__dirname, `../games/${gameId}/script.txt`)
        const destPath = join(__dirname, `../browse-games/${gameId}.svg`)
        const pngPath = join(__dirname, `../browse-games/${gameId}.png`)

        if (!existsSync(pngPath)) {
            svgFilesToConvert.push(destPath)
        }

        let didError = false
        if (!existsSync(destPath) || !metadata[gameId]) {
            try {
                console.log(`${i}/${gists.length} ${gameId}`) // tslint:disable-line:no-console
                const { svg, title, author, homepage, backgroundColor, popularColors } = buildIcon(sourcePath)

                metadata[gameId] = { title, author, homepage, backgroundColor, popularColors }

                writeFileSync(destPath, svg)

            } catch (err) {
                didError = true
                // problem loading the game
                svgFilesToConvert.pop() // do not generate a PNG file of it.
                console.error(`Problem building an SVG image for ${gameId}. ${err.message}`) // tslint:disable-line:no-console
            }
        }

        if (!didError) {
            const authorMarkup = metadata[gameId].author ? `<div class="game-author">by ${metadata[gameId].author}</div>` : ''
            html.push(`
<a href="../#${gameId}">
    <figure id="${gameId}">
        <div class="thumbnail-wrapper" style="background-color: ${metadata[gameId].backgroundColor || metadata[gameId].popularColors[0]}">
            <img src="./_placeholder.gif" data-src="./${gameId}.png"/>
        </div>
        <figcaption>
            <div class="game-title">${metadata[gameId].title}</div>
            ${authorMarkup}
        </figcaption>
    </figure>
</a>`)
        }

        i++
    }

    html.push(`
    <script>
    const images = Array.from(document.querySelectorAll('.thumbnail-wrapper img')).map(image => { return {image, isLoaded: false} })


    function scrollHandler() {
        function isVisible(el) {
            var rect = el.getBoundingClientRect()
            const min = 150 * 4 // keep about 4 rows above
            const max = 150 * 4 // keep about 4 rows below
            return (
                rect.top        >= -min
                && rect.left    >= -min
                && rect.top <= (window.innerHeight || document.documentElement.clientHeight) + max
            )
        }

        for (const entry of images) {
            const {image, isLoaded} = entry
            const isVis = isVisible(image)
            if (isVis && !isLoaded) {
                // loadImage
                image.setAttribute('data-placeholder', image.getAttribute('src'))
                image.setAttribute('src', image.getAttribute('data-src'))
                entry.isLoaded = true
            } else if (!isVis && isLoaded) {
                // hideImage
                // image.setAttribute('src', image.getAttribute('data-placeholder'))
            }
        }
    }

    function _debounce(callback) {
        let timeout
        return () => {
            if (timeout) {
                clearTimeout(timeout)
            }
            timeout = setTimeout(() => {
                callback()
            }, 10)
        }
    }

    window.addEventListener('scroll', _debounce(scrollHandler))
    scrollHandler()
    </script>

    </body></html>`)

    writeFileSync(join(__dirname, '../browse-games/index.html'), html.join('\n'))
    writeFileSync(jsonMetadataPath, JSON.stringify(metadata, null, 2))

    // Convert SVG images to PNG images
    console.log(`Generating ${svgFilesToConvert.length} PNG files...`) // tslint:disable-line:no-console
    if (svgFilesToConvert.length > 0) {
        svgToPng.convert(svgFilesToConvert, join(__dirname, '../browse-games/'), {
            defaultWidth: 100,
            defaultHeight: 100
        })
    }
}
