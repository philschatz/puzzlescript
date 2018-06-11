import * as ansiStyles from 'ansi-styles'
import * as ansiEscapes from 'ansi-escapes'
import * as supportsColor from 'supports-color'
import { GameSprite } from './models/tile'
import { GameData } from './models/game'
import { IColor } from './models/colors'
import Engine, { Cell } from './engine'
import { RULE_DIRECTION_ABSOLUTE } from './util';

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

class CellColorCache {
    _cache: Map<string, IColor[][]>

    constructor() {
        this._cache = new Map()
    }

    get(spritesToDraw: GameSprite[], backgroundColor: IColor) {
        const key = spritesToDraw.map(s => s._name).join(' ')
        if (!this._cache.has(key)) {
            this._cache.set(key, collapseSpritesToPixels(spritesToDraw, backgroundColor))
        }
        return this._cache.get(key)
    }

    clear() {
        this._cache.clear()
    }
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
    _gameData: GameData
    _engine: Engine
    _cellColorCache: CellColorCache
    _renderedPixels: string[][] // string is the hex code of the pixel
    _resizeHandler?: () => void
    _windowOffsetColStart: number
    _windowOffsetRowStart: number
    _windowOffsetWidth: number
    _windowOffsetHeight: number
    constructor() {
        this._cellColorCache = new CellColorCache()
        this._resizeHandler = null
        this._renderedPixels = []
        this._windowOffsetColStart = 0
        this._windowOffsetRowStart = 0
    }
    setGame(engine: Engine) {
        this._engine = engine
        this._gameData = engine.gameData
        this._cellColorCache.clear()
        this._renderedPixels = []

        // reset flickscreen and zoomscreen settings
        this._windowOffsetColStart = 0
        this._windowOffsetRowStart = 0

        this._windowOffsetWidth = null
        this._windowOffsetHeight = null
        if (this._gameData.metadata.flickscreen) {
            const { width, height } = this._gameData.metadata.flickscreen
            this._windowOffsetWidth = width
            this._windowOffsetHeight = height
        } else if (this._gameData.metadata.zoomscreen) {
            const { width, height } = this._gameData.metadata.zoomscreen
            this._windowOffsetWidth = width
            this._windowOffsetHeight = height
        }

    }
    debugRenderScreen() {
        if (this._engine && this._engine.currentLevel) {
            this.renderScreen()
        }
    }
    renderScreen() {
        if (!supportsColor.stdout) {
            console.log('Playing a game in the console requires color support. Unfortunately, color is not supported so not rendering (for now). We could just do an ASCII dump or something, using  ░▒▓█ to denote shades of cells')
            return
        }
        const levelRows = this._engine.currentLevel

        this._cellColorCache.clear()
        this._renderedPixels = []

        // Handle resize events by redrawing the game. Ooh, we do not have Cells at this point.
        // TODO Run renderScreen on cells from the engine rather than cells from the Level data
        if (this._resizeHandler) {
            process.stdout.off('resize', this._resizeHandler)
        }
        this._resizeHandler = () => {
            this.clearScreen()
            this.renderScreen()
        }
        process.stdout.on('resize', this._resizeHandler)

        setFgColor('#ffffff')
        setBgColor('#000000')

        levelRows.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                this.drawCell(cell, false)
            })
        })
        // Clear back to sane colors
        setFgColor('#ffffff')
        setBgColor('#000000')
        // restoreCursor()

        // Just for debugging, print the game title (doing it here helps with Jest rendering correctly)
        this.writeDebug(`"${this._gameData.title}"`)
    }

    cellPosToXY(cell: Cell) {
        const { colIndex, rowIndex } = cell
        let isOnScreen = true // can be set to false for many reasons
        let cellStartX = -1
        let cellStartY = -1
        if (this._windowOffsetHeight && this._windowOffsetWidth) {
            if (this._windowOffsetColStart > colIndex ||
                this._windowOffsetRowStart > rowIndex ||
                this._windowOffsetColStart + this._windowOffsetWidth <= colIndex ||
                this._windowOffsetRowStart + this._windowOffsetHeight <= rowIndex) {

                // cell is off-screen
                isOnScreen = false
            }
        }
        cellStartX = (colIndex - this._windowOffsetColStart) * 5 /*pixels*/ * 2 /*characters to make a pixel squareish*/
        cellStartY = (rowIndex - this._windowOffsetRowStart) * 5 /*pixels*/ + 1 // y is 1-based

        // Check if the cell can be completely drawn on the screen. If not, print ellipses
        const cellIsTooWide = (cellStartX + 5 * 2) > process.stdout.columns // 10 because we print 2 chars per pixel
        const cellIsTooHigh = (cellStartY + 5) > process.stdout.rows
        if (cellIsTooWide || cellIsTooHigh) {
            // do not draw the cell
            isOnScreen = false
        }
        return { isOnScreen, cellStartX, cellStartY }
    }

    setPixel(x: number, y: number, hex: string) {
        if (process.env['NODE_ENV'] !== 'production') {
            drawPixelChar(x, y, hex)
        } else {
            if (!this._renderedPixels[y]) {
                this._renderedPixels[y] = []
            }
            if (this._renderedPixels[y][x] !== hex) {
                drawPixelChar(x, y, hex)
                this._renderedPixels[y][x] = hex
            }
        }
    }

    // Returns true if the window was moved (so we can re-render the screen)
    recenterPlayerIfNeeded(playerCell: Cell, isOnScreen: boolean) {
        let boundingBoxLeft
        let boundingBoxTop
        let boundingBoxWidth
        let boundingBoxHeight

        const windowLeft = this._windowOffsetColStart
        const windowTop = this._windowOffsetRowStart
        let windowWidth
        let windowHeight

        const flickScreen = this._gameData.metadata.flickscreen
        const zoomScreen = this._gameData.metadata.zoomscreen
        const terminalWidth = Math.floor(process.stdout.columns / (5 * 2))
        const terminalHeight = Math.floor(process.stdout.rows / 5)

        if (flickScreen) {
            boundingBoxTop = playerCell.rowIndex - (playerCell.rowIndex % flickScreen.height)
            boundingBoxLeft = playerCell.colIndex - (playerCell.colIndex % flickScreen.width)
            boundingBoxHeight = flickScreen.height
            boundingBoxWidth = flickScreen.width
        } else {
            boundingBoxLeft = 0
            boundingBoxTop = 0
            boundingBoxHeight = this._engine.currentLevel.length
            boundingBoxWidth = this._engine.currentLevel[0].length
        }

        if (zoomScreen) {
            windowHeight = Math.min(zoomScreen.height, terminalHeight)
            windowWidth = Math.min(zoomScreen.width, terminalWidth)
        } else {
            windowHeight = terminalHeight
            windowWidth = terminalWidth
        }


        // If the boundingbox is larger than the window then we need to apply the zoom
        // which means we need to pan whenever the player moves out of the middle 1/2 of
        // the screen.
        if (boundingBoxHeight <= windowHeight && boundingBoxWidth <= windowWidth) {
            // just ensure that the player is on the screen
            if (isOnScreen) {
            } else {
                this._windowOffsetColStart = boundingBoxLeft
                this._windowOffsetRowStart = boundingBoxTop
                return true
            }
        } else {
            // Move the screen so that the player is centered*
            // Except when we are at one of the edges of the level/flickscreen

            //Check the left and then the top
            let didADirectionChange = false

            if (boundingBoxWidth > windowWidth) {
                if (windowLeft + Math.round(windowWidth / 4) > playerCell.colIndex ||
                    windowLeft + Math.round(windowWidth * 3 / 4) <= playerCell.colIndex) {

                    let newWindowLeft = playerCell.colIndex - Math.floor(windowWidth / 2)
                    // Check the near sides of the bounding box (left)
                    newWindowLeft = Math.max(newWindowLeft, boundingBoxLeft)
                    // Check the far sides of the bounding box (right)
                    if (newWindowLeft + windowWidth > boundingBoxLeft + boundingBoxWidth) {
                        newWindowLeft = boundingBoxLeft + boundingBoxWidth - windowWidth
                    }

                    if (newWindowLeft !== this._windowOffsetColStart) {
                        this._windowOffsetColStart = newWindowLeft
                        didADirectionChange = true
                    }
                }
            }

            // This is copy/pasta'd from above but adjusted for Top instead of Left
            if (boundingBoxHeight > windowHeight) {
                if (windowTop + Math.round(windowHeight / 4) > playerCell.rowIndex ||
                    windowTop + Math.round(windowHeight * 3 / 4) <= playerCell.rowIndex) {

                    let newWindowTop = playerCell.rowIndex - Math.floor(windowHeight / 2)

                    // Check the near sides of the bounding box (top)
                    newWindowTop = Math.max(newWindowTop, boundingBoxTop)

                    // Check the far sides of the bounding box (bottom)
                    if (newWindowTop + windowHeight > boundingBoxTop + boundingBoxHeight) {
                        newWindowTop = boundingBoxTop + boundingBoxHeight - windowHeight
                    }

                    // Only recenter the axis that moved to be out-of-center
                    if (newWindowTop !== this._windowOffsetRowStart) {
                        this._windowOffsetRowStart = newWindowTop
                        didADirectionChange = true
                    }
                }
            }

            if (!didADirectionChange) {
                // cell is within the middle of the window.
                // just ensure that the player is on the screen
                if (isOnScreen) {
                } else {
                    this._windowOffsetColStart = boundingBoxLeft
                    this._windowOffsetRowStart = boundingBoxTop
                    return true
                }

            }
            return didADirectionChange
        }

        return false
    }

    drawCell(cell: Cell, dontRestoreCursor: boolean) {
        const { rowIndex, colIndex } = cell
        if (!supportsColor.stdout) {
            console.log(`Updating cell [${cell.rowIndex}][${cell.colIndex}] to have sprites: [${cell.getSprites().map(sprite => sprite._name)}]`)
            return
        }

        const spritesForDebugging = cell.getSprites()

        let { isOnScreen, cellStartX, cellStartY } = this.cellPosToXY(cell)

        // Sort of HACKy... If the player is not visible on the screen then we need to
        // move the screen so that they are visible.
        const playerTile = this._gameData.getPlayer()
        const cellHasPlayer = playerTile.matchesCell(cell)
        if (playerTile.getCellsThatMatch().size === 1 && cellHasPlayer) {
            if (this.recenterPlayerIfNeeded(cell, isOnScreen)) {
                return this.renderScreen()
            }
            // otherwise, keep rendering cells like normal
        }

        if (!isOnScreen) {
            return // no need to render because it is off-screen
        }
        const pixels: IColor[][] = this.getPixelsForCell(cell)
        pixels.forEach((spriteRow, spriteRowIndex) => {
            spriteRow.forEach((spriteColor: IColor, spriteColIndex) => {
                const x = cellStartX + (spriteColIndex * 2) // Use 2 characters for 1 pixel on the X-axis.
                const y = cellStartY + spriteRowIndex

                // Don't draw below the edge of the screen. Otherwise, bad scrolling things will happen
                if (y >= process.stdout.rows) {
                    return
                }

                let color: IColor

                // Always draw a transparent character so we can see if something is not rendering
                // this.setPixel(x, y, '#ffffff', '░')
                // this.setPixel(x + 1, y, '#ffffff', '░') // double-width because the console is narrow

                if (spriteColor) {
                    if (!spriteColor.isTransparent()) {
                        color = spriteColor
                    }
                    else if (this._gameData.metadata.background_color) {
                        color = this._gameData.metadata.background_color
                    }
                }

                if (!!color) {
                    const { r, g, b } = color.toRgb()
                    const hex = color.toHex()

                    this.setPixel(x, y, hex)
                    this.setPixel(x + 1, y, hex) // double-width because the console is narrow

                    // Print a debug number which contains the number of sprites in this cell
                    // Change the foreground color to be black if the color is light
                    if (process.env['NODE_ENV'] !== 'production') {
                        if (r > 192 && g > 192 && b > 192) {
                            setFgColor('#000000')
                        }
                        const sprite = spritesForDebugging[spriteRowIndex]
                        if (sprite) {
                            let spriteName = sprite._name
                            let wantsToMove

                            switch (cell.getWantsToMove(sprite)) {
                                case RULE_DIRECTION_ABSOLUTE.STATIONARY:
                                    wantsToMove = ''
                                    break
                                case RULE_DIRECTION_ABSOLUTE.UP:
                                    wantsToMove = '^'
                                    break
                                case RULE_DIRECTION_ABSOLUTE.DOWN:
                                    wantsToMove = 'v'
                                    break
                                case RULE_DIRECTION_ABSOLUTE.LEFT:
                                    wantsToMove = '<'
                                    break
                                case RULE_DIRECTION_ABSOLUTE.RIGHT:
                                    wantsToMove = '>'
                                    break
                                case RULE_DIRECTION_ABSOLUTE.ACTION:
                                    wantsToMove = 'X'
                                    break
                                default:
                                    throw new Error(`BUG: Invalid wantsToMove "${cell.getWantsToMove(sprite)}"`)
                            }
                            spriteName = `${wantsToMove}${spriteName}`
                            if (spriteName.length > 10) {
                                spriteName = `${spriteName.substring(0, 5)}.${spriteName.substring(spriteName.length - 4)}`
                            }
                            writeTextAt(x, y, `${spriteName.substring(spriteColIndex * 2, spriteColIndex * 2 + 2)}`)
                        }
                        if (spriteRowIndex === 4 && spriteColIndex === 4) {
                            if (spritesForDebugging.length > 9) {
                                writeTextAt(x, y, `${spritesForDebugging.length}`)
                            } else {
                                writeTextAt(x + 1, y, `${spritesForDebugging.length}`)
                            }
                        }
                    }
                }
            })
        })

        if (!dontRestoreCursor) {
            restoreCursor()
        }
    }

    getPixelsForCell(cell: Cell) {
        const spritesToDraw = cell.getSprites() // Not sure why, but entanglement renders properly when reversed

        // If there is a magic background object then rely on it last
        let magicBackgroundSprite = this._gameData.getMagicBackgroundSprite()
        if (magicBackgroundSprite) {
            spritesToDraw.push(magicBackgroundSprite)
        }

        const pixels = this._cellColorCache.get(spritesToDraw, this._gameData.metadata.background_color)
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