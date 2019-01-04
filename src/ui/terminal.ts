import ansiEscapes from 'ansi-escapes'
import ansiStyles from 'ansi-styles'
import chalk from 'chalk'
import * as supportsColor from 'supports-color'

import { CollisionLayer } from '../models/collisionLayer'
import { IColor } from '../models/colors'
import { GameData } from '../models/game'
import { GameSprite } from '../models/tile'
import { LEVEL_TYPE, Soundish } from '../parser/astTypes'
import { playSound } from '../sound/sfxr'
import { _debounce, _flatten, Cellish, GameEngineHandler, Optional, RULE_DIRECTION } from '../util'
import BaseUI from './base'

// Determine if this
// 'truecolor' if this terminal supports 16m colors. 256 colors otherwise
const supports16mColors = process.env.COLORTERM === 'truecolor'

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
    const out: string[] = []
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

function someKeyPressed() {
    const p = new Promise((resolve) => {
        function handleKeyPress(key: string) {
            process.stdin.off('data', handleKeyPress)
            resolve(key)
        }
        process.stdin.on('data', handleKeyPress)
    })
    return p
}

class TerminalUI extends BaseUI implements GameEngineHandler {
    protected inspectorCol: number
    protected inspectorRow: number
    private resizeHandler: Optional<() => void>
    private debugCategoryMessages: string[]

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
        if (!this.resizeHandler && process.stdout) {
            this.resizeHandler = _debounce(() => {
                // the game may not be loaded yet
                if (this.gameData) {
                    this.clearScreen()
                    this.renderScreen(true)
                }
            })
            process.stdout.on('resize', this.resizeHandler)
        }
    }

    public destroy() {
        if (this.resizeHandler && process.stdout) {
            process.stdout.removeListener('resize', this.resizeHandler)
        }
        this.resizeHandler = null
        super.destroy()
    }

    public onPress() {
        // Don't need to do anything
    }
    public onWin() {
        // Don't need to do anything
    }
    public onPause() {
        // Don't need to do anything
    }
    public onResume() {
        // Don't need to do anything
    }
    public onGameChange() {
        // Don't need to do anything
    }
    public async onSound(sound: Soundish) {
        /*await*/ playSound(sound.soundCode) // tslint:disable-line:no-floating-promises
    }
    public onTick(changedCells: Set<Cellish>) {
        this.drawCells(changedCells, false)
    }
    public async onMessage(msg: string) {
        this.renderMessageScreen(msg)
        // Wait for "ACTION" key
        await someKeyPressed()
    }

    public getHasVisualUi() {
        return this.hasVisualUi
    }
    public setHasVisualUi(flag: boolean) {
        this.hasVisualUi = flag
    }
    public setSmallTerminal(yesNo: boolean) {
        if (yesNo) {
            this.PIXEL_WIDTH = 1 // number of characters in the terminal used to represent a pixel
            this.PIXEL_HEIGHT = .5
        } else {
            this.PIXEL_WIDTH = 2
            this.PIXEL_HEIGHT = 1
        }
    }

    public clearScreen() {
        if (!this.hasVisualUi) {
            console.log(`Clearing screen`) // tslint:disable-line:no-console
            return
        }

        // clear the cache of what is rendered
        super.clearScreen()

        writeFgColor('#ffffff')
        writeBgColor('#000000')
        // Output \n for each row that we have. That way any output from before is preserved
        // const rows = process.stdout.rows || 0
        // for (let i = 0; i < rows; i++) {
        //   console.log('\n')
        // }
        clearScreen()
    }

    public dumpScreen() {
        // Used by unit tests when one of the games fails to complete or completes prematurely
        this.isDumpingScreen = true
        this.renderScreen(false)
        this.isDumpingScreen = false

        process.stdout.write('\n')
        for (const row of this.renderedPixels) {
            if (!row) { continue }
            for (const pixel of row) {
                const { hex } = pixel
                let { chars } = pixel

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

    public canShowMessageAsCells() {
        const screenWidth = 34
        const screenHeight = 13

        const { columns, rows } = getTerminalSize()

        return this.hasVisualUi &&
            columns >= screenWidth * 5 * this.PIXEL_WIDTH &&
            rows >= screenHeight * 5 * this.PIXEL_HEIGHT
    }

    public renderMessageScreen(message: string) {
        const screenWidth = 34 // width of messages

        const { columns } = this.getMaxSize()
        if (this.canShowMessageAsCells()) {
            super.renderMessageScreen(message)
        } else {
            this.clearScreen()
            const messageScreen = this.createMessageTextScreen(message)
            for (const messageRow of messageScreen) {
                const line = chalk.bold.whiteBright(messageRow)
                // add some horizontal space if the terminal is wide
                let padding = ''
                if (columns > screenWidth) {
                    padding = ' '.repeat(Math.floor((columns - screenWidth) / 2))
                }
                console.log(`${padding}${line}`) // tslint:disable-line:no-console
            }
        }

    }

    public writeDebug(text: string, category: number) {
        this.debugCategoryMessages[category] = text

        if (!this.hasVisualUi) {
            // console.log(`Writing Debug text "${text}"`)
            return
        }
        if (!this.isDumpingScreen) {
            this.clearLineAndWriteText(0, 0, `[${this.debugCategoryMessages.join(' | ')}]`)
        }
    }

    public a11yWrite(text: string) {
        if (this.hasVisualUi) {
            this.writeDebug(text, 0)
        } else {
            console.log(text) // tslint:disable-line:no-console
        }
    }

    public willAllLevelsFitOnScreen(gameData: GameData) {
        let maxWidth = 0
        let maxHeight = 0
        const { flickscreen, zoomscreen } = gameData.metadata
        if (flickscreen) {
            maxWidth = flickscreen.width
            maxHeight = flickscreen.height
        } else if (zoomscreen) {
            maxWidth = zoomscreen.width
            maxHeight = zoomscreen.height
        } else {
            // loop through all the levels and find the largest one
            for (const level of gameData.levels) {
                if (level.type === LEVEL_TYPE.MAP) {
                    maxWidth = Math.max(maxWidth, level.cells[0].length)
                    maxHeight = Math.max(maxHeight, level.cells.length)
                }
            }
        }
        // Check to see if it fits in the terminal
        const { spriteHeight, spriteWidth } = gameData.getSpriteSize()
        const { columns, rows } = getTerminalSize()
        const terminalWidth = Math.floor(columns / spriteWidth / this.PIXEL_WIDTH)
        const terminalHeight = Math.floor(rows / spriteHeight / this.PIXEL_HEIGHT)

        if (terminalWidth < maxWidth || terminalHeight < maxHeight) {
            return false
        } else {
            return true
        }
    }

    public _drawPixel(x: number, y: number, fgHex: string, bgHex: Optional<string>, chars: string) {
        drawPixelChar(x, y, fgHex, bgHex, chars)
    }

    public moveInspectorTo(cell: Cellish) {
        const { rowIndex: newRow, colIndex: newCol } = cell
        let canMove = false
        if (newCol >= this.windowOffsetColStart && newRow >= this.windowOffsetRowStart) {
            if (this.windowOffsetWidth && this.windowOffsetHeight) {
                if (newCol <= this.windowOffsetColStart + this.windowOffsetWidth &&
                    newRow <= this.windowOffsetRowStart + this.windowOffsetHeight) {

                    canMove = true
                }
            } else {
                canMove = true
            }
        }

        if (canMove) {
            let oldInspectorCell = null
            const currentLevel = this.getCurrentLevelCells()
            if (currentLevel[this.inspectorRow] && currentLevel[this.inspectorRow][this.inspectorCol]) {
                oldInspectorCell = this.getCurrentLevelCells()[this.inspectorRow][this.inspectorCol]
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
            .filter((s) => !s.isBackground())
            .map((s) => s.getName())
            const msg = `${spriteNames.join(', ')} (${cell.rowIndex}, ${cell.colIndex})`
            this.a11yWrite(msg)
        }
    }
    public moveInspector(direction: RULE_DIRECTION) {
        if (this.inspectorRow >= 0 && this.inspectorCol >= 0) {
            let x = 0
            let y = 0
            switch (direction) {
                case RULE_DIRECTION.UP: y -= 1; break
                case RULE_DIRECTION.DOWN: y += 1; break
                case RULE_DIRECTION.LEFT: x -= 1; break
                case RULE_DIRECTION.RIGHT: x += 1; break
                default:
                    throw new Error(`BUG: Invalid direction`)
            }
            const cell = this.getCurrentLevelCells()[this.inspectorRow + y][this.inspectorCol + x]
            if (cell) {
                return this.moveInspectorTo(cell)
            }
        }
    }

    protected renderLevelScreen(levelRows: Cellish[][], renderScreenDepth: number) {
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }

        if (this.hasVisualUi) {
            this.drawCells(_flatten(levelRows), false, renderScreenDepth)

            // Just for debugging, print the game title (doing it here helps with Jest rendering correctly)
            this.writeDebug(`"${this.gameData.title}"`, 0)

        } else {

            // Print out the size of the screen and the count of each sprite on the screen
            const collisionLayerToSprites: Map<CollisionLayer, Map<GameSprite, Cellish[]>> = new Map()
            for (const cell of _flatten(levelRows)) {
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

            const levelHeight = this.windowOffsetHeight || levelRows.length
            const levelWidth = this.windowOffsetWidth || levelRows[0].length
            console.log(`Level size is ${levelHeight} high by ${levelWidth} wide`) // tslint:disable-line:no-console
            console.log(`-------------------------`) // tslint:disable-line:no-console

            /* Sprites are sorted in reverse order bc that is how they are rendered on screen */
            for (const collisionLayer of [...collisionLayerToSprites.keys()].sort((a, b) => b.id - a.id)) {
                const spriteToCells = collisionLayerToSprites.get(collisionLayer)
                if (!spriteToCells) {
                    throw new Error(`BUG: could not find mapping to sprite map`)
                }
                // tslint:disable-next-line:no-console
                console.log(`START: ${chalk.whiteBright(`${spriteToCells.size}`)} Sprites in same collision layer`)
                for (const sprite of spriteToCells.keys()) {
                    const cells = spriteToCells.get(sprite)

                    if (!cells) {
                        throw new Error(`BUG: could not find mapping to cells`)
                    }
                    const msg = `    ${sprite.getName()} ${cells.length}`
                    console.log(msg) // tslint:disable-line:no-console
                }
            }
        }
    }

    protected setPixel(x: number, y: number, hex: string, fgHex: Optional<string>, chars: string) {
        const ret: string[] = []
        const getColor = (cy: number, cx: number) => {
            if (this.renderedPixels[cy] && this.renderedPixels[cy][cx]) {
                return this.renderedPixels[cy][cx].hex
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
            this.renderedPixels[y][x] = { hex, chars }

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
                const pixelX = x * this.PIXEL_WIDTH
                const pixelY = Math.floor(y * this.PIXEL_HEIGHT) + 1/*titlebar*/
                ret.push(drawPixelChar(pixelX, pixelY, lowerColor, upperColor, '▄'))
            }
        }
        return ret.join('')
    }

    protected drawCellsAfterRecentering(cells: Iterable<Cellish>, renderScreenDepth: number) {
        const ret = []
        for (const cell of cells) {
            const instructions = this._drawCell(cell, renderScreenDepth)
            if (instructions) {
                ret.push(instructions)
            }
        }
        process.stdout.write(ret.join(''))
    }

    protected checkIfCellCanBeDrawnOnScreen(cellStartX: number, cellStartY: number) {
        // Check if the cell can be completely drawn on the screen. If not, print ellipses
        const { columns, rows } = getTerminalSize()
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
    private isLargeTerminal() {
        return this.PIXEL_HEIGHT === 1
    }
    private clearLineAndWriteText(x: number, y: number, text: string) {
        if (!this.hasVisualUi) {
            console.log(`Writing text at [${y}][${x}]: "${text}"`) // tslint:disable-line:no-console
            return
        }
        writeFgColor('#ffffff')
        writeBgColor('#000000')
        clearLineAndWriteTextAt(x, y, text)
        process.stdout.write(getRestoreCursor())
    }

    private _drawCell(cell: Cellish, renderScreenDepth: number = 0) {
        const ret: string[] = []
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }
        if (!this.hasVisualUi) {
            throw new Error(`BUG: Should not get to this point`)
        }

        // TODO: Also eventually filter out the Background ones when Background is an OR Tile
        const spritesForDebugging = cell.getSprites().filter((s) => !s.isBackground())

        const { isOnScreen, cellStartX, cellStartY } = this.cellPosToXY(cell)

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

                let color: Optional<IColor> = null

                if (spriteColor) {
                    if (!spriteColor.isTransparent()) {
                        color = spriteColor
                    } else if (this.gameData.metadata.backgroundColor) {
                        color = this.gameData.metadata.backgroundColor
                    } else {
                        color = null
                    }
                }

                if (color) {
                    const { r, g, b } = color.toRgb()
                    const hex = color.toHex()
                    let fgHex = null

                    // tslint:disable-line:prefer-conditional-expression
                    let chars = ' '

                    if (this.inspectorRow === cell.rowIndex && this.inspectorCol === cell.colIndex) {
                        chars = '░'
                    }

                    // Print a debug number which contains the number of sprites in this cell
                    // Change the foreground color to be black if the color is light
                    if (process.env.NODE_ENV === 'development') {
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
                                const beforeEllipses = spriteName.substring(0, this.SPRITE_WIDTH)
                                const afterEllipses = spriteName.substring(spriteName.length - this.SPRITE_WIDTH + 1)
                                spriteName = `${beforeEllipses}.${afterEllipses}`
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
                    // tslint:enable:prefer-conditional-expression

                    ret.push(this.setPixel(x, y, hex, fgHex, chars))

                }
            })
        })

        ret.push(getRestoreCursor())
        return ret.join('')
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
    const { columns, rows } = getTerminalSize()
    return [
        setFgColor('#ffffff'),
        setBgColor('#000000'),
        setMoveTo(columns, rows)
    ].join('')
}

export default new TerminalUI()
