import BitSet from 'bitset'
import { Cell } from '../engine'
import { _flatten, Optional, RULE_DIRECTION, setDifference, setIntersection } from '../util'
import { BaseForLines, IGameCode } from './BaseForLines'
import { CollisionLayer } from './collisionLayer'
import { IColor, TransparentColor } from './colors'
import { IGameNode } from './game'
import { SimpleTileWithModifier } from './rule'
// BitSet does not export a default so import does not work in webpack-built file
const BitSet2 = require('bitset') // tslint:disable-line:no-var-requires

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
    matchesCell: (cell: Cell) => boolean
    isOr: () => boolean
    getCellsThatMatch: () => Set<Cell>
    getSpritesThatMatch: (cell: Cell) => Set<GameSprite>
    getName: () => string
    equals: (t: IGameTile) => boolean
    getCollisionLayers(): CollisionLayer[]
    hasCell(cell: Cell): boolean
}

export abstract class GameSprite extends BaseForLines implements IGameTile {
    public allSpritesBitSetIndex: number // set onde all the sprites have been determined
    public readonly _optionalLegendChar: Optional<string>
    private readonly name: string
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
    public isOr() {
        return false
    }
    public equals(t: IGameTile): boolean {
        return this === t // sprites MUST be exact
    }
    public abstract hasPixels(): boolean
    public abstract getPixels(spriteHeight: number, spriteWidth: number): IColor[][]

    public getName() {
        return this.name
    }
    public isBackground() {
        return this.name.toLowerCase() === 'background'
    }
    public _getDescendantTiles(): IGameTile[] {
        return []
    }
    public getSprites() {
        // to match the signature of LegendTile
        return [this]
    }
    public getSpritesForRuleAction() {
        return this.getSprites()
    }
    public hasCollisionLayer() {
        return !!this.collisionLayer
    }
    public hasSingleCollisionLayer() {
        // always true. This is only ever false for OR tiles
        return this.hasCollisionLayer()
    }
    public setCollisionLayer(collisionLayer: CollisionLayer) {
        this.collisionLayer = collisionLayer
    }
    public setCollisionLayerAndIndex(collisionLayer: CollisionLayer, bitSetIndex: number) {
        this.collisionLayer = collisionLayer
        this.collisionLayerIndex = bitSetIndex
        this.bitSet = new BitSet2() as BitSet
        this.bitSet.set(bitSetIndex)
    }
    public getBitSet() {
        return this.bitSet
    }
    public getBitSetIndex() {
        return this.collisionLayerIndex
    }
    public getCollisionLayer() {
        if (!this.collisionLayer) {
            throw new Error(`ERROR: This sprite was not in a Collision Layer\n${this.toString()}`)
        }
        return this.collisionLayer
    }
    public getCollisionLayers() {
        return [this.getCollisionLayer()]
    }
    public isInvalid() {
        if (!this.collisionLayer) {
            return 'This object does not have an entry in the COLLISIONLAYERS section.'
        }
        return null
    }
    public clearCaches() {
        this.trickleCells.clear()
    }
    public hasCell(cell: Cell): boolean {
        return this.trickleCells.has(cell)
    }
    public matchesCell(cell: Cell): boolean {
        return cell.getSpritesAsSet().has(this)
    }
    public getSpritesThatMatch(cell: Cell) {
        if (cell.getSpritesAsSet().has(this)) {
            return new Set([this])
        } else {
            return new Set()
        }
    }

    public subscribeToCellChanges(t: SimpleTileWithModifier) {
        this.trickleTilesWithModifier.add(t)
    }
    public subscribeToCellChangesTile(tile: IGameTile) {
        this.trickleTiles.add(tile)
    }
    public addCell(cell: Cell, wantsToMove: Optional<RULE_DIRECTION>) {
        this.addCells(this, [cell], wantsToMove)
    }
    public removeCell(cell: Cell) {
        this.removeCells(this, [cell])
    }
    public updateCell(cell: Cell, wantsToMove: RULE_DIRECTION) {
        if (process.env.NODE_ENV === 'development') {
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
    public addCells(sprite: GameSprite, cells: Cell[], wantsToMove: Optional<RULE_DIRECTION>) {
        for (const cell of cells) {
            if (this.trickleCells.has(cell)) {
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
    public updateCells(sprite: GameSprite, cells: Cell[], wantsToMove: RULE_DIRECTION) {
        // propagate up
        for (const t of this.trickleTiles) {
            t.updateCells(this, cells, wantsToMove)
        }
        for (const t of this.trickleTilesWithModifier) {
            t.updateCells(this, cells, wantsToMove)
        }
    }
    public removeCells(sprite: GameSprite, cells: Cell[]) {
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
    public has(cell: Cell) {
        return this.trickleCells.has(cell)
    }
    public hasNegationTileWithModifier() {
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
    public getCellsThatMatch() {
        return this.trickleCells
    }
}

export class GameSpriteSingleColor extends GameSprite {
    private readonly color: IColor

    constructor(source: IGameCode, name: string, optionalLegendChar: Optional<string>, colors: IColor[]) {
        super(source, name, optionalLegendChar)
        this.color = colors[0] // Ignore if the user added multiple colors (like `transparent yellow`)
    }
    public hasPixels() {
        return false
    }
    public getPixels(spriteHeight: number, spriteWidth: number) {
        // When there are no pixels then it means "color the whole thing in the same color"
        const rows: IColor[][] = []
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

    constructor(source: IGameCode, name: string, optionalLegendChar: Optional<string>, colors: IColor[], pixels: Array<Array<'.' | number>>) {
        super(source, name, optionalLegendChar)
        this.colors = colors
        this.pixels = pixels.map((row) => {
            return row.map((col) => {
                if (col === '.') {
                    return new TransparentColor(this.__source)
                } else {
                    return this.colors[col] || new TransparentColor(this.__source)
                }
            })
        }) // Pixel colors are 0-indexed.
    }
    public isInvalid() {
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
    public getSprites() {
        // to match the signature of LegendTile
        return [this]
    }
    public hasPixels() {
        return true
    }
    public getPixels(spriteHeight: number, spriteWidth: number) {
        // Make a copy because others may edit it
        return this.pixels.map((row) => {
            return row.map((col) => col)
        })
    }

}

export abstract class GameLegendTile extends BaseForLines implements IGameTile {
    public readonly spriteNameOrLevelChar: string
    public readonly tiles: IGameTile[]
    protected collisionLayer: Optional<CollisionLayer>
    private trickleCells: Set<Cell>
    private trickleTilesWithModifier: Set<SimpleTileWithModifier>
    private spritesCache: Optional<GameSprite[]>

    constructor(source: IGameCode, spriteNameOrLevelChar: string, tiles: IGameTile[]) {
        super(source)
        this.spriteNameOrLevelChar = spriteNameOrLevelChar
        this.tiles = tiles
        this.trickleCells = new Set()
        this.trickleTilesWithModifier = new Set()
    }
    public equals(t: IGameTile) {
        if (this.isOr() !== t.isOr()) {
            return false
        }
        const difference = setDifference(new Set(this.getSprites()), t.getSprites())
        return difference.size === 0
    }
    public isOr() {
        return false
    }
    public isInvalid() {
        if (!this.hasCollisionLayer()) {
            return 'Missing collision layer'
        }
        return null
    }
    public abstract matchesCell(cell: Cell): boolean
    public abstract getSpritesThatMatch(cell: Cell): Set<GameSprite>
    public abstract hasSingleCollisionLayer(): boolean

    public getName() {
        return this.spriteNameOrLevelChar
    }
    public getSpritesForRuleAction() {
        return this.getSprites()
    }
    public _getDescendantTiles(): IGameTile[] {
        // recursively pull all the tiles out
        return this.tiles.concat(_flatten(this.tiles.map((tile) => tile._getDescendantTiles())))
    }
    public getSprites() {
        // Use a cache because all the collision layers have not been loaded in time
        if (!this.spritesCache) {
            // 2 levels of indirection should be safe
            // Sort by collisionLayer so that the most-important sprite is first
            this.spritesCache = _flatten(
                this.tiles.map((tile) => {
                    return tile.getSprites()
                })
            ).sort((a, b) => {
                return a.getCollisionLayer().id - b.getCollisionLayer().id
            }).reverse()
        }
        return this.spritesCache
    }
    public hasCollisionLayer() {
        return !!this.collisionLayer
    }
    public setCollisionLayer(collisionLayer: CollisionLayer) {
        this.collisionLayer = collisionLayer
    }
    public getCollisionLayer() {
        // OR tiles and AND tiles don't necessarily have a collisionLayer set so pull it from the sprite (this might not work)
        if (this.collisionLayer) {
            return this.collisionLayer
        }
        // check that all sprites are in the same collisionlayer... if not, thene our understanding is flawed
        const firstCollisionLayer = this.getSprites()[0].getCollisionLayer()
        for (const sprite of this.getSprites()) {
            if (sprite.getCollisionLayer() !== firstCollisionLayer) {
                throw new Error(`ooh, sprites in a tile have different collision layers... that's a problem\n${this.toString()}`)
            }
        }
        return firstCollisionLayer
    }
    public getCollisionLayers() {
        const layers = new Set()
        for (const sprite of this.getSprites()) {
            layers.add(sprite.getCollisionLayer())
        }
        return [...layers]
    }

    public getCellsThatMatch() {
        const matches = new Set()
        for (const sprite of this.getSprites()) {
            for (const cell of sprite.getCellsThatMatch()) {
                matches.add(cell)
            }
        }
        return matches
    }

    public subscribeToCellChanges(t: SimpleTileWithModifier) {
        this.trickleTilesWithModifier.add(t)
        // subscribe this to be notified of all Sprite changes of Cells
        for (const sprite of this.getSprites()) {
            sprite.subscribeToCellChangesTile(this)
        }
    }
    public hasNegationTileWithModifier() {
        for (const t of this.trickleTilesWithModifier) {
            if (t.isNo()) {
                return true
            }
        }
        return false
    }
    public addCells(sprite: GameSprite, cells: Cell[], wantsToMove: Optional<RULE_DIRECTION>) {
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
    public updateCells(sprite: GameSprite, cells: Cell[], wantsToMove: Optional<RULE_DIRECTION>) {
        // verify that all the cells are in trickleCells
        if (process.env.NODE_ENV === 'development') {
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

    public removeCells(sprite: GameSprite, cells: Cell[]) {
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
    public hasCell(cell: Cell) {
        return this.trickleCells.has(cell)
    }
}

export class GameLegendTileSimple extends GameLegendTile {
    constructor(source: IGameCode, spriteNameOrLevelChar: string, tile: GameSprite) {
        super(source, spriteNameOrLevelChar, [tile])
    }
    public matchesCell(cell: Cell) {
        // Update code coverage (Maybe only count the number of times it was true?)
        if (process.env.NODE_ENV === 'development') {
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

    public getSpritesThatMatch(cell: Cell) {
        return setIntersection(new Set(this.getSprites()), cell.getSpritesAsSet())
    }

    public hasSingleCollisionLayer() {
        return !!this.collisionLayer
    }
}

export class GameLegendTileAnd extends GameLegendTile {
    public matchesCell(cell: Cell) {
        // Update code coverage (Maybe only count the number of times it was true?)
        if (process.env.NODE_ENV === 'development') {
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

    public getSpritesThatMatch(cell: Cell): Set<GameSprite> {
        // return setIntersection(new Set(this.getSprites()), cell.getSpritesAsSet())
        throw new Error(`BUG: This method should only be called for OR tiles`)
    }

    public hasSingleCollisionLayer() {
        return !!this.collisionLayer
    }

}

export class GameLegendTileOr extends GameLegendTile {
    public isOr() {
        return true
    }
    public matchesCell(cell: Cell) {
        // Update code coverage (Maybe only count the number of times it was true?)
        if (process.env.NODE_ENV === 'development') {
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

    public getSpritesThatMatch(cell: Cell) {
        return setIntersection(new Set(this.getSprites()), cell.getSpritesAsSet())
    }

    public hasSingleCollisionLayer() {
        const sprites = this.getSprites()
        for (const sprite of sprites) {
            if (sprite.getCollisionLayer() !== sprites[0].getCollisionLayer()) {
                return false
            }
        }
        return true
    }
}
