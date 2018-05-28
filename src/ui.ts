import * as ansiStyles from 'ansi-styles'
import * as ansiEscapes from 'ansi-escapes'
import * as supportsColor from 'supports-color'
import { GameSprite } from './models/tile'
import { GameData } from './models/game'
import { IColor } from './models/colors'
import { Cell } from './engine'

// Determine if this
// 'truecolor' if this terminal supports 16m colors. 256 colors otherwise
const supports16mColors = process.env['COLORTERM'] === 'truecolor'

function setBgColor(hex) {
    if (supports16mColors) {
        process.stdout.write(ansiStyles.bgColor.ansi16m.hex(hex))
    } else {
        process.stdout.write(ansiStyles.bgColor.ansi256.hex(hex))
    }
}
function setFgColor(hex) {
    if (supports16mColors) {
        process.stdout.write(ansiStyles.color.ansi16m.hex(hex))
    } else {
        process.stdout.write(ansiStyles.color.ansi256.hex(hex))
    }
}
function moveTo(x, y) {
    process.stdout.write(ansiEscapes.cursorTo(x, y))
}
function hideCursor() {
    process.stdout.write(ansiEscapes.cursorHide)
}
function showCursor() {
    process.stdout.write(ansiEscapes.cursorShow)
}
function clearScreen() {
    process.stdout.write(ansiEscapes.clearScreen)
}
function drawPixelChar(x, y, hex, char = ' ') {
    setBgColor(hex)
    moveTo(x, y)
    process.stdout.write(char)
}
function writeTextAt(x, y, msg) {
    moveTo(x, y)
    process.stdout.write(msg)
}

// First Sprite one is on top.
// This caused a 2x speedup while rendering.
function collapseSpritesToPixels(spritesToDraw: GameSprite[], backgroundColor: IColor) {
    if (spritesToDraw.length === 0) {
        // Just draw the background
        const sprite: IColor[][] = []
        for (let y = 0; y < 5; y++) {
            sprite[y] = sprite[y] || []
            for (let x = 0; x < 5; x++) {
                // If this is the last sprite and nothing was found then use the game background color
                sprite[y][x] = backgroundColor
            }
        }
        return sprite
    }
    // Record Code coverage
    if (process.env['NODE_ENV'] !== 'production') {
        spritesToDraw[0].__coverageCount++
    }
    if (spritesToDraw.length === 1) {
        return spritesToDraw[0].getPixels()
    }
    const sprite = spritesToDraw[0].getPixels()
    spritesToDraw.slice(1).forEach((objectToDraw, spriteIndex) => {
        if (process.env['NODE_ENV'] !== 'production') {
            objectToDraw.__coverageCount++
        }
        const pixels = objectToDraw.getPixels()
        for (let y = 0; y < 5; y++) {
            sprite[y] = sprite[y] || []
            for (let x = 0; x < 5; x++) {
                const pixel = pixels[y][x]
                // try to pull it out of the current sprite
                if ((!sprite[y][x] || sprite[y][x].isTransparent()) && pixel && !pixel.isTransparent()) {
                    sprite[y][x] = pixel
                }
            }
        }
    })
    return sprite
}

class UI {
    _resizeHandler?: () => void
    constructor() {
        this._resizeHandler = null
    }
    renderScreen(data: GameData, levelRows: Cell[][]) {
        if (!supportsColor.stdout) {
            console.log('Playing a game in the console requires color support. Unfortunately, color is not supported so not rendering (for now). We could just do an ASCII dump or something, using  ░▒▓█ to denote shades of cells')
            return
        }

        // Handle resize events by redrawing the game. Ooh, we do not have Cells at this point.
        // TODO Run renderScreen on cells from the engine rather than cells from the Level data
        if (this._resizeHandler) {
            process.stdout.off('resize', this._resizeHandler)
        }
        this._resizeHandler = () => {
            this.renderScreen(data, levelRows)
        }
        process.stdout.on('resize', this._resizeHandler)

        setFgColor('#ffffff')
        setBgColor('#000000')

        this.clearScreen()

        levelRows.forEach((row, rowIndex) => {
            // Don't draw too much for this demo
            if (data.metadata.flickscreen && rowIndex > data.metadata.flickscreen.height) {
                return
            }
            row.forEach((cell, colIndex) => {
                // Don't draw too much for this demo
                if (data.metadata.flickscreen && colIndex > data.metadata.flickscreen.width) {
                    return
                }

                this.drawCell(data, cell, false)
            })
        })
        // Clear back to sane colors
        setFgColor('#ffffff')
        setBgColor('#000000')
        // restoreCursor()

        // Just for debugging, print the game title (doing it here helps with Jest rendering correctly)
        this.writeDebug(`"${data.title}"`)
    }

    drawCell(data: GameData, cell: Cell, dontRestoreCursor: boolean) {
        if (!supportsColor.stdout) {
            console.log(`Updating cell [${cell.rowIndex}][${cell.colIndex}] to have sprites: [${cell.getSprites().map(sprite => sprite._name)}]`)
            return
        }

        // Check if the cell can be completely drawn on the screen. If not, print ellipses
        const cellIsTooWide = (cell.colIndex + 1) * 10 > process.stdout.columns // 10 because we print 2 chars per pixel
        const cellIsTooHigh = (cell.rowIndex + 1) * 5 > process.stdout.rows
        if (cellIsTooWide || cellIsTooHigh) {
            // do not draw the cell
            return
        } else if (cellIsTooWide) {
            // TODO: print ellipsis so user knows they should resize their terminal
            // TODO: If implementing this, then change the initial if to be `&&` instead
            // of `||`
        }

        const spritesForDebugging = cell.getSprites()
        const { rowIndex, colIndex } = cell
        const pixels: IColor[][] = this.getPixelsForCell(data, cell)

        pixels.forEach((spriteRow, spriteRowIndex) => {
            spriteRow.forEach((spriteColor: IColor, spriteColIndex) => {
                const x = (colIndex * 5 + spriteColIndex) * 2 + 1 // Use 2 characters for 1 pixel on the X-axis. X column is 1-based
                const y = rowIndex * 5 + spriteRowIndex + 1 // Y column is 1-based

                // Don't draw below the edge of the screen. Otherwise, bad scrolling things will happen
                if (y >= process.stdout.rows) {
                    return
                }

                let color: IColor

                // Always draw a transparent character so we can see if something is not rendering
                drawPixelChar(x, y, '#ffffff', '░')
                drawPixelChar(x + 1, y, '#ffffff', '░') // double-width because the console is narrow

                if (spriteColor) {
                    if (!spriteColor.isTransparent()) {
                        color = spriteColor
                    }
                    else if (data.metadata.background_color) {
                        color = data.metadata.background_color
                    }
                }

                if (!!color) {
                    const { r, g, b } = color.toRgb()
                    const hex = color.toHex()

                    drawPixelChar(x, y, hex)
                    drawPixelChar(x + 1, y, hex) // double-width because the console is narrow

                    // Print a debug number which contains the number of sprites in this cell
                    // Change the foreground color to be black if the color is light
                    if (r > 192 && g > 192 && b > 192) {
                        setFgColor('#000000')
                    }
                    if (spritesForDebugging[spriteRowIndex]) {
                        let spriteName = spritesForDebugging[spriteRowIndex]._name
                        if (spriteName.length > 10) {
                            spriteName = `${spriteName.substring(0, 5)}.${spriteName.substring(spriteName.length - 4)}`
                        }
                        writeTextAt(x, y, `${spriteName.substring(spriteColIndex * 2, spriteColIndex * 2 + 2)}`)
                    }
                    if (spriteRowIndex === 4 && spriteColIndex === 4) {
                        writeTextAt(x + 1, y, `${spritesForDebugging.length}`)
                    }
                }
            })
        })

        if (!dontRestoreCursor) {
            restoreCursor()
        }
    }

    getPixelsForCell(data: GameData, cell: Cell) {
        const spritesToDraw = cell.getSprites() // Not sure why, but entanglement renders properly when reversed

        // If there is a magic background object then rely on it last
        let magicBackgroundSprite = data.getMagicBackgroundSprite()
        if (magicBackgroundSprite) {
            spritesToDraw.push(magicBackgroundSprite)
        }

        const pixels = collapseSpritesToPixels(spritesToDraw, data.metadata.background_color)
        return pixels
    }

    clearScreen() {
        if (!supportsColor.stdout) {
            console.log(`Clearing screen`)
            return
        }

        setFgColor('#ffffff')
        setBgColor('#000000')
        // Output \n for each row that we have. That way any output from before is preserved
        // const rows = process.stdout.rows || 0
        // for (let i = 0; i < rows; i++) {
        //   console.log('\n')
        // }
        clearScreen()
    }

    writeDebug(text: string) {
        if (!supportsColor.stdout) {
            console.log(`Writing Debug text "${text}"`)
            return
        }
        setFgColor('#ffffff')
        setBgColor('#000000')
        writeText(0, 0, `[${text}]`)
    }
}

function restoreCursor() {
    if (!supportsColor.stdout) {
        return
    }
    setFgColor('#ffffff')
    setBgColor('#000000')
    moveTo(process.stdout.columns, process.stdout.rows)
}

function writeText(x: number, y: number, text: string) {
    if (!supportsColor.stdout) {
        console.log(`Writing text at [${y}][${x}]: "${text}"`)
        return
    }
    writeTextAt(x, y, text)
    restoreCursor()
}

export default new UI()

// Mac terminal does not render all the colors so some pixels do not look different.
// See 391852197b1aef15558342df2670d635 (the grid)
// for (let r = 0; r < 256; r+=16) {
//   for (let g = 0; g < 256; g+=16) {
//     for (let b = 0; b < 256; b+=16) {
//       console.log(ansiStyles.bgColor.ansi16m.rgb(r, g, b) + ' ' + ansiStyles.bgColor.close)
//     }
//     console.log(ansiStyles.bgColor.ansi16m.rgb(0, 0, 0) + '\n' + ansiStyles.bgColor.close)
//   }
//   console.log(ansiStyles.bgColor.ansi16m.rgb(0, 0, 0) + '\n' + ansiStyles.bgColor.close)
// }