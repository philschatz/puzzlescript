import BaseUI from "./base";
import { Cell } from "../engine";
import { Optional, RULE_DIRECTION, _flatten } from "../util";
import { IColor } from "../models/colors";
import { GameData } from "../models/game";

class TableUI extends BaseUI {
    private readonly table: HTMLElement

    constructor(table: HTMLElement) {
        super()
        this.table = table
        table.classList.add('ps-table')
    }

    setLevel(levelNum: number) {
        super.setLevel(levelNum)
        this.clearScreen()

        const levelCells = this.getCurrentLevelCells()
        // Draw the level
        // Draw the empty table
        for (let rowIndex = 0; rowIndex < levelCells.length; rowIndex++) {
            const tr = document.createElement('tr')
            for (let colIndex = 0; colIndex < levelCells[0].length; colIndex++) {
                const td = document.createElement('td')
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

                    for (let col = 0; col < this.SPRITE_WIDTH; col++) {
                        const spritePixel = document.createElement('span')
                        spritePixel.classList.add('ps-sprite-pixel')
                        spriteRow.appendChild(spritePixel)
                    }
                    sprite.appendChild(spriteRow)
                }
                td.appendChild(sprite)
                tr.appendChild(td)
            }
            this.table.appendChild(tr)
        }

        for (const row of levelCells) {
            this.drawCells(row, false)
        }

    }

    canShowMessageAsCells() {
        return true
    }

    protected renderLevelScreen(levelRows: Cell[][], renderScreenDepth: number) {
        this.drawCells(_flatten(levelRows), false, renderScreenDepth)
    }


    protected setPixel(x: number, y: number, hex: string, fgHex: Optional<string>, chars: string) {
        const rowIndex = Math.floor(y / this.SPRITE_HEIGHT)
        const colIndex = Math.floor(x / this.SPRITE_WIDTH)
        const pixelY = y % this.SPRITE_HEIGHT
        const pixelX = x % this.SPRITE_WIDTH

        const pixel = this.table.querySelector(`tr:nth-of-type(${rowIndex + 1}) td:nth-of-type(${colIndex + 1}) .ps-sprite-row:nth-of-type(${pixelY + 1}) .ps-sprite-pixel:nth-of-type(${pixelX + 1})`)
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
            this.renderedPixels[y][x] = {hex, chars}

            pixel.setAttribute('style', `background-color: ${hex}`)
            // pixel.textContent = chars
        }
    }

    protected drawCellsAfterRecentering(cells: Iterable<Cell>, renderScreenDepth: number) {
        for (const cell of cells) {
            this._drawCell(cell, renderScreenDepth)
        }
    }

    private _drawCell(cell: Cell, renderScreenDepth: number = 0) {
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

        // Inject the set of sprites for a11y
        const cellLabel = this.table.querySelector(`tr:nth-of-type(${cell.rowIndex + 1}) td.ps-cell:nth-of-type(${cell.colIndex + 1}) .ps-cell-label`)
        if (!cellLabel) {
            throw new Error(`BUG: Could not find cell in the table`)
        }
        if (spritesForDebugging.length > 0) {
            cellLabel.textContent = spritesForDebugging.map(s => s.getName()).join(', ')
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


                    this.setPixel(x, y, hex, fgHex, chars)

                }
            })
        })
    }

    willAllLevelsFitOnScreen(gameData: GameData) {
        return true
    }

    _drawPixel(x: number, y: number, fgHex: string, bgHex: Optional<string>, chars: string) {
        const rowIndex = Math.floor(y / this.SPRITE_HEIGHT)
        const colIndex = Math.floor(x / this.SPRITE_WIDTH)
        const pixelY = y % this.SPRITE_HEIGHT
        const pixelX = x % this.SPRITE_WIDTH

        const pixel = this.table.querySelector(`tr:nth-of-type(${rowIndex + 1}) td:nth-of-type(${colIndex + 1}) .ps-sprite-row:nth-of-type(${pixelY + 1}) .ps-sprite-pixel:nth-of-type(${pixelX + 1})`)
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

    clearScreen() {
        super.clearScreen()
        this.table.innerHTML = '' // clear all the rows
    }
}

export default TableUI