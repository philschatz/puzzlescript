import * as _ from 'lodash'
import chalk from 'chalk';

import { GameEngine, Cell, GameData, Optional } from '..'
import { GameSprite } from '../models/tile'
import { IColor } from '../models/colors'
import { makeLetterCell } from '../letters';
import Parser from '../parser/parser';

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

abstract class BaseUI {
    private readonly cellColorCache: CellColorCache
    protected gameData: Optional<GameData>
    protected engine: Optional<GameEngine>
    protected renderedPixels: {hex: string, chars: string}[][] // string is the hex code of the pixel
    protected windowOffsetColStart: number
    protected windowOffsetRowStart: number
    protected windowOffsetWidth: Optional<number>
    protected windowOffsetHeight: Optional<number>
    protected isDumpingScreen: boolean
    protected SPRITE_WIDTH: number
    protected SPRITE_HEIGHT: number
    protected hasVisualUi: boolean
    PIXEL_WIDTH: number // number of characters in the terminal used to represent a pixel
    PIXEL_HEIGHT: number

    constructor() {
        this.cellColorCache = new CellColorCache()
        this.renderedPixels = []
        this.windowOffsetColStart = 0
        this.windowOffsetRowStart = 0
        this.isDumpingScreen = false
        // defaults that get overridden later
        this.PIXEL_HEIGHT = 1
        this.PIXEL_WIDTH = 2
        this.SPRITE_HEIGHT = 5
        this.SPRITE_WIDTH = 5

        this.hasVisualUi = true
    }
    setGameEngine(engine: GameEngine) {
        this.engine = engine
        this.gameData = engine.getGameData()

        this.renderedPixels = []
        this.cellColorCache.clear()
        this.clearScreen()

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
        const {spriteHeight, spriteWidth} = this.gameData.getSpriteSize()
        this.SPRITE_HEIGHT = spriteHeight
        this.SPRITE_WIDTH = spriteWidth
    }

    setGame(gameData: string) {
        const {data, error} = Parser.parse(gameData)
        if (!data) {
            if (error) {
                throw error
            } else {
                throw new Error(`BUG: Could not parse gameData and did not find an error`)
            }
        }
        this.setGameEngine(new GameEngine(data))
    }
    getGameData() {
        if (!this.engine) {
            throw new Error(`BUG: Game has not been specified yet`)
        }
        return this.engine.getGameData()
    }

    pressUp() { if (this.engine) { this.engine.pressUp() } }
    pressDown() { if (this.engine) { this.engine.pressDown() } }
    pressLeft() { if (this.engine) { this.engine.pressLeft() } }
    pressRight() { if (this.engine) { this.engine.pressRight() } }
    pressAction() { if (this.engine) { this.engine.pressAction() } }
    pressUndo() { if (this.engine) { this.engine.pressUndo(); this.renderScreen(false) } }
    pressRestart() { if (this.engine) { this.engine.pressRestart(); this.renderScreen(false) } }
    setLevel(levelNum: number) { if (this.engine) { this.engine.setLevel(levelNum) }}
    getCurrentLevelCells() { if (this.engine) { return this.engine.getCurrentLevelCells() } else { throw new Error(`BUG: Game has not been specified yet`)}}
    tick() {
        if (!this.engine) {
            throw new Error(`BUG: Game has not been specified yet`)
        }
        const ret = this.engine.tick()
        this.drawCells(ret.changedCells, false)
        return ret
    }

    debugRenderScreen() {
        if (this.engine) {
            this.renderScreen(true)
        }
    }

    protected createMessageTextScreen(messageStr: string) {
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

    protected createMessageCells(messageStr: string) {
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

    protected abstract canShowMessageAsCells() : boolean

    renderMessageScreen(message: string) {
        const screenWidth = 34
        const screenHeight = 13

        const {columns} = this.getMaxSize()
        if (this.canShowMessageAsCells()) {
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

    protected abstract renderLevelScreen(levelRows: Cell[][], renderScreenDepth: number): void

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

        // Otherwise, the level is a Map so render the cells
        const levelRows = this.engine.getCurrentLevelCells()

        if (clearCaches) {
            this.cellColorCache.clear()
            this.renderedPixels = []
        }

        this.renderLevelScreen(levelRows, renderScreenDepth)
    }

    protected abstract setPixel(x: number, y: number, hex: string, fgHex: Optional<string>, chars: string): void

    protected abstract checkIfCellCanBeDrawnOnScreen(cellStartX: number, cellStartY: number): boolean

    protected cellPosToXY(cell: Cell) {
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

        if (isOnScreen) {
            isOnScreen = this.checkIfCellCanBeDrawnOnScreen(cellStartX, cellStartY)
        }

        if (cellStartX < 0 || cellStartY < 0) {
            isOnScreen = false
        }
        return { isOnScreen, cellStartX, cellStartY }
    }

    protected abstract getMaxSize() : {columns: number, rows: number}

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
        const {columns, rows} = this.getMaxSize()
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

        if (!this.hasVisualUi) {
            return // no need to re-say the whole level (a11y)
        }
        this.drawCellsAfterRecentering(cells, renderScreenDepth)
    }

    protected abstract drawCellsAfterRecentering(cells: Iterable<Cell>, renderScreenDepth: number) : void

    protected getPixelsForCell(cell: Cell) {
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

    protected clearScreen() {
        this.renderedPixels = []
    }

}

export default BaseUI