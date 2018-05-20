import { BaseForLines, IGameCode, IGameTile } from './game'
import { IColor, HexColor, TransparentColor } from './colors'
import { CollisionLayer, GameLegendTile } from '../parser/parser'
import { Cell } from '../engine'

export class GameSprite extends BaseForLines implements IGameTile {
    _name: string
    _optionalLegendChar?: string
    _collisionLayer: CollisionLayer

    constructor(source: IGameCode, name: string, optionalLegendChar?: string) {
        super(source)
        this._name = name
        this._optionalLegendChar = optionalLegendChar
    }
    getPixels(): IColor[][] {
        throw new Error('BUG: Subclasses should implement this')
    }
    _getName() {
        return this._name
    }
    _getDescendantTiles(): GameLegendTile[] {
        return []
    }
    getSprites() {
        // to match the signature of LegendTile
        return [this]
    }
    hasCollisionLayer() {
        return !!this._collisionLayer
    }
    setCollisionLayer(collisionLayer: CollisionLayer) {
        this._collisionLayer = collisionLayer
    }
    getCollisionLayerNum() {
        if (!this._collisionLayer) {
            console.error(this.__source.getLineAndColumnMessage())
            console.error('ERROR: This sprite was not in a Collision Layer')
        }
        return this._collisionLayer.__astId
    }
    isInvalid() {
        if (!this._collisionLayer) {
            return 'This object does not have an entry in the COLLISIONLAYERS section.'
        }
        return null
    }
    matchesCell(cell: Cell): any {
        return cell.getSpritesAsSet().has(this)
    }
}

export class GameSpriteSingleColor extends GameSprite {
    _color: HexColor

    constructor(source: IGameCode, name: string, optionalLegendChar: string, colors: HexColor[]) {
        super(source, name, optionalLegendChar)
        this._color = colors[0] // Ignore if the user added multiple colors (like `transparent yellow`)
    }
    getPixels() {
        // When there are no pixels then it means "color the whole thing in the same color"
        const rows: HexColor[][] = []
        for (let row = 0; row < 5; row++) {
            rows.push([])
            for (let col = 0; col < 5; col++) {
                rows[row].push(this._color)
            }
        }
        return rows
    }
}

export class GameSpritePixels extends GameSprite {
    _colors: IColor[]
    _pixels: IColor[][]

    constructor(source: IGameCode, name: string, optionalLegendChar: string, colors: HexColor[], pixels: ('.' | number)[][]) {
        super(source, name, optionalLegendChar)
        this._colors = colors
        this._pixels = pixels.map(row => {
            return row.map(col => {
                if (col === '.') {
                    return new TransparentColor(this.__source)
                } else {
                    return this._colors[col]
                }
            })
        }) // Pixel colors are 0-indexed.
    }
    isInvalid() {
        if (super.isInvalid()) {
            return super.isInvalid()
        }
        let isInvalid = null
        const colorLen = this._colors.length
        const rowLen = this._pixels[0].length
        this._pixels.forEach((row: any[]) => {
            if (row.length !== rowLen) {
                isInvalid = `Row lengths do not match. Expected ${rowLen} but got ${row.length}. Row: ${row}`
            }
            // Check that only '.' or a digit that is less than the number of colors is present
            row.forEach((pixel) => {
                if (pixel !== '.') {
                    if (pixel >= colorLen) {
                        isInvalid = `Pixel number is too high (${pixel}). There are only ${colorLen} colors defined`
                    }
                }
            })
        })
        return isInvalid
    }
    getSprites() {
        // to match the signature of LegendTile
        return [this]
    }
    getPixels() {
        // Make a copy because others may edit it
        return this._pixels.map(row => {
            return row.map(col => col)
        })
    }
}