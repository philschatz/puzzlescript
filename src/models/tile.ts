import * as _ from 'lodash'
import BitSet from 'bitset'
import { BaseForLines, IGameCode, IGameNode } from './game'
import { IColor, HexColor, TransparentColor } from './colors'
import { CollisionLayer } from './collisionLayer'
import { Cell } from '../engine'
import { SimpleTileWithModifier } from './rule';
import { RULE_DIRECTION_ABSOLUTE, setIntersection } from '../util';

export interface IGameTile extends IGameNode {
    _getDescendantTiles: () => IGameTile[]
    getSprites: () => GameSprite[]
    getSpritesForRuleAction: () => GameSprite[]
    isInvalid: () => string
    hasCollisionLayer: () => boolean
    hasSingleCollisionLayer: () => boolean
    setCollisionLayer: (collisionLayer: CollisionLayer) => void
    getCollisionLayer: () => CollisionLayer
    matchesCell: (cell: Cell) => boolean
    isOr: () => boolean
    getCellsThatMatch: () => Set<Cell>
    getSpritesThatMatch: (cell: Cell) => Set<GameSprite>
    getName: () => string
    equals: (t: IGameTile) => boolean
}

export class GameSprite extends BaseForLines implements IGameTile {
    _name: string
    _optionalLegendChar?: string
    _collisionLayer: CollisionLayer
    _collisionLayerIndex: number
    _cellSet: Set<Cell>
    _tileWithModifierSet: Set<SimpleTileWithModifier>
    _bitSet: BitSet

    constructor(source: IGameCode, name: string, optionalLegendChar?: string) {
        super(source)
        this._name = name
        this._optionalLegendChar = optionalLegendChar
        this._cellSet = new Set()
        this._tileWithModifierSet = new Set()
    }
    isOr() {
        return false
    }
    equals(t: IGameTile): boolean {
        return this === t // sprites MUST be exact
    }
    hasPixels() {
        throw new Error('BUG: Subclasses should implement this')
    }
    getPixels(spriteHeight: number, spriteWidth: number): IColor[][] {
        throw new Error('BUG: Subclasses should implement this')
    }
    getName() {
        return this._name
    }
    isBackground() {
        return this._name.toLowerCase() === 'background'
    }
    _getDescendantTiles(): IGameTile[] {
        return []
    }
    getSprites() {
        // to match the signature of LegendTile
        return [this]
    }
    getSpritesForRuleAction() {
        return this.getSprites()
    }
    hasCollisionLayer() {
        return !!this._collisionLayer
    }
    hasSingleCollisionLayer() {
        // always true. This is only ever false for OR tiles
        return this.hasCollisionLayer()
    }
    setCollisionLayer(collisionLayer: CollisionLayer) {
        this._collisionLayer = collisionLayer
    }
    setCollisionLayerAndIndex(collisionLayer: CollisionLayer, bitSetIndex: number) {
        this._collisionLayer = collisionLayer
        this._collisionLayerIndex = bitSetIndex
        this._bitSet = new BitSet()
        this._bitSet.set(bitSetIndex)
    }
    getBitSet() {
        return this._bitSet
    }
    getBitSetIndex() {
        return this._collisionLayerIndex
    }
    getCollisionLayer() {
        if (!this._collisionLayer) {
            console.error(this.__source.getLineAndColumnMessage())
            throw new Error('ERROR: This sprite was not in a Collision Layer')
        }
        return this._collisionLayer
    }
    isInvalid() {
        if (!this._collisionLayer) {
            return 'This object does not have an entry in the COLLISIONLAYERS section.'
        }
        return null
    }
    clearCaches() {
        this._cellSet.clear()
    }
    matchesCell(cell: Cell): any {
        return cell.getSpritesAsSet().has(this)
    }
    getSpritesThatMatch(cell: Cell) {
        if (cell.getSpritesAsSet().has(this)) {
            return new Set([this])
        } else {
            return new Set()
        }
    }

    addTileWithModifier(t: SimpleTileWithModifier) {
        this._tileWithModifierSet.add(t)
    }
    addCell(cell: Cell, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        this.addCells([cell], wantsToMove)
    }
    removeCell(cell: Cell) {
        this.removeCells([cell])
    }
    updateCell(cell: Cell, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        if (process.env['NODE_ENV'] === 'development') {
            // check that the cell is already in the sprite cell set
            if (!this.has(cell)) {
                throw new Error(`BUG: Expected cell to already be in the sprite set`)
            }
        }

        // propagate up
        for (const t of this._tileWithModifierSet) {
            t.updateCells(this, [cell], wantsToMove)
        }
    }
    addCells(cells: Cell[], wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        for (const cell of cells) {
            this._cellSet.add(cell)
        }
        // propagate up
        for (const t of this._tileWithModifierSet) {
            t.addCells(this, cells, wantsToMove)
        }
    }
    removeCells(cells: Cell[]) {
        for (const cell of cells) {
            this._cellSet.delete(cell)
        }
        // propagate up
        for (const t of this._tileWithModifierSet) {
            t.removeCells(this, cells)
        }
    }
    has(cell: Cell) {
        return this._cellSet.has(cell)
    }
    hasNegationTile() {
        let hasNegationTile = false
        for (const t of this._tileWithModifierSet) {
            if (t.isNo()) {
                hasNegationTile = true
                break
            }
        }
        return hasNegationTile
    }
    getCellsThatMatch() {
        return this._cellSet
    }
}

export class GameSpriteSingleColor extends GameSprite {
    _color: HexColor

    constructor(source: IGameCode, name: string, optionalLegendChar: string, colors: HexColor[]) {
        super(source, name, optionalLegendChar)
        this._color = colors[0] // Ignore if the user added multiple colors (like `transparent yellow`)
    }
    hasPixels() {
        return false
    }
    getPixels(spriteHeight: number, spriteWidth: number) {
        // When there are no pixels then it means "color the whole thing in the same color"
        const rows: HexColor[][] = []
        for (let row = 0; row < spriteHeight; row++) {
            rows.push([])
            for (let col = 0; col < spriteWidth; col++) {
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
    hasPixels() {
        return true
    }
    getPixels(spriteHeight: number, spriteWidth: number) {
        // Make a copy because others may edit it
        return this._pixels.map(row => {
            return row.map(col => col)
        })
    }

}

export class GameLegendTile extends BaseForLines implements IGameTile {
    _spritesCache: GameSprite[]
    _collisionLayer: CollisionLayer
    _spriteNameOrLevelChar: string
    _tiles: IGameTile[]

    constructor(source: IGameCode, spriteNameOrLevelChar: string, tiles: IGameTile[]) {
        super(source)
        this._spriteNameOrLevelChar = spriteNameOrLevelChar
        this._tiles = tiles
    }
    equals(t: IGameTile) {
        if (this.isOr() !== t.isOr()) {
            return false
        }
        for (const [a, b] of _.zip(this.getSprites(), t.getSprites())) {
            if (a !== b) {
                return false
            }
        }
        return true
    }
    isOr() {
        return false
    }
    isInvalid() {
        if (!this.hasCollisionLayer()) {
            return 'Missing collision layer'
        }
        return null
    }
    matchesCell(cell: Cell) {
        if (!!true) {
            throw new Error('BUG: This is an abstract method')
        }
        return false
    }
    getSpritesThatMatch(cell: Cell) {
        if (!!true) {
            throw new Error('BUG: This is an abstract method')
        }
        return new Set()
    }
    hasSingleCollisionLayer() {
        if (!!true) {
            throw new Error('BUG: This is an abstract method')
        }
        return false
    }

    getName() {
        return this._spriteNameOrLevelChar
    }
    getSpritesForRuleAction() {
        return this.getSprites()
    }
    _getDescendantTiles(): IGameTile[] {
        // recursively pull all the tiles out
        return this._tiles.concat(_.flatten(this._tiles.map(tile => tile._getDescendantTiles())))
    }
    getSprites() {
        // Use a cache because all the collision layers have not been loaded in time
        if (!this._spritesCache) {
            // 2 levels of indirection should be safe
            // Sort by collisionLayer so that the most-important sprite is first
            this._spritesCache = _.flatten(
                this._tiles.map(tile => {
                    return tile.getSprites()
                })
            ).sort((a, b) => {
                return a.getCollisionLayer().id - b.getCollisionLayer().id
            }).reverse()
        }
        return this._spritesCache
    }
    hasCollisionLayer() {
        return !!this._collisionLayer
    }
    setCollisionLayer(collisionLayer: CollisionLayer) {
        this._collisionLayer = collisionLayer
    }
    getCollisionLayer() {
        // OR tiles and AND tiles don't necessarily have a collisionLayer set so pull it from the sprite (this might not work)
        if (this._collisionLayer) {
            return this._collisionLayer
        }
        // check that all sprites are in the same collisionlayer... if not, thene our understanding is flawed
        const firstCollisionLayer = this.getSprites()[0].getCollisionLayer()
        for (const sprite of this.getSprites()) {
            if (sprite.getCollisionLayer() !== firstCollisionLayer) {
                debugger
                throw new Error(`ooh, sprites in a tile have different collision layers... that's a problem\n${this.toString()}`)
            }
        }
        return firstCollisionLayer
    }

    getCellsThatMatch() {
        const matches = new Set()
        for (const sprite of this.getSprites()) {
            for (const cell of sprite.getCellsThatMatch()) {
                matches.add(cell)
            }
        }
        return matches
    }
}

export class GameLegendTileSimple extends GameLegendTile {
    constructor(source: IGameCode, spriteNameOrLevelChar: string, tile: GameSprite) {
        super(source, spriteNameOrLevelChar, [tile])
    }
    matchesCell(cell: Cell) {
        // Update code coverage (Maybe only count the number of times it was true?)
        if (process.env['NODE_ENV'] === 'development') {
            this.__coverageCount++
        }

        // Check that the cell contains all of the tiles (ANDED)
        // Since this is a Simple Tile it should only contain 1 tile so anding is the right way to go.
        for (const tile of this._tiles) {
            if (!tile.matchesCell(cell)) {
                return false
            }
        }
        return true
    }

    getSpritesThatMatch(cell: Cell) {
        return setIntersection(new Set(this.getSprites()), cell.getSpritesAsSet())
    }

    hasSingleCollisionLayer() {
        return !!this._collisionLayer
    }
}

export class GameLegendTileAnd extends GameLegendTile {
    matchesCell(cell: Cell) {
        // Update code coverage (Maybe only count the number of times it was true?)
        if (process.env['NODE_ENV'] === 'development') {
            this.__coverageCount++
        }

        // Check that the cell contains any of the tiles (AND)
        for (const tile of this._tiles) {
            if (!tile.matchesCell(cell)) {
                return false
            }
        }
        return true
    }

    getSpritesThatMatch(cell: Cell) {
        return setIntersection(new Set(this.getSprites()), cell.getSpritesAsSet())
    }

    hasSingleCollisionLayer() {
        return !!this._collisionLayer
    }


}

export class GameLegendTileOr extends GameLegendTile {
    isOr() {
        return true
    }
    matchesCell(cell: Cell) {
        // Update code coverage (Maybe only count the number of times it was true?)
        if (process.env['NODE_ENV'] === 'development') {
            this.__coverageCount++
        }

        // Check that the cell contains any of the tiles (OR)
        for (const tile of this._tiles) {
            if (tile.matchesCell(cell)) {
                return true
            }
        }
        return false
    }
    getSpritesForRuleAction() {
        // When assigning an OR, just use the 1st tile, not all of them
        return [this._tiles[0].getSprites()[0]]
        // return [this.getSprites()[0]] <-- this one is sorted by collisionLayer
    }

    getSpritesThatMatch(cell: Cell) {
        return setIntersection(new Set(this.getSprites()), cell.getSpritesAsSet())
    }

    hasSingleCollisionLayer() {
        const sprites = this.getSprites()
        for (const sprite of sprites) {
            if (sprite.getCollisionLayer() !== sprites[0].getCollisionLayer()) {
                return false
            }
        }
        return true
    }



}
