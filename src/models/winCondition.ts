import { BaseForLines, IGameCode } from './game'
import { Cell } from '../engine';
import { GameSprite, IGameTile, GameLegendTileAnd } from './tile';
import { setIntersection } from '../util';

export enum WIN_QUALIFIER {
    NO = 'NO',
    ALL = 'ALL',
    ANY = 'ANY',
    SOME = 'SOME',
}

export class WinConditionSimple extends BaseForLines {
    _qualifier: WIN_QUALIFIER
    _tile: IGameTile

    constructor(source: IGameCode, qualifierEnum: WIN_QUALIFIER, tile: IGameTile) {
        super(source)
        this._qualifier = qualifierEnum
        this._tile = tile
        if (!tile) {
            throw new Error('BUG: Could not find win condition tile')
        }
    }

    cellsThatMatchTile(cells: Iterable<Cell>, tile: IGameTile) {
        return [...cells].filter(cell => tile.matchesCell(cell))
    }

    isSatisfied(cells: Iterable<Cell>) {
        const ret = this._isSatisfied(cells)
        if (ret) {
            if (process.env['NODE_ENV'] === 'development') {
                this.__coverageCount++
            }
        }
        return ret
    }

    _isSatisfied(cells: Iterable<Cell>) {
        const tileCells = this.cellsThatMatchTile(cells, this._tile)
        switch (this._qualifier) {
            case WIN_QUALIFIER.NO:
                return tileCells.length === 0
            case WIN_QUALIFIER.ANY:
            case WIN_QUALIFIER.SOME:
                return tileCells.length > 0
            // case WIN_QUALIFIER.ALL:
            //     return ![...cells].filter(cell => !this.matchesTile(cell, this._tile))[0]
            default:
                throw new Error(`BUG: Invalid qualifier: "${this._qualifier}"`)
        }
    }
}

export class WinConditionOn extends WinConditionSimple {
    _onTile: IGameTile

    constructor(source: IGameCode, qualifierEnum: WIN_QUALIFIER, tile: IGameTile, onTile: IGameTile) {
        super(source, qualifierEnum, tile)
        this._onTile = onTile
    }


    _isSatisfied(cells: Iterable<Cell>) {
        // ALL Target ON CleanDishes
        const tileCells = this.cellsThatMatchTile(cells, this._tile)
        const onTileCells = this.cellsThatMatchTile(tileCells, this._onTile)

        switch (this._qualifier) {
            case WIN_QUALIFIER.NO:
                return onTileCells.length === 0
            case WIN_QUALIFIER.ANY:
            case WIN_QUALIFIER.SOME:
                return onTileCells.length > 0
            case WIN_QUALIFIER.ALL:
                return onTileCells.length === tileCells.length
            default:
                throw new Error(`BUG: Invalid qualifier: "${this._qualifier}"`)
        }
    }
}