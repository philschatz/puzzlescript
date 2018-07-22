import * as _ from 'lodash'
import * as ansiStyles from 'ansi-styles'
import * as ansiEscapes from 'ansi-escapes'
import * as supportsColor from 'supports-color'
import chalk from 'chalk';

import { GameEngine, Cell, GameData, Optional, RULE_DIRECTION } from './'
import { GameSprite } from './models/tile'
import { IColor } from './models/colors'
import { makeLetterCell } from './letters';

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


class CellColorCache {
    private readonly cache: Map<string, IColor[][]>

    constructor() {
        this.cache = new Map()
    }

    get(spritesToDrawSet: Set<GameSprite>, backgroundColor: Optional<IColor>, spriteHeight: number, spriteWidth: number) {
        const spritesToDraw = [...spritesToDrawSet]
        .sort((s1, s2) => s1.getCollisionLayer().id - s2.getCollisionLayer().id)
        .reverse()

        const key = spritesToDraw.map(s => s.getName()).join(' ')
        let ret = this.cache.get(key)
        if (!ret) {
            ret = collapseSpritesToPixels(spritesToDraw, backgroundColor, spriteHeight, spriteWidth)
            this.cache.set(key, ret)
        }
        return ret
    }

    clear() {
        this.cache.clear()
    }
}

// First Sprite one is on top.
// This caused a 2x speedup while rendering.
function collapseSpritesToPixels(spritesToDraw: GameSprite[], backgroundColor: Optional<IColor>, spriteHeight: number, spriteWidth: number) {
    if (spritesToDraw.length === 0) {
        // Just draw the background
        const sprite: IColor[][] = []
        for (let y = 0; y < spriteHeight; y++) {
            sprite[y] = sprite[y] || []
            for (let x = 0; x < spriteWidth; x++) {
                // If this is the last sprite and nothing was found then use the game background color
                if (backgroundColor) {
                    sprite[y][x] = backgroundColor
                }
            }
        }
        return sprite
    }
    // Record Code coverage
    if (process.env['NODE_ENV'] === 'development') {
        spritesToDraw[0].__incrementCoverage()
    }
    if (spritesToDraw.length === 1) {
        return spritesToDraw[0].getPixels(spriteHeight, spriteWidth)
    }
    const sprite = spritesToDraw[0].getPixels(spriteHeight, spriteWidth)
    spritesToDraw.slice(1).forEach((objectToDraw, spriteIndex) => {
        if (process.env['NODE_ENV'] === 'development') {
            objectToDraw.__incrementCoverage()
        }
        const pixels = objectToDraw.getPixels(spriteHeight, spriteWidth)
        for (let y = 0; y < spriteHeight; y++) {
            sprite[y] = sprite[y] || []
            for (let x = 0; x < spriteWidth; x++) {
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

class TerminalUI {
    private readonly cellColorCache: CellColorCache
    private gameData: Optional<GameData>
    private engine: Optional<GameEngine>
    private renderedPixels: {hex: string, chars: string}[][] // string is the hex code of the pixel
    private resizeHandler: Optional<() => void>
    private windowOffsetColStart: number
    private windowOffsetRowStart: number
    private windowOffsetWidth: Optional<number>
    private windowOffsetHeight: Optional<number>
    private isDumpingScreen: boolean
    private SPRITE_WIDTH: number
    private SPRITE_HEIGHT: number
    PIXEL_WIDTH: number // number of characters in the terminal used to represent a pixel
    PIXEL_HEIGHT: number
    private inspectorCol: number
    private inspectorRow: number
    private debugCategoryMessages: string[]

    constructor() {
        this.cellColorCache = new CellColorCache()
        this.resizeHandler = null
        this.renderedPixels = []
        this.windowOffsetColStart = 0
        this.windowOffsetRowStart = 0
        this.isDumpingScreen = false
        this.setSmallTerminal(false) // use really big (but cleaner) characters
        // defaults that get overridden later
        this.PIXEL_HEIGHT = 1
        this.PIXEL_WIDTH = 2
        this.SPRITE_HEIGHT = 5
        this.SPRITE_WIDTH = 5

        // This is the "inspector" cursor that allows a11y
        this.inspectorCol = 0
        this.inspectorRow = 0

        this.debugCategoryMessages = []
    }
    setGame(engine: GameEngine) {
        this.engine = engine
        this.gameData = engine.getGameData()
        this.cellColorCache.clear()
        this.renderedPixels = []

        // reset flickscreen and zoomscreen settings
        this.windowOffsetColStart = 0
        this.windowOffsetRowStart = 0

        this.windowOffsetWidth = null
        this.windowOffsetHeight = null
        if (this.gameData.metadata.flickscreen) {
            const { width, height } = this.gameData.metadata.flickscreen
            this.windowOffsetWidth = width
            this.windowOffsetHeight = height
        } else if (this.gameData.metadata.zoomscreen) {
            const { width, height } = this.gameData.metadata.zoomscreen
            this.windowOffsetWidth = width
            this.windowOffsetHeight = height
        }

        // Set the sprite width/height based on the 1st sprite (default is 5x5)
        // TODO: Loop until we find an actual sprite, not a single-color sprite
        const {spriteHeight, spriteWidth} = this.getSpriteSize(this.gameData)
        this.SPRITE_HEIGHT = spriteHeight
        this.SPRITE_WIDTH = spriteWidth

        this.inspectorCol = 0
        this.inspectorRow = 0
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
    private getSpriteSize(gameData: GameData) {
        const firstSpriteWithPixels = gameData.objects.filter(sprite => sprite.hasPixels())[0]
        if (firstSpriteWithPixels) {
            const firstSpritePixels = firstSpriteWithPixels.getPixels(1, 1) // We don't care about these args
            return {
                spriteHeight: firstSpritePixels.length,
                spriteWidth: firstSpritePixels[0].length
            }
        } else {
            // All the sprites are just a single color, so set the size to be 5x5
            return {
                spriteHeight: 1,
                spriteWidth: 1
            }
        }
    }
    debugRenderScreen() {
        if (this.engine) {
            this.renderScreen(true)
        }
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
    private createMessageTextScreen(messageStr: string) {
        const titleImage = [
            "                                  ",
            "                                  ",
            "                                  ",
            "                                  ",
            "                                  ",
            "                                  ",
            "                                  ",
            "                                  ",
            "                                  ",
            "                                  ",
            "          X to continue           ",
            "                                  ",
            "                                  "
        ]

        function wordwrap(str: string, width: number) {
            width = width || 75;
            var cut = true;
            if (!str) { return str; }
            var regex = '.{1,' +width+ '}(\\s|$)' + (cut ? '|.{' +width+ '}|.+$' : '|\\S+?(\\s|$)');
            const ret = str.match( RegExp(regex, 'g') );
            if (ret) {
                return ret
            }
            throw new Error(`BUG: Match did not work`)
        }

        var emptyLineStr = titleImage[9];
        var xToContinueStr = titleImage[10];

        titleImage[10]=emptyLineStr;

        var width = titleImage[0].length;

        const splitMessage = wordwrap(messageStr, titleImage[0].length)


        var offset = 5 - ((splitMessage.length / 2) | 0);
        if (offset < 0){
            offset = 0;
        }

        var count = Math.min(splitMessage.length, 12);
        for (var i = 0; i < count; i++) {
            var m = splitMessage[i];
            var row = offset+i;
            var messageLength=m.length;
            var lmargin = ((width-messageLength)/2)|0;
            // var rmargin = width-messageLength-lmargin;
            var rowtext = titleImage[row];
            titleImage[row]=rowtext.slice(0,lmargin)+m+rowtext.slice(lmargin+m.length);
        }

        var endPos = 10;
        if (count>=10) {
            if (count<12){
                endPos = count + 1;
            } else {
                endPos = 12;
            }
            }
        // if (quittingMessageScreen) {
        //     titleImage[endPos]=emptyLineStr;
        // } else {
            titleImage[endPos]=xToContinueStr;
        // }

        return titleImage
    }
    private createMessageCells(messageStr: string) {
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }
        if (!this.engine) {
            throw new Error(`BUG: gameEngine was not set yet`)
        }

        const titleImage = this.createMessageTextScreen(messageStr)

        // Now, convert the string array into cells
        const cells: Cell[][] = []
        const level = this.engine.getCurrentLevel()
        const topCollisionLayer = this.gameData.collisionLayers[this.gameData.collisionLayers.length - 1] // so the sprite appears above the background
        for (let rowIndex = 0; rowIndex < titleImage.length; rowIndex++) {
            const row = titleImage[rowIndex]
            const cellsRow: Cell[] = []
            cells.push(cellsRow)
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const char = row[colIndex]

                const letterCell = makeLetterCell(level.__source, topCollisionLayer, char, rowIndex, colIndex)
                cellsRow.push(letterCell)
            }
        }
        return cells
    }
    renderMessageScreen(message: string) {
        const screenWidth = 34
        const screenHeight = 13

        const {columns, rows} = getTerminalSize()
        if (supportsColor.stdout && columns >= screenWidth * 5 * this.PIXEL_WIDTH && rows >= screenHeight * 5 * this.PIXEL_HEIGHT) {
            // re-center the screen so we can show the message
            // remember these values so we can restore them right after rendering the message
            const {windowOffsetColStart, windowOffsetRowStart, windowOffsetHeight, windowOffsetWidth} = this
            this.windowOffsetColStart = 0
            this.windowOffsetRowStart = 0
            this.windowOffsetHeight = screenHeight
            this.windowOffsetWidth = screenWidth
            this.clearScreen()

            const cells = this.createMessageCells(message)
            this.drawCells(_.flatten(cells), false)

            this.windowOffsetColStart = windowOffsetColStart
            this.windowOffsetRowStart = windowOffsetRowStart
            this.windowOffsetHeight = windowOffsetHeight
            this.windowOffsetWidth = windowOffsetWidth

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
                console.log(`${padding}${line}`)
            }
        }
    }
    renderScreen(clearCaches: boolean, renderScreenDepth: number = 0) {
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }
        if (!this.engine) {
            throw new Error(`BUG: gameEngine was not set yet`)
        }

        const level = this.engine.getCurrentLevel()
        if (!level.isMap()) {
            this.renderMessageScreen(level.getMessage())
            return
        }

        // Perform this AFTER the renderMessageScreen so that messages are always rendered (but puzzle levels are not)
        if (!supportsColor.stdout) {
            console.log('Playing a game in the console requires color support. Unfortunately, color is not supported so not rendering (for now). We could just do an ASCII dump or something, using  ░▒▓█ to denote shades of cells')
            return
        }

        // Otherwise, the level is a Map so render the cells
        const levelRows = this.engine.getCurrentLevelCells()

        if (clearCaches) {
            this.cellColorCache.clear()
            this.renderedPixels = []
        }

        // Handle resize events by redrawing the game. Ooh, we do not have Cells at this point.
        // TODO Run renderScreen on cells from the engine rather than cells from the Level data
        if (!this.resizeHandler) {
            this.resizeHandler = _.debounce(() => {
                this.clearScreen()
                this.renderScreen(true)
            })
            process.stdout.on('resize', this.resizeHandler)
        }

        this.drawCells(_.flatten(levelRows), false, renderScreenDepth)

        // Just for debugging, print the game title (doing it here helps with Jest rendering correctly)
        this.writeDebug(`"${this.gameData.title}"`, 0)
    }

    private cellPosToXY(cell: Cell) {
        const { colIndex, rowIndex } = cell
        let isOnScreen = true // can be set to false for many reasons
        let cellStartX = -1
        let cellStartY = -1
        if (this.windowOffsetHeight && this.windowOffsetWidth) {
            if (this.windowOffsetColStart > colIndex ||
                this.windowOffsetRowStart > rowIndex ||
                this.windowOffsetColStart + this.windowOffsetWidth <= colIndex ||
                this.windowOffsetRowStart + this.windowOffsetHeight <= rowIndex) {

                // cell is off-screen
                isOnScreen = false
            }
        }
        cellStartX = (colIndex - this.windowOffsetColStart) * this.SPRITE_WIDTH
        cellStartY = (rowIndex - this.windowOffsetRowStart) * this.SPRITE_HEIGHT /*pixels*/

        // Check if the cell can be completely drawn on the screen. If not, print ellipses
        const {columns, rows} = getTerminalSize()
        const cellIsTooWide = (cellStartX + this.SPRITE_WIDTH) * this.PIXEL_WIDTH >= columns
        const cellIsTooHigh = (cellStartY + this.SPRITE_HEIGHT) * this.PIXEL_HEIGHT >= rows
        if (cellIsTooWide || cellIsTooHigh) {
            // do not draw the cell
            isOnScreen = false
        }

        if (cellStartX < 0 || cellStartY < 0) {
            isOnScreen = false
        }
        return { isOnScreen, cellStartX, cellStartY }
    }

    private setPixel(x: number, y: number, hex: string, fgHex: Optional<string>, chars: string) {
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


    // Returns true if the window was moved (so we can re-render the screen)
    private recenterPlayerIfNeeded(playerCell: Cell, isOnScreen: boolean) {
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }
        if (!this.engine) {
            throw new Error(`BUG: gameEngine was not set yet`)
        }
        let boundingBoxLeft
        let boundingBoxTop
        let boundingBoxWidth
        let boundingBoxHeight

        const windowLeft = this.windowOffsetColStart
        const windowTop = this.windowOffsetRowStart
        let windowWidth
        let windowHeight

        const flickScreen = this.gameData.metadata.flickscreen
        const zoomScreen = this.gameData.metadata.zoomscreen
        // these are number of sprites that can fit on the terminal
        const {columns, rows} = getTerminalSize()
        const terminalWidth = Math.floor(columns / this.SPRITE_WIDTH / this.PIXEL_WIDTH)
        const terminalHeight = Math.floor(rows / this.SPRITE_HEIGHT / this.PIXEL_HEIGHT)

        if (flickScreen) {
            boundingBoxTop = playerCell.rowIndex - (playerCell.rowIndex % flickScreen.height)
            boundingBoxLeft = playerCell.colIndex - (playerCell.colIndex % flickScreen.width)
            boundingBoxHeight = flickScreen.height
            boundingBoxWidth = flickScreen.width
        } else {
            boundingBoxLeft = 0
            boundingBoxTop = 0
            boundingBoxHeight = this.engine.getCurrentLevelCells().length
            boundingBoxWidth = this.engine.getCurrentLevelCells()[0].length
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
                this.windowOffsetColStart = boundingBoxLeft
                this.windowOffsetRowStart = boundingBoxTop
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

                    if (newWindowLeft !== this.windowOffsetColStart) {
                        this.windowOffsetColStart = newWindowLeft
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
                    // Use Math.abs() because an even number of cells visible (e.g. 4) will cause the screen to clicker back and forth
                    if (newWindowTop !== this.windowOffsetRowStart) {
                        this.windowOffsetRowStart = newWindowTop
                        didADirectionChange = true
                    }
                }
            }

            if (!didADirectionChange) {
                // cell is within the middle of the window.
                // just ensure that the player is on the screen
                if (isOnScreen) {
                } else {
                    this.windowOffsetColStart = boundingBoxLeft
                    this.windowOffsetRowStart = boundingBoxTop
                    return true
                }

            }
            return didADirectionChange
        }

        return false
    }

    drawCells(cells: Iterable<Cell>, dontRestoreCursor: boolean, renderScreenDepth: number = 0) {
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }
        if (!this.engine) {
            throw new Error(`BUG: gameEngine was not set yet`)
        }
        const ret: string[] = []

        // Sort of HACKy... If the player is not visible on the screen then we need to
        // move the screen so that they are visible.
        const playerTile = this.gameData.getPlayer()
        if (playerTile.getCellsThatMatch().size === 1) {
            // if the screen can only show an even number of cells (eg 4) then this will oscillate indefinitely
            // So we limit the recursion to just a couple of recursions
            if (renderScreenDepth <= 1) {
                const playerCell = [...playerTile.getCellsThatMatch()][0]
                const { isOnScreen } = this.cellPosToXY(playerCell)
                if (this.recenterPlayerIfNeeded(playerCell, isOnScreen)) {
                    // if we moved the screen then re-render the whole screen
                    cells = _.flatten(this.engine.getCurrentLevelCells())
                }
            }
            // otherwise, keep rendering cells like normal
        }

        for (const cell of cells) {
            const instructions = this._drawCell(cell, dontRestoreCursor, renderScreenDepth)
            if (instructions) {
                ret.push(instructions)
            }
        }
        process.stdout.write(ret.join(''))
    }
    private _drawCell(cell: Cell, dontRestoreCursor: boolean, renderScreenDepth: number = 0) {
        const ret: string[] = []
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }
        if (!supportsColor.stdout) {
            // Commented just to reduce noise. Maybe it shoud be brought back
            // console.log(`Updating cell [${cell.rowIndex}][${cell.colIndex}] to have sprites: [${cell.getSprites().map(sprite => sprite.getName())}]`)
            return // don't output anything
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

        if (!dontRestoreCursor) {
            ret.push(getRestoreCursor())
        }
        return ret.join('')
    }

    private getPixelsForCell(cell: Cell) {
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }
        const spritesToDrawSet = cell.getSpritesAsSet() // Not sure why, but entanglement renders properly when reversed

        // If there is a magic background object then rely on it last
        let magicBackgroundSprite = this.gameData.getMagicBackgroundSprite()
        if (magicBackgroundSprite) {
            spritesToDrawSet.add(magicBackgroundSprite)
        }

        const pixels = this.cellColorCache.get(spritesToDrawSet, this.gameData.metadata.background_color, this.SPRITE_HEIGHT, this.SPRITE_WIDTH)
        return pixels
    }

    clearScreen() {
        if (!supportsColor.stdout) {
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

    writeDebug(text: string, category: number) {
        this.debugCategoryMessages[category] = text

        if (!supportsColor.stdout) {
            // console.log(`Writing Debug text "${text}"`)
            return
        }
        if (!this.isDumpingScreen) {
            writeFgColor('#ffffff')
            writeBgColor('#000000')
            clearLineAndWriteText(0, 0, `[${this.debugCategoryMessages.join(' | ')}]`)
        }
    }

    a11yWrite(text: string) {
        if (supportsColor.stdout) {
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
        const {spriteHeight, spriteWidth} = this.getSpriteSize(gameData)
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
            if (supportsColor.stdout && this.isLargeTerminal()) {
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
}

// TypeScript does not like that columns and rows might be null
export function getTerminalSize() {
    return {
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 25
    }
}

function getRestoreCursor() {
    if (!supportsColor.stdout) {
        return ''
    }
    const {columns, rows} = getTerminalSize()
    return [
        setFgColor('#ffffff'),
        setBgColor('#000000'),
        setMoveTo(columns, rows)
    ].join('')
}

function clearLineAndWriteText(x: number, y: number, text: string) {
    if (!supportsColor.stdout) {
        console.log(`Writing text at [${y}][${x}]: "${text}"`)
        return
    }
    clearLineAndWriteTextAt(x, y, text)
    process.stdout.write(getRestoreCursor())
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