// This generates SVG icons for each game
const fs = require('fs')
const path = require('path')
const glob = require('glob')
const pify = require('pify')
const svgToPng = require('svg-to-png')
const {buildIcon} = require('../lib/cli/buildGameIcon')

const SOLUTIONS_GLOB = path.join(__dirname, '../game-solutions/*.json')

// run()

module.exports = {
    run: async function run() {
        const gists = await pify(glob)(SOLUTIONS_GLOB)

        jsonMetadataPath = path.join(__dirname, '../browse-games/_metadata.json')

        const metadata = fs.existsSync(jsonMetadataPath) ? JSON.parse(fs.readFileSync(jsonMetadataPath, 'utf-8')) : {}
        const svgFilesToConvert = []
        let html = [`<html><head><style>
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
            const gameId = path.basename(f).replace('.json', '')
            const sourcePath = path.join(__dirname, `../games/${gameId}/script.txt`)
            const destPath = path.join(__dirname, `../browse-games/${gameId}.svg`)
            const pngPath = path.join(__dirname, `../browse-games/${gameId}.png`)

            if (!fs.existsSync(pngPath)) {
                svgFilesToConvert.push(destPath)
            }

            let didError = false
            if (!fs.existsSync(destPath) || !metadata[gameId]) {
                try {
                    console.log(`${i}/${gists.length} ${gameId}`)
                    const {svg, title, author, homepage, backgroundColor, popularColors } = buildIcon(sourcePath)

                    metadata[gameId] = {title, author, homepage, backgroundColor, popularColors}
                
                    fs.writeFileSync(destPath, svg)

                } catch (err) {
                    didError = true
                    // problem loading the game
                    svgFilesToConvert.pop() // do not generate a PNG file of it.
                    console.error(`Problem building an SVG image for ${gameId}. ${err.message}`)
                }
            }

            if (!didError) {
                const authorMarkup = metadata[gameId].author ? `<div class="game-author">by ${metadata[gameId].author}</div>` : ''
                html.push(`<a href="../#${gameId}"><figure id="${gameId}"><div class="thumbnail-wrapper" style="background-color: ${metadata[gameId].backgroundColor || metadata[gameId].popularColors[0]}"><img src="./_placeholder.gif" data-src="./${gameId}.png"/></div><figcaption><div class="game-title">${metadata[gameId].title}</div>${authorMarkup}</figcaption></figure></a>`)
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
        
        fs.writeFileSync(path.join(__dirname, '../browse-games/index.html'), html.join('\n'))
        fs.writeFileSync(jsonMetadataPath, JSON.stringify(metadata, null, 2))


        // Convert SVG images to PNG images
        console.log(`Generating ${svgFilesToConvert.length} PNG files...`)
        if (svgFilesToConvert.length > 0) {
            svgToPng.convert(svgFilesToConvert, path.join(__dirname, '../browse-games/'), {
                defaultWidth: 100,
                defaultHeight: 100
            })
        }
    }
}