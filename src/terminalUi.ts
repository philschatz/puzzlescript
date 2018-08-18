import * as _ from 'lodash'
import * as ansiStyles from 'ansi-styles'
import * as ansiEscapes from 'ansi-escapes'
import * as supportsColor from 'supports-color'
import chalk from 'chalk';

import { Cell, GameData, Optional, RULE_DIRECTION } from '.'
import { GameSprite } from './models/tile'
import { IColor } from './models/colors'
import { CollisionLayer } from './models/collisionLayer';
import BaseUI from './ui';

// Determine if this
// 'truecolor' if this terminal supports 16m colors. 256 colors otherwise
const supports16mColors = process.env['COLORTERM'] === 'truecolor'

function setBgColor(hex: string) {
    if (supports16mColors) {
        return ansiStyles.bgColor.ansi16m.hex(hex)
    } else {
        return ansiStyles.bgColor.ansi256.hex(hex)
    }
}

function setFgColor(hex: string) {
    if (supports16mColors) {
        return ansiStyles.color.ansi16m.hex(hex)
    } else {
        return ansiStyles.color.ansi256.hex(hex)
    }
}
function writeBgColor(hex: string) {
    process.stdout.write(setBgColor(hex))
}
function writeFgColor(hex: string) {
    process.stdout.write(setFgColor(hex))
}
function setMoveTo(x: number, y: number) {
    return ansiEscapes.cursorTo(x, y)
}
function setShowCursor() {
    return ansiEscapes.cursorShow
}
function clearScreen() {
    process.stdout.write(ansiEscapes.clearScreen)
}
function clearLineAndWriteTextAt(x: number, y: number, msg: string) {
    process.stdout.write(`${setMoveTo(x, y)}${ansiEscapes.eraseLine}${msg}`)
}
function drawPixelChar(x: number, y: number, fgHex: Optional<string>, bgHex: Optional<string>, char: string) {
    const out:string[] = []
    if (fgHex) {
        out.push(setFgColor(fgHex))
    }
    if (bgHex) {
        out.push(setBgColor(bgHex))
    }
    out.push(setMoveTo(x, y))
    out.push(char)
    // In case the user presses Ctrl+C, always set the colors back to white on black
    out.push(setBgColor('#000000'))
    out.push(setFgColor('#ffffff'))
    out.push(setShowCursor())
    return out.join('')
}


class TerminalUI extends BaseUI {
    private resizeHandler: Optional<() => void>
    private debugCategoryMessages: string[]
    protected inspectorCol: number
    protected inspectorRow: number

    constructor() {
        super()
        this.debugCategoryMessages = []
        this.resizeHandler = null
        this.setSmallTerminal(false) // use really big (but cleaner) characters
        this.hasVisualUi = supportsColor.stdout

        // This is the "inspector" cursor that allows a11y
        this.inspectorCol = 0
        this.inspectorRow = 0

        // Handle resize events by redrawing the game. Ooh, we do not have Cells at this point.
        // TODO Run renderScreen on cells from the engine rather than cells from the Level data
        if (!this.resizeHandler) {
            this.resizeHandler = _.debounce(() => {
                this.clearScreen()
                this.renderScreen(true)
            })
            process.stdout.on('resize', this.resizeHandler)
        }
    }

    getHasVisualUi() {
        return this.hasVisualUi
    }
    setHasVisualUi(flag: boolean) {
        this.hasVisualUi = flag
    }
    setSmallTerminal(yesNo: boolean) {
        if (yesNo) {
            this.PIXEL_WIDTH = 1 // number of characters in the terminal used to represent a pixel
            this.PIXEL_HEIGHT = .5
        } else {
            this.PIXEL_WIDTH = 2
            this.PIXEL_HEIGHT = 1
        }
    }
    private isLargeTerminal() {
        return this.PIXEL_HEIGHT === 1
    }
    private clearLineAndWriteText(x: number, y: number, text: string) {
        if (!this.hasVisualUi) {
            console.log(`Writing text at [${y}][${x}]: "${text}"`)
            return
        }
        writeFgColor('#ffffff')
        writeBgColor('#000000')
        clearLineAndWriteTextAt(x, y, text)
        process.stdout.write(getRestoreCursor())
    }

    clearScreen() {
        if (!this.hasVisualUi) {
            console.log(`Clearing screen`)
            return
        }

        // clear the cache of what is rendered
        this.renderedPixels = []

        writeFgColor('#ffffff')
        writeBgColor('#000000')
        // Output \n for each row that we have. That way any output from before is preserved
        // const rows = process.stdout.rows || 0
        // for (let i = 0; i < rows; i++) {
        //   console.log('\n')
        // }
        clearScreen()
    }

    dumpScreen() {
        // Used by unit tests when one of the games fails to complete or completes prematurely
        this.isDumpingScreen = true
        this.renderScreen(false)
        this.isDumpingScreen = false

        process.stdout.write('\n')
        for (let y = 0; y < this.renderedPixels.length; y++) {
            const row = this.renderedPixels[y]
            if (!row) { continue }
            for (let x = 0; x < row.length; x++) {
                let {hex, chars} = row[x]

                writeBgColor(hex)
                if (chars.length === 1) { chars = ' ' + chars }
                if (chars.length === 0) { chars = '  ' }
                process.stdout.write(chars)
            }
            writeBgColor('#000000')
            process.stdout.write('\n')
        }
        process.stdout.write('\n')
        process.stdout.write('\n')
        process.stdout.write('\n')
    }

    canShowMessageAsCells() {
        const screenWidth = 34
        const screenHeight = 13

        const {columns, rows} = getTerminalSize()

        return this.hasVisualUi && columns >= screenWidth * 5 * this.PIXEL_WIDTH && rows >= screenHeight * 5 * this.PIXEL_HEIGHT
    }

    protected renderLevelScreen(levelRows: Cell[][], renderScreenDepth: number) {
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }

        if (this.hasVisualUi) {
            this.drawCells(_.flatten(levelRows), false, renderScreenDepth)

            // Just for debugging, print the game title (doing it here helps with Jest rendering correctly)
            this.writeDebug(`"${this.gameData.title}"`, 0)

        } else {

            // Print out the size of the screen and the count of each sprite on the screen
            const collisionLayerToSprites: Map<CollisionLayer, Map<GameSprite, Cell[]>> = new Map()
            for (const cell of _.flatten(levelRows)) {
                if (this.cellPosToXY(cell).isOnScreen) {
                    for (const sprite of cell.getSpritesAsSet()) {
                        const collisionLayer = sprite.getCollisionLayer()
                        // create a new Map if one does not exist
                        let spriteToCells = collisionLayerToSprites.get(collisionLayer)
                        if (!spriteToCells) {
                            spriteToCells = new Map()
                            collisionLayerToSprites.set(collisionLayer, spriteToCells)
                        }

                        // create a new array if one does not exist
                        let cells = spriteToCells.get(sprite)
                        if (!cells) {
                            cells = []
                            spriteToCells.set(sprite, cells)
                        }

                        cells.push(cell)
                    }
                }
            }

            console.log(`Level size is ${this.windowOffsetHeight || levelRows.length} high by ${this.windowOffsetWidth || levelRows[0].length} wide`)
            console.log(`-------------------------`)
            for (const collisionLayer of [...collisionLayerToSprites.keys()].sort((a, b) => /*reversed bc that is how they are rendered on screen*/b.id - a.id)) {
                const spriteToCells = collisionLayerToSprites.get(collisionLayer)
                if (!spriteToCells) {
                    throw new Error(`BUG: could not find mapping to sprite map`)
                }
                console.log(`${chalk.greenBright(`START:`)} ${chalk.whiteBright(`${spriteToCells.size}`)} Sprites in same collision layer`)
                for (const sprite of spriteToCells.keys()) {
                    const cells = spriteToCells.get(sprite)

                    if (!cells) {
                        throw new Error(`BUG: could not find mapping to cells`)
                    }
                    const msg = `    ${sprite.getName()} ${cells.length}`
                    // this.writeDebug(msg, 0)
                    console.log(msg)
                }
            }
        }
    }


    protected setPixel(x: number, y: number, hex: string, fgHex: Optional<string>, chars: string) {
        const ret: string[] = []
        const getColor = (y: number, x: number) => {
            if (this.renderedPixels[y] && this.renderedPixels[y][x]) {
                return this.renderedPixels[y][x].hex
            } else {
                return '#000000'
            }
        }
        if (!chars) {
            chars = ' '
        }

        if (chars.length > 2) {
            throw new Error(`BUG: Expected char to be of length 0, 1, or 2`)
        }
        if (!this.renderedPixels[y]) {
            this.renderedPixels[y] = []
        }
        const onScreenPixel = this.renderedPixels[y][x]
        if (!onScreenPixel || onScreenPixel.hex !== hex || onScreenPixel.chars !== chars) {
            this.renderedPixels[y][x] = {hex, chars}

            if (this.isDumpingScreen) {
                return '' // don't actually render the pixel
            }
            if (this.PIXEL_HEIGHT === 1) {
                ret.push(drawPixelChar(x * this.PIXEL_WIDTH, y + 1/*titlebar*/, fgHex, hex, chars[0] || ' '))
                ret.push(drawPixelChar(x * this.PIXEL_WIDTH + 1, y + 1/*titlebar*/, fgHex, hex, chars[1] || ' '))
            } else {
                let upperColor
                let lowerColor
                if (y % 2 === 0) {
                    upperColor = hex
                    lowerColor = getColor(y + 1, x)
                } else {
                    upperColor = getColor(y - 1, x)
                    lowerColor = hex
                }
                ret.push(drawPixelChar(x * this.PIXEL_WIDTH, Math.floor(y * this.PIXEL_HEIGHT) + 1/*titlebar*/, lowerColor, upperColor, '▄'))
            }
        }
        return ret.join('')
    }

    protected drawCellsAfterRecentering(cells: Iterable<Cell>, renderScreenDepth: number) {
        const ret = []
        for (const cell of cells) {
            const instructions = this._drawCell(cell, renderScreenDepth)
            if (instructions) {
                ret.push(instructions)
            }
        }
        process.stdout.write(ret.join(''))
    }

    private _drawCell(cell: Cell, renderScreenDepth: number = 0) {
        const ret: string[] = []
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }
        if (!this.hasVisualUi) {
            // Commented just to reduce noise. Maybe it shoud be brought back
            // console.log(`Updating cell [${cell.rowIndex}][${cell.colIndex}] to have sprites: [${cell.getSprites().map(sprite => sprite.getName())}]`)
            throw new Error(`BUG: Should not get to this point`)
        }

        // TODO: Also eventually filter out the Background ones when Background is an OR Tile
        const spritesForDebugging = cell.getSprites().filter(s => !s.isBackground())

        let { isOnScreen, cellStartX, cellStartY } = this.cellPosToXY(cell)

        if (!isOnScreen) {
            return // no need to render because it is off-screen
        }
        const pixels: IColor[][] = this.getPixelsForCell(cell)
        pixels.forEach((spriteRow, spriteRowIndex) => {
            spriteRow.forEach((spriteColor: IColor, spriteColIndex) => {
                if (!this.gameData) {
                    throw new Error(`BUG: gameData was not set yet`)
                }
                const x = cellStartX + spriteColIndex
                const y = cellStartY + spriteRowIndex

                let color: Optional<IColor>

                if (spriteColor) {
                    if (!spriteColor.isTransparent()) {
                        color = spriteColor
                    }
                    else if (this.gameData.metadata.background_color) {
                        color = this.gameData.metadata.background_color
                    } else {
                        color = null
                    }
                }

                if (color) {
                    const { r, g, b } = color.toRgb()
                    const hex = color.toHex()
                    let fgHex = null

                    let chars = ' '

                    if (this.inspectorRow === cell.rowIndex && this.inspectorCol === cell.colIndex) {
                        chars = '░'
                    }

                    // Print a debug number which contains the number of sprites in this cell
                    // Change the foreground color to be black if the color is light
                    if (process.env['NODE_ENV'] === 'development') {
                        if (r > 192 && g > 192 && b > 192) {
                            fgHex = '#000000'
                        } else {
                            fgHex = '#ffffff'
                        }
                        const sprite = spritesForDebugging[spriteRowIndex]
                        if (sprite) {
                            let spriteName = sprite.getName()
                            let wantsToMove

                            switch (cell.getWantsToMove(sprite)) {
                                case RULE_DIRECTION.STATIONARY:
                                    wantsToMove = ''
                                    break
                                case RULE_DIRECTION.UP:
                                    wantsToMove = '^'
                                    break
                                case RULE_DIRECTION.DOWN:
                                    wantsToMove = 'v'
                                    break
                                case RULE_DIRECTION.LEFT:
                                    wantsToMove = '<'
                                    break
                                case RULE_DIRECTION.RIGHT:
                                    wantsToMove = '>'
                                    break
                                case RULE_DIRECTION.ACTION:
                                    wantsToMove = 'X'
                                    break
                                default:
                                    throw new Error(`BUG: Invalid wantsToMove "${cell.getWantsToMove(sprite)}"`)
                            }
                            spriteName = `${wantsToMove}${spriteName}`
                            if (spriteName.length > 10) {
                                spriteName = `${spriteName.substring(0, this.SPRITE_WIDTH)}.${spriteName.substring(spriteName.length - this.SPRITE_WIDTH + 1)}`
                            }
                            const msg = `${spriteName.substring(spriteColIndex * 2, spriteColIndex * 2 + 2)}`
                            chars = msg.substring(0, 2)
                        }
                        if (spriteRowIndex === this.SPRITE_HEIGHT - 1 && spriteColIndex === this.SPRITE_WIDTH - 1) {
                            if (spritesForDebugging.length > this.SPRITE_WIDTH * 2 - 1) {
                                chars = `${spritesForDebugging.length}`
                            } else {
                                chars = ` ${spritesForDebugging.length}`
                            }
                        }
                    }


                    ret.push(this.setPixel(x, y, hex, fgHex, chars))

                }
            })
        })

        ret.push(getRestoreCursor())
        return ret.join('')
    }

    writeDebug(text: string, category: number) {
        this.debugCategoryMessages[category] = text

        if (!this.hasVisualUi) {
            // console.log(`Writing Debug text "${text}"`)
            return
        }
        if (!this.isDumpingScreen) {
            this.clearLineAndWriteText(0, 0, `[${this.debugCategoryMessages.join(' | ')}]`)
        }
    }

    a11yWrite(text: string) {
        if (this.hasVisualUi) {
            this.writeDebug(text, 0)
        } else {
            console.log(text)
        }
    }

    willAllLevelsFitOnScreen(gameData: GameData) {
        let maxWidth = 0
        let maxHeight = 0
        const {flickscreen, zoomscreen} = gameData.metadata
        if (flickscreen) {
            maxWidth = flickscreen.width
            maxHeight = flickscreen.height
        } else if (zoomscreen) {
            maxWidth = zoomscreen.width
            maxHeight = zoomscreen.height
        } else {
            // loop through all the levels and find the largest one
            for (const level of gameData.levels) {
                if (level.isMap()) {
                    maxWidth = Math.max(maxWidth, level.getWidth())
                    maxHeight = Math.max(maxHeight, level.getHeight())
                }
            }
        }
        // Check to see if it fits in the terminal
        const {spriteHeight, spriteWidth} = gameData.getSpriteSize()
        const {columns, rows} = getTerminalSize()
        const terminalWidth = Math.floor(columns / spriteWidth / this.PIXEL_WIDTH)
        const terminalHeight = Math.floor(rows / spriteHeight / this.PIXEL_HEIGHT)

        if (terminalWidth < maxWidth || terminalHeight < maxHeight) {
            return false
        } else {
            return true
        }
    }

    _drawPixel(x: number, y: number, fgHex: string, bgHex: Optional<string>, chars: string) {
        drawPixelChar(x, y, fgHex, bgHex, chars)
    }

    moveInspectorTo(cell: Cell) {
        if (!this.engine) {
            throw new Error(`BUG: engine has not been assigned yet`)
        }
        const {rowIndex: newRow, colIndex: newCol} = cell
        let canMove = false
        if (newCol >= this.windowOffsetColStart && newRow >= this.windowOffsetRowStart) {
            if (this.windowOffsetWidth && this.windowOffsetHeight) {
                if (newCol <= this.windowOffsetColStart + this.windowOffsetWidth && newRow <= this.windowOffsetRowStart + this.windowOffsetHeight) {
                    canMove = true
                }
            } else {
                canMove = true
            }
        }

        if (canMove) {
            let oldInspectorCell = null
            const currentLevel = this.engine.getCurrentLevelCells()
            if (currentLevel[this.inspectorRow] && currentLevel[this.inspectorRow][this.inspectorCol]) {
                oldInspectorCell = this.engine.getCurrentLevelCells()[this.inspectorRow][this.inspectorCol]
            }
            const newInspectorCell = cell
            // move
            this.inspectorCol = newCol
            this.inspectorRow = newRow
            // draw the old cell (to remove the graphic artfact)
            if (this.hasVisualUi && this.isLargeTerminal()) {
                const cells = [newInspectorCell]
                if (oldInspectorCell) {
                    cells.push(oldInspectorCell)
                }
                // draw the new and old cells
                this.drawCells(cells, false)
            }

            const spriteNames = cell.getSprites()
            .filter(s => !s.isBackground())
            .map(s => s.getName())
            const msg = `${spriteNames.join(', ')} (${cell.rowIndex}, ${cell.colIndex})`
            this.a11yWrite(msg)
        }
    }
    moveInspector(direction: RULE_DIRECTION) {
        if (!this.engine) {
            throw new Error(`BUG: engine has not been assigned yet`)
        }
        if (this.inspectorRow >= 0 && this.inspectorCol >= 0) {
            const cell = this.engine.getCurrentLevelCells()[this.inspectorRow][this.inspectorCol]
            const newCell = cell.getNeighbor(direction)
            if (newCell) {
                return this.moveInspectorTo(newCell)
            }
        }
    }

    protected checkIfCellCanBeDrawnOnScreen(cellStartX: number, cellStartY: number) {
        // Check if the cell can be completely drawn on the screen. If not, print ellipses
        const {columns, rows} = getTerminalSize()
        const cellIsTooWide = (cellStartX + this.SPRITE_WIDTH) * this.PIXEL_WIDTH >= columns
        const cellIsTooHigh = (cellStartY + this.SPRITE_HEIGHT) * this.PIXEL_HEIGHT >= rows

        if (cellIsTooWide || cellIsTooHigh) {
            // do not draw the cell
            return false
        }
        return true
    }

    protected getMaxSize() {
        return getTerminalSize()
    }
}


// TypeScript does not like that columns and rows might be null
export function getTerminalSize() {
    return {
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 25
    }
}

function getRestoreCursor() {
    const {columns, rows} = getTerminalSize()
    return [
        setFgColor('#ffffff'),
        setBgColor('#000000'),
        setMoveTo(columns, rows)
    ].join('')
}


export default new TerminalUI()

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