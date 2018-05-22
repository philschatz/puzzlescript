import * as _ from 'lodash';
import { IGameTile } from "./models/tile";
import Engine, { Cell } from "./engine";
import { RULE_DIRECTION, RuleBracketPair } from "./pairs";
import { GameData } from "./models/game";
import { TileWithModifier } from './models/rule';

// [ player | dog happy | NO cat | ] [ kangaroo ]

// R1[A, B]                   // this does not need to remember anything (probably?)

// A.up   { a, b, c, d }
// A.down { a, b, c, d }
// A.left { a, b, c, d }
// A.right{ a, b, c, d }       // this only needs to remember a list of the start cell that matched

// B.up{ e }

// a( 1,2 )  b( 4,5,6 )  c( 7,8,9,...1000 )   d( 1-10000 )    e(42)

const ruleDirections = new Set([
    RULE_DIRECTION.UP,
    RULE_DIRECTION.DOWN,
    RULE_DIRECTION.LEFT,
    RULE_DIRECTION.RIGHT
])

function opposite(dir: RULE_DIRECTION) {
    switch (dir) {
        case RULE_DIRECTION.UP:
            return RULE_DIRECTION.DOWN
        case RULE_DIRECTION.DOWN:
            return RULE_DIRECTION.UP
        case RULE_DIRECTION.LEFT:
            return RULE_DIRECTION.RIGHT
        case RULE_DIRECTION.RIGHT:
            return RULE_DIRECTION.LEFT
        default:
            throw new Error(`BUG: Invalid direction: "${dir}"`)
    }
}

export class GameTree {
    brackets: Map<RuleBracketPair, GameBracket>
    sets: Set<GameSet>
    constructor() {
        this.brackets = new Map()
        this.sets = new Set()
    }
    addBracket(bracketPair: RuleBracketPair, gameBracket: GameBracket) {
        this.brackets.set(bracketPair, gameBracket)
    }
    addGameSet(gameSet: GameSet) {
        this.sets.add(gameSet)
    }
    tryAddingCell(cell: Cell) {
        this.sets.forEach(set => {
            set.tryAddingCell(cell)
        })
    }
    removeCellIfNoLongerMatches(cell: Cell) {
        this.sets.forEach(set => {
            set.removeCellIfNoLongerMatches(cell)
        })
    }
    getFirstCellMatchesFor(bracketPair: RuleBracketPair, direction: RULE_DIRECTION) {
        return this.brackets.get(bracketPair)._firstCellsInEachDirection.get(direction)
    }
}
export class GameBracket {
    _gameSetNeighbors: GameSet[]
    _firstCellsInEachDirection: Map<RULE_DIRECTION, Set<Cell>>

    constructor(gameSetNeighbors: GameSet[]) {
        this._gameSetNeighbors = gameSetNeighbors
        this._firstCellsInEachDirection = new Map()

        ruleDirections.forEach(direction => {
            this._firstCellsInEachDirection.set(direction, new Set())
        })

        gameSetNeighbors.forEach(set => {
            set.addBracket(this)
        })
    }

    tryAddingCell(cell: Cell, gameSet: GameSet) {
        const index = this._gameSetNeighbors.indexOf(gameSet)
        // For each direction, check if the cell's meighbors match
        for (const direction of ruleDirections) {
            let matched = true
            let curCell = cell
            // check the neighbors downstream of curCell
            for (let x = index + 1; x < this._gameSetNeighbors.length; x++) {
                curCell = curCell.getNeighbor(direction)
                if (curCell && this._gameSetNeighbors[x].has(curCell)) {
                    // keep going
                } else {
                    matched = false
                    break
                }
            }
            if (!matched) {
                continue
            }
            // check the neighbors upstream of curCell
            matched = true
            curCell = cell
            // check the neighbors downstream of curCell
            for (let x = index - 1; x >= 0; x--) {
                curCell = curCell.getNeighbor(opposite(direction))
                if (curCell && this._gameSetNeighbors[x].has(curCell)) {
                    // keep going
                } else {
                    matched = false
                    break
                }
            }
            if (!matched) {
                continue
            }

            // We have a match. Add to the firstCells set.
            this._firstCellsInEachDirection.get(direction).add(curCell)
        }
    }
    removeCell(cell: Cell, gameSet: GameSet) {
        const index = this._gameSetNeighbors.indexOf(gameSet)
        // For each direction, check if the cell's meighbors match
        for (const direction of ruleDirections) {
            // check the neighbors upstream of curCell
            let matched = true
            let curCell = cell
            // check the neighbors downstream of curCell
            for (let x = index - 1; x >= 0; x--) {
                curCell = curCell.getNeighbor(opposite(direction))
                if (curCell && this._gameSetNeighbors[x].has(curCell)) {
                    // keep going
                } else {
                    matched = false
                    break
                }
            }
            if (!matched) {
                continue
            }

            // We have a match. Add to the firstCells set.
            this._firstCellsInEachDirection.get(direction).delete(curCell)
        }
    }
}

export class GameSet {
    _set: Set<Cell>
    _brackets: Set<GameBracket>
    _tilesForMatching: TileWithModifier[]
    constructor(tiles: TileWithModifier[]) {
        this._set = new Set()
        this._brackets = new Set()
        this._tilesForMatching = tiles
    }

    addBracket(bracket: GameBracket) {
        this._brackets.add(bracket)
    }
    tryAddingCell(cell: Cell) {
        let matches = true
        for (const tile of this._tilesForMatching) {
            if (tile._tile) {
                if (!tile._tile.matchesCell(cell)) {
                    if (!tile.isNo()) {
                        matches = false
                        break
                    }
                } else {
                    if (tile.isNo()) {
                        matches = false
                        break
                    }
                }
            } else {
                // Not sure when tile._tile would be null...
                matches = false
                break
            }
        }
        if (!matches) {
            return false
        }
        this._set.add(cell)
        // move up the update chain
        for (const bracket of this._brackets) {
            bracket.tryAddingCell(cell, this)
        }
        return true
    }
    has(cell: Cell) {
        return this._set.has(cell)
    }
    removeCellIfNoLongerMatches(cell: Cell) {
        if (this.has(cell)) {
            let matches = true
            for (const tile of this._tilesForMatching) {
                if (tile._tile) {
                    if (!tile._tile.matchesCell(cell)) {
                        if (!tile.isNo()) {
                            matches = false
                            break
                        }
                    } else {
                        if (tile.isNo()) {
                            matches = false
                            break
                        }
                    }
                } else {
                    // Not sure when tile._tile would be null...
                    matches = false
                    break
                }
            }
            if (matches) {
                return
            }
            // Cell no longer matches. Remove it
            this._set.delete(cell)
            this._brackets.forEach(bracket => {
                bracket.removeCell(cell, this)
            })
        }
    }
}

export function buildTree(data: GameData) {
    const gameTree = new GameTree()

    _.flatten(data.rules.map(rule => rule._bracketPairs)).map(bracketPair => {
        let neighborPairs = bracketPair ? bracketPair._neighborPairs : []
        const neighbors = neighborPairs.map(neighborPair => {
            const conditions = neighborPair._condition
            const set = new GameSet(conditions) // TODO: Deduplicate these sets
            gameTree.addGameSet(set)
            return set
        })
        const bracket = new GameBracket(neighbors)
        gameTree.addBracket(bracketPair, bracket)
    })

    return gameTree

}

export function buildAndPopulateTree(data: GameData, engine: Engine) {
    const gameTree = buildTree(data)
    engine.getCells().forEach(cell => {
        gameTree.tryAddingCell(cell)
    })

    // global['gameTree'] = gameTree
    // debugger
    return gameTree
}