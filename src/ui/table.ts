import { IColor } from '../models/colors'
import { GameData } from '../models/game'
import { Soundish } from '../parser/astTypes'
import { playSound } from '../sound/sfxr'
import { _flatten, Cellish, EmptyGameEngineHandler, GameEngineHandler, GameEngineHandlerOptional, INPUT_BUTTON, Optional, RULE_DIRECTION, setIntersection } from '../util'
import BaseUI from './base'
import { GameSprite } from '../models/tile';

interface ITableCell {
    td: HTMLTableCellElement,
    label: HTMLSpanElement,
    pixels: HTMLSpanElement[][]
}

class TableUI extends BaseUI implements GameEngineHandler {
    private readonly table: HTMLElement
    private inputsProcessed: number
    private tableCells: ITableCell[][]
    private handler: EmptyGameEngineHandler
    private interactsWithPlayer: Set<GameSprite>

    constructor(table: HTMLElement, handler?: GameEngineHandlerOptional) {
        super()
        this.table = table
        this.tableCells = []
        this.inputsProcessed = 0
        this.interactsWithPlayer = new Set()
        table.classList.add('ps-table')
        this.markAcceptingInput(false)

        // To use this as a handler, the functions need to be bound to `this`
        this.onPress = this.onPress.bind(this)
        this.onLevelChange = this.onLevelChange.bind(this)

        this.handler = new EmptyGameEngineHandler(handler ? [handler] : [])
    }

    public onPause() {
        this.table.setAttribute('data-ps-state', 'paused')
        this.handler.onPause()
    }
    public onResume() {
        this.table.setAttribute('data-ps-state', 'running')
        this.handler.onResume()
    }
    public onGameChange() {
        const game = this.getGameData()
        const playerSprites = game.getPlayer().getSprites()
        const interactsWithPlayer = new Set<GameSprite>(playerSprites)

        // Add al all the winCondition sprites
        for (const win of game.winConditions) {
            for (const tile of win.a11yGetTiles()) {
                for (const sprite of tile.getSprites()) {
                    interactsWithPlayer.add(sprite)
                }
            }
        }

        // Add all the other sprites that interact with the player
        for (const rule of game.rules) {
            for (const sprites of rule.a11yGetConditionSprites()) {
                if (setIntersection(sprites, interactsWithPlayer).size > 0) {
                    for (const sprite of sprites) {
                        interactsWithPlayer.add(sprite)
                    }
                }
            }
        }

        this.interactsWithPlayer = interactsWithPlayer
    }

    public onPress(dir: INPUT_BUTTON) {
        this.markAcceptingInput(false)
        switch (dir) {
            case INPUT_BUTTON.UNDO:
            case INPUT_BUTTON.RESTART:
                this.renderScreen(false)
        }
        this.handler.onPress(dir)
    }

    public onLevelChange(levelNum: number, cells: Optional<Cellish[][]>, message: Optional<string>) {
        this.clearScreen()
        this.table.setAttribute('data-ps-current-level', `${levelNum}`)

        if (cells) {
            super.onLevelChange(levelNum, cells, message)
            // Draw the level
            // Draw the empty table
            this.tableCells = []
            const gameData = this.getGameData()
            const { width, height } = gameData.metadata.flickscreen || gameData.metadata.zoomscreen || { width: cells[0].length, height: cells.length }

            this.table.setAttribute('tabindex', '0')
            const tbody = document.createElement('tbody')
            for (let currentY = 0; currentY < height; currentY++) {
                const tr = document.createElement('tr')
                const tableRow = []
                for (let currentX = 0; currentX < width; currentX++) {
                    const td = document.createElement('td')
                    const tableCellPixels = []
                    td.classList.add('ps-cell')

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
                tbody.appendChild(tr)
                this.tableCells.push(tableRow)
            }
            this.table.appendChild(tbody)

            for (const row of cells) {
                this.drawCells(row, false)
            }
        }
        this.markAcceptingInput(true)
        this.handler.onLevelChange(levelNum, cells, message)
    }

    public async onMessage(msg: string) {
        await this.handler.onMessage(msg)
    }
    public onWin() {
        this.handler.onWin()
    }
    public async onSound(sound: Soundish) {
        playSound(sound.soundCode) // tslint:disable-line:no-floating-promises
        await this.handler.onSound(sound)
    }
    public onTick(changedCells: Set<Cellish>, hasAgain: boolean) {
        this.drawCells(changedCells, false)
        this.markAcceptingInput(!hasAgain)
        this.handler.onTick(changedCells, hasAgain)
    }

    public setGameData(game: GameData) {
        super.setGameData(game)
        this.onGameChange()
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

    protected renderLevelScreen(levelRows: Cellish[][], renderScreenDepth: number) {
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

    protected drawCellsAfterRecentering(cells: Iterable<Cellish>, renderScreenDepth: number) {
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
            this.inputsProcessed++
            this.table.setAttribute('data-ps-accepting-input', 'false')
        }
        this.table.setAttribute('data-ps-last-input-processed', `${this.inputsProcessed}`)
    }

    private _drawCell(cell: Cellish, renderScreenDepth: number = 0) {
        if (!this.gameData) {
            throw new Error(`BUG: gameData was not set yet`)
        }
        if (!this.hasVisualUi) {
            throw new Error(`BUG: Should not get to this point`)
        }

        // Remove any sprites that do not impact (transitively) the player
        const spritesForDebugging = cell.getSprites().filter((s) => this.interactsWithPlayer.has(s))

        const { isOnScreen, cellStartX, cellStartY } = this.cellPosToXY(cell)

        if (!isOnScreen) {
            return // no need to render because it is off-screen
        }

        // Inject the set of sprites for a11y
        const tableRow = this.tableCells[cell.rowIndex - this.windowOffsetRowStart]
        if (!tableRow) {
            throw new Error(`BUG: Should not be trying to draw when there are no table cells`)
        }
        const tableCell = tableRow[cell.colIndex - this.windowOffsetColStart]
        if (!tableCell) {
            throw new Error(`BUG: Should not be trying to draw when there is not a matching table cell`)
        }
        const cellLabel = tableCell.label
        if (!cellLabel) {
            throw new Error(`BUG: Could not find cell in the table: [${cell.rowIndex} - ${this.windowOffsetRowStart}][${cell.colIndex} - ${this.windowOffsetColStart}]`)
        }

        if (spritesForDebugging.length > 0) {
            cellLabel.classList.remove('ps-cell-empty')
            const player = this.gameData.getPlayer()
            if (player.getSpritesThatMatch(cell).size > 0) {
                cellLabel.classList.add('ps-player')
            } else {
                cellLabel.classList.remove('ps-player')
            }
            cellLabel.textContent = spritesForDebugging.map((s) => s.getName()).join(', ')
        } else {
            cellLabel.classList.remove('ps-player')
            cellLabel.classList.add('ps-cell-empty')
            cellLabel.textContent = '(empty)' // (empty)
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
