import BitSet from 'bitset'
import { BaseForLines, IGameNode, IGameCode } from './game'
import { IColor, HexColor, TransparentColor } from './colors'
import { CollisionLayer } from './collisionLayer'
import { Cell } from '../engine'
import { SimpleTileWithModifier } from './rule';
import { RULE_DIRECTION, setIntersection, Optional, _flatten, _zip, setDifference } from '../util';
// BitSet does not export a default so import does not work in webpack-built file
const BitSet2 = require('bitset')

export interface IGameTile extends IGameNode {
    subscribeToCellChanges: (t: SimpleTileWithModifier) => void
    hasNegationTileWithModifier: () => boolean
    addCells: (sprite: GameSprite, cells: Cell[], wantsToMove: Optional<RULE_DIRECTION>) => void
    updateCells: (sprite: GameSprite, cells: Cell[], wantsToMove: RULE_DIRECTION) => void
    removeCells: (sprite: GameSprite, cells: Cell[]) => void
    _getDescendantTiles: () => IGameTile[]
    getSprites: () => GameSprite[]
    getSpritesForRuleAction: () => GameSprite[]
    isInvalid: () => Optional<string>
    hasCollisionLayer: () => boolean
    hasSingleCollisionLayer: () => boolean
    setCollisionLayer: (collisionLayer: CollisionLayer) => void
    getCollisionLayer: () => CollisionLayer
    hasCell(cell: Cell): boolean
    matchesCell: (cell: Cell) => boolean
    isOr: () => boolean
    getCellsThatMatch: () => Set<Cell>
    getSpritesThatMatch: (cell: Cell) => Set<GameSprite>
    getName: () => string
    equals: (t: IGameTile) => boolean
}

export abstract class GameSprite extends BaseForLines implements IGameTile {
    allSpritesBitSetIndex: number // set onde all the sprites have been determined
    private readonly name: string
    readonly _optionalLegendChar: Optional<string>
    private collisionLayer: Optional<CollisionLayer>
    private collisionLayerIndex: Optional<number>
    private readonly trickleCells: Set<Cell>
    private readonly trickleTiles: Set<IGameTile>
    private readonly trickleTilesWithModifier: Set<SimpleTileWithModifier>
    private bitSet: Optional<BitSet>

    constructor(source: IGameCode, name: string, optionalLegendChar: Optional<string>) {
        super(source)
        this.name = name
        this._optionalLegendChar = optionalLegendChar
        this.trickleCells = new Set()
        this.trickleTiles = new Set()
        this.trickleTilesWithModifier = new Set()
        this.allSpritesBitSetIndex = -1 // will be changed once we have all the sprites
    }
    isOr() {
        return false
    }
    equals(t: IGameTile): boolean {
        return this === t // sprites MUST be exact
    }
    abstract hasPixels(): boolean
    abstract getPixels(spriteHeight: number, spriteWidth: number): IColor[][]

    getName() {
        return this.name
    }
    isBackground() {
        return this.name.toLowerCase() === 'background'
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
        return !!this.collisionLayer
    }
    hasSingleCollisionLayer() {
        // always true. This is only ever false for OR tiles
        return this.hasCollisionLayer()
    }
    setCollisionLayer(collisionLayer: CollisionLayer) {
        this.collisionLayer = collisionLayer
    }
    setCollisionLayerAndIndex(collisionLayer: CollisionLayer, bitSetIndex: number) {
        this.collisionLayer = collisionLayer
        this.collisionLayerIndex = bitSetIndex
        this.bitSet = <BitSet> new BitSet2()
        this.bitSet.set(bitSetIndex)
    }
    getBitSet() {
        return this.bitSet
    }
    getBitSetIndex() {
        return this.collisionLayerIndex
    }
    getCollisionLayer() {
        if (!this.collisionLayer) {
            console.error(this.__source.getLineAndColumnMessage())
            throw new Error('ERROR: This sprite was not in a Collision Layer')
        }
        return this.collisionLayer
    }
    isInvalid() {
        if (!this.collisionLayer) {
            return 'This object does not have an entry in the COLLISIONLAYERS section.'
        }
        return null
    }
    clearCaches() {
        this.trickleCells.clear()
    }
    hasCell(cell: Cell): boolean {
        return this.trickleCells.has(cell)
    }
    matchesCell(cell: Cell): boolean {
        return cell.getSpritesAsSet().has(this)
    }
    getSpritesThatMatch(cell: Cell) {
        if (cell.getSpritesAsSet().has(this)) {
            return new Set([this])
        } else {
            return new Set()
        }
    }

    subscribeToCellChanges(t: SimpleTileWithModifier) {
        this.trickleTilesWithModifier.add(t)
    }
    subscribeToCellChangesTile(tile: IGameTile) {
        this.trickleTiles.add(tile)
    }
    addCell(cell: Cell, wantsToMove: Optional<RULE_DIRECTION>) {
        this.addCells(this, [cell], wantsToMove)
    }
    removeCell(cell: Cell) {
        this.removeCells(this, [cell])
    }
    updateCell(cell: Cell, wantsToMove: RULE_DIRECTION) {
        if (process.env['NODE_ENV'] === 'development') {
            // check that the cell is already in the sprite cell set
            if (!this.has(cell)) {
                throw new Error(`BUG: Expected cell to already be in the sprite set`)
            }
        }

        // propagate up
        for (const t of this.trickleTiles) {
            t.updateCells(this, [cell], wantsToMove)
        }
        for (const t of this.trickleTilesWithModifier) {
            t.updateCells(this, [cell], wantsToMove)
        }
    }
    addCells(sprite: GameSprite, cells: Cell[], wantsToMove: Optional<RULE_DIRECTION>) {
        for (const cell of cells) {
            if (this.trickleCells.has(cell)) {
                debugger
                throw new Error(`BUG: should not be trying to add a cell that has already been matched (right?)`)
            }
            this.trickleCells.add(cell)
        }
        // propagate up
        for (const t of this.trickleTiles) {
            t.addCells(this, cells, wantsToMove)
        }
        for (const t of this.trickleTilesWithModifier) {
            t.addCells(this, this, cells, wantsToMove)
        }
    }
    updateCells(sprite: GameSprite, cells: Cell[], wantsToMove: RULE_DIRECTION) {
        // propagate up
        for (const t of this.trickleTiles) {
            t.updateCells(this, cells, wantsToMove)
        }
        for (const t of this.trickleTilesWithModifier) {
            t.updateCells(this, cells, wantsToMove)
        }
    }
    removeCells(sprite: GameSprite, cells: Cell[]) {
        for (const cell of cells) {
            this.trickleCells.delete(cell)
        }
        // propagate up
        for (const t of this.trickleTiles) {
            t.removeCells(this, cells)
        }
        for (const t of this.trickleTilesWithModifier) {
            t.removeCells(this, this, cells)
        }
    }
    has(cell: Cell) {
        return this.trickleCells.has(cell)
    }
    hasNegationTileWithModifier() {
        for (const t of this.trickleTilesWithModifier) {
            if (t.isNo()) {
                return true
            }
        }
        for (const tile of this.trickleTiles) {
            if (tile.hasNegationTileWithModifier()) {
                return true
            }
        }
        return false
    }
    getCellsThatMatch() {
        return this.trickleCells
    }
}

export class GameSpriteSingleColor extends GameSprite {
    private readonly color: HexColor

    constructor(source: IGameCode, name: string, optionalLegendChar: string, colors: HexColor[]) {
        super(source, name, optionalLegendChar)
        this.color = colors[0] // Ignore if the user added multiple colors (like `transparent yellow`)
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
                rows[row].push(this.color)
            }
        }
        return rows
    }
}

export class GameSpritePixels extends GameSprite {
    private readonly colors: IColor[]
    private readonly pixels: IColor[][]

    constructor(source: IGameCode, name: string, optionalLegendChar: string, colors: HexColor[], pixels: ('.' | number)[][]) {
        super(source, name, optionalLegendChar)
        this.colors = colors
        this.pixels = pixels.map(row => {
            return row.map(col => {
                if (col === '.') {
                    return new TransparentColor(this.__source)
                } else {
                    return this.colors[col]
                }
            })
        }) // Pixel colors are 0-indexed.
    }
    isInvalid() {
        if (super.isInvalid()) {
            return super.isInvalid()
        }
        let isInvalid = null
        const colorLen = this.colors.length
        const rowLen = this.pixels[0].length
        this.pixels.forEach((row: any[]) => {
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
        return this.pixels.map(row => {
            return row.map(col => col)
        })
    }

}

export abstract class GameLegendTile extends BaseForLines implements IGameTile {
    private trickleCells: Set<Cell>
    private trickleTilesWithModifier: Set<SimpleTileWithModifier>
    private spritesCache: Optional<GameSprite[]>
    protected collisionLayer: Optional<CollisionLayer>
    readonly spriteNameOrLevelChar: string
    readonly tiles: IGameTile[]

    constructor(source: IGameCode, spriteNameOrLevelChar: string, tiles: IGameTile[]) {
        super(source)
        this.spriteNameOrLevelChar = spriteNameOrLevelChar
        this.tiles = tiles
        this.trickleCells = new Set()
        this.trickleTilesWithModifier = new Set()
    }
    equals(t: IGameTile) {
        if (this.isOr() !== t.isOr()) {
            return false
        }
        const difference = setDifference(new Set(this.getSprites()), t.getSprites())
        return difference.size === 0
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
    abstract matchesCell(cell: Cell): boolean
    abstract getSpritesThatMatch(cell: Cell): Set<GameSprite>
    abstract hasSingleCollisionLayer(): boolean

    getName() {
        return this.spriteNameOrLevelChar
    }
    getSpritesForRuleAction() {
        return this.getSprites()
    }
    _getDescendantTiles(): IGameTile[] {
        // recursively pull all the tiles out
        return this.tiles.concat(_flatten(this.tiles.map(tile => tile._getDescendantTiles())))
    }
    getSprites() {
        // Use a cache because all the collision layers have not been loaded in time
        if (!this.spritesCache) {
            // 2 levels of indirection should be safe
            // Sort by collisionLayer so that the most-important sprite is first
            this.spritesCache = _flatten(
                this.tiles.map(tile => {
                    return tile.getSprites()
                })
            ).sort((a, b) => {
                return a.getCollisionLayer().id - b.getCollisionLayer().id
            }).reverse()
        }
        return this.spritesCache
    }
    hasCollisionLayer() {
        return !!this.collisionLayer
    }
    setCollisionLayer(collisionLayer: CollisionLayer) {
        this.collisionLayer = collisionLayer
    }
    getCollisionLayer() {
        // OR tiles and AND tiles don't necessarily have a collisionLayer set so pull it from the sprite (this might not work)
        if (this.collisionLayer) {
            return this.collisionLayer
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

    subscribeToCellChanges(t: SimpleTileWithModifier) {
        this.trickleTilesWithModifier.add(t)
        // subscribe this to be notified of all Sprite changes of Cells
        for (const sprite of this.getSprites()) {
            sprite.subscribeToCellChangesTile(this)
        }
    }
    hasNegationTileWithModifier() {
        for (const t of this.trickleTilesWithModifier) {
            if (t.isNo()) {
                return true
            }
        }
        return false
    }
    addCells(sprite: GameSprite, cells: Cell[], wantsToMove: Optional<RULE_DIRECTION>) {
        for (const cell of cells) {
            if (!this.trickleCells.has(cell)) {
                if (this.matchesCell(cell)) {
                    this.trickleCells.add(cell)
                    for (const t of this.trickleTilesWithModifier) {
                        t.addCells(this, sprite, [cell], wantsToMove)
                    }
                }
            }
        }
    }
    updateCells(sprite: GameSprite, cells: Cell[], wantsToMove: Optional<RULE_DIRECTION>) {
        // verify that all the cells are in trickleCells
        if (process.env['NODE_ENV'] === 'development') {
            for (const cell of cells) {
                if (!this.trickleCells.has(cell)) {
                    throw new Error(`Cell was not already added before`)
                }
            }
        }
        for (const t of this.trickleTilesWithModifier) {
            t.updateCells(sprite, cells, wantsToMove)
        }
    }

    removeCells(sprite: GameSprite, cells: Cell[]) {
        for (const cell of cells) {
            if (this.matchesCell(cell)) {
                if (!this.trickleCells.has(cell)) {
                    this.addCells(sprite, [cell], null)
                } else {
                    // We need to propagate this is an OR tile
                    // because removing one of the OR tiles
                    // may (or may not) cause this cell to
                    // no longer match
                    this.updateCells(sprite, [cell], null)
                }
            } else {
                this.trickleCells.delete(cell)
                for (const t of this.trickleTilesWithModifier) {
                    t.removeCells(this, sprite, [cell])
                }
            }
        }
    }
    hasCell(cell: Cell) {
        return this.trickleCells.has(cell)
    }
}

export class GameLegendTileSimple extends GameLegendTile {
    constructor(source: IGameCode, spriteNameOrLevelChar: string, tile: GameSprite) {
        super(source, spriteNameOrLevelChar, [tile])
    }
    matchesCell(cell: Cell) {
        // Update code coverage (Maybe only count the number of times it was true?)
        if (process.env['NODE_ENV'] === 'development') {
            this.__incrementCoverage()
        }

        // Check that the cell contains all of the tiles (ANDED)
        // Since this is a Simple Tile it should only contain 1 tile so anding is the right way to go.
        for (const tile of this.tiles) {
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
        return !!this.collisionLayer
    }
}

export class GameLegendTileAnd extends GameLegendTile {
    matchesCell(cell: Cell) {
        // Update code coverage (Maybe only count the number of times it was true?)
        if (process.env['NODE_ENV'] === 'development') {
            this.__incrementCoverage()
        }

        // Check that the cell contains all of the tiles (AND)
        for (const tile of this.tiles) {
            if (!tile.matchesCell(cell)) {
                return false
            }
        }
        return true
    }

    getSpritesThatMatch(cell: Cell): Set<GameSprite> {
        // return setIntersection(new Set(this.getSprites()), cell.getSpritesAsSet())
        throw new Error(`BUG: This method should only be called for OR tiles`)
    }

    hasSingleCollisionLayer() {
        return !!this.collisionLayer
    }


}

export class GameLegendTileOr extends GameLegendTile {
    isOr() {
        return true
    }
    matchesCell(cell: Cell) {
        // Update code coverage (Maybe only count the number of times it was true?)
        if (process.env['NODE_ENV'] === 'development') {
            this.__incrementCoverage()
        }

        // Check that the cell contains any of the tiles (OR)
        for (const tile of this.tiles) {
            if (tile.matchesCell(cell)) {
                return true
            }
        }
        return false
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
