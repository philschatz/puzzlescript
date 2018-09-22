import { Cell } from '../engine'
import { IColor } from '../models/colors'
import { GameData } from '../models/game'
import { _flatten, Optional, RULE_DIRECTION } from '../util'
import BaseUI from './base'

interface ITableCell {
    td: HTMLTableCellElement,
    label: HTMLSpanElement,
    pixels: HTMLSpanElement[][]
}

class TableUI extends BaseUI {
    private readonly table: HTMLElement
    private tableCells: ITableCell[][]

    constructor(table: HTMLElement) {
        super()
        this.table = table
        this.tableCells = []
        table.classList.add('ps-table')
        this.markAcceptingInput(false)
    }
    public tick() {
        const ret = super.tick()
        this.markAcceptingInput(!super.hasAgainThatNeedsToRun())
        return ret
    }

    public press(dir: RULE_DIRECTION) {
        this.markAcceptingInput(false)
        super.press(dir)
    }

    public pressUndo() {
        this.markAcceptingInput(false)
        super.pressUndo()
    }

    public pressRestart() {
        this.markAcceptingInput(false)
        super.pressRestart()
    }

    public setLevel(levelNum: number) {
        // this.markAcceptingInput(false)
        super.setLevel(levelNum)
        this.clearScreen()

        if (!this.isCurrentLevelAMessage()) {
            const levelCells = this.getCurrentLevelCells()
            // Draw the level
            // Draw the empty table
            this.tableCells = []
            const gameData = this.getGameData()
            const { width, height } = gameData.metadata.flickscreen || gameData.metadata.zoomscreen || { width: levelCells[0].length, height: levelCells.length }
            for (let currentY = 0; currentY < height; currentY++) {
                const tr = document.createElement('tr')
                const tableRow = []
                for (let currentX = 0; currentX < width; currentX++) {
                    const td = document.createElement('td')
                    const tableCellPixels = []
                    td.classList.add('ps-cell')
                    td.setAttribute('tabindex', '0')

                    const cellLabel = document.createElement('span')
                    cellLabel.classList.add('ps-cell-label')
                    td.appendChild(cellLabel)

                    const sprite = document.createElement('div')
                    sprite.classList.add('ps-sprite-whole')
                    sprite.setAttribute('aria-hidden', 'true')

                    for (let row = 0; row < this.SPRITE_HEIGHT; row++) {
                        const spriteRow = document.createElement('div')
                        spriteRow.classList.add('ps-sprite-row')
                        const pixelRow = []

                        for (let col = 0; col < this.SPRITE_WIDTH; col++) {
                            const spritePixel = document.createElement('span')
                            spritePixel.classList.add('ps-sprite-pixel')
                            spriteRow.appendChild(spritePixel)
                            pixelRow.push(spritePixel)
                        }
                        sprite.appendChild(spriteRow)
                        tableCellPixels.push(pixelRow)
                    }
                    td.appendChild(sprite)
                    tr.appendChild(td)
                    tableRow.push({ td, label: cellLabel, pixels: tableCellPixels })
                }
                this.table.appendChild(tr)
                this.tableCells.push(tableRow)
            }

            for (const row of levelCells) {
                this.drawCells(row, false)
            }

            if (this.getGameData().metadata.runRulesOnLevelStart) {
                this.tick()
            }
        }
        this.markAcceptingInput(true)
    }

    public willAllLevelsFitOnScreen(gameData: GameData) {
        return true
    }

    public _drawPixel(x: number, y: number, fgHex: string, bgHex: Optional<string>, chars: string) {
        const rowIndex = Math.floor(y / this.SPRITE_HEIGHT)
        const colIndex = Math.floor(x / this.SPRITE_WIDTH)
        const pixelY = y % this.SPRITE_HEIGHT
        const pixelX = x % this.SPRITE_WIDTH

        const pixel = this.tableCells[rowIndex][colIndex].pixels[pixelY][pixelX]
        if (!pixel) {
            throw new Error(`BUG: Could not set pixel because table is too small`)
        }
        let style = `color: ${fgHex};`
        if (bgHex) {
            style += ` background-color: ${bgHex};`
        }
        pixel.setAttribute('style', style)
        // pixel.textContent = chars
    }

    public clearScreen() {
        super.clearScreen()
        // clear all the rows
        this.table.innerHTML = ''
        this.tableCells = []
    }

    public isCurrentLevelAMessage() {
        if (!this.engine) {
            throw new Error(`BUG: engine has not been set yet`)
        }
        return !this.engine.getCurrentLevel().isMap()
    }

    public getCurrentLevelMessage() {
        if (!this.engine) {
            throw new Error(`BUG: engine has not been set yet`)
        }
        const level = this.engine.getCurrentLevel()
        if (level.isMap()) {
            throw new Error(`BUG: current level is not a message level`)
        }
        return level.getMessage()
    }

    protected renderLevelScreen(levelRows: Cell[][], renderScreenDepth: number) {
        this.drawCells(_flatten(levelRows), false, renderScreenDepth)
    }

    protected setPixel(x: number, y: number, hex: string, fgHex: Optional<string>, chars: string) {
        const rowIndex = Math.floor(y / this.SPRITE_HEIGHT)
        const colIndex = Math.floor(x / this.SPRITE_WIDTH)
        const pixelY = y % this.SPRITE_HEIGHT
        const pixelX = x % this.SPRITE_WIDTH

        const pixel = this.tableCells[rowIndex][colIndex].pixels[pixelY][pixelX]
        if (!pixel) {
            throw new Error(`BUG: Could not set pixel because table is too small`)
        }
        if (!chars || chars.trim().length === 0) {
            chars = ''
        }

        if (!this.renderedPixels[y]) {
            this.renderedPixels[y] = []
        }
        const onScreenPixel = this.renderedPixels[y][x]
        if (!onScreenPixel || onScreenPixel.hex !== hex || onScreenPixel.chars !== chars) {
            this.renderedPixels[y][x] = { hex, chars }

            pixel.setAttribute('style', `background-color: ${hex}`)
            // pixel.textContent = chars
        }
    }

    protected drawCellsAfterRecentering(cells: Iterable<Cell>, renderScreenDepth: number) {
        for (const cell of cells) {
            this._drawCell(cell, renderScreenDepth)
        }
    }

    protected checkIfCellCanBeDrawnOnScreen(cellStartX: number, cellStartY: number) {
        return true
    }

    protected getMaxSize() {
        // just pick something big for now
        return {
            columns: 1000,
            rows: 1000
        }
    }

    private markAcceptingInput(flag: boolean) {
        if (flag) {
            this.table.setAttribute('data-ps-accepting-input', 'true')
        } else {
            this.table.setAttribute('data-ps-accepting-input', 'false')
        }
    }

    private _drawCell(cell: Cell, renderScreenDepth: number = 0) {
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

        // Inject the set of sprites for a11y
        const cellLabel = this.tableCells[cell.rowIndex - this.windowOffsetRowStart][cell.colIndex - this.windowOffsetColStart].label
        if (!cellLabel) {
            throw new Error(`BUG: Could not find cell in the table: [${cell.rowIndex} - ${this.windowOffsetRowStart}][${cell.colIndex} - ${this.windowOffsetColStart}]`)
        }
        if (spritesForDebugging.length > 0) {
            cellLabel.textContent = spritesForDebugging.map((s) => s.getName()).join(', ')
        } else {
            cellLabel.textContent = '(empty)'
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

                    let chars = ' '

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
                                const beforeEllipsis = spriteName.substring(0, this.SPRITE_WIDTH)
                                const afterEllipsis = spriteName.substring(spriteName.length - this.SPRITE_WIDTH + 1)
                                spriteName = `${beforeEllipsis}.${afterEllipsis}`
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

                    this.setPixel(x, y, hex, fgHex, chars)

                }
            })
        })
    }
}

export default TableUI
