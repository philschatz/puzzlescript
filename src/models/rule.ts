import * as _ from 'lodash'
import {
    BaseForLines,
    IGameCode,
    IGameNode
} from '../models/game'
import { IGameTile, GameSprite } from './tile'
import {
    IMutator,
    RuleBracketPair,
    getMatchedMutatorsHelper,
    SIMPLE_DIRECTIONS,
    CellMutation
} from '../pairs'
import { RULE_MODIFIER, setDifference, setIntersection } from '../util'
import { Cell } from '../engine'
import { GameTree } from '../gameTree';
import { RULE_DIRECTION } from '../enums';

enum RULE_COMMAND {
    AGAIN = 'AGAIN'
}

export const SIMPLE_DIRECTION_DIRECTIONS = new Set([
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

// Note: Directions inside a Bracket are relative to other dorections inside a bracket
// Example:
//
// Interpret `[ > player > cat | < dog ] -> [ < player | cat < dog ]` to:
// Interpret `[ ^ player v cat | v dog ] -> [ v player | cat v dog ]` to:
// UP    [ UP    player UP    cat | DOWN  dog ] -> [ DOWN  player | cat DOWN  dog ]
// DOWN  [ DOWN  player DOWN  cat | UP    dog ] -> [ UP    player | cat UP    dog ]
// LEFT  [ LEFT  player LEFT  cat | RIGHT dog ] -> [ RIGHT player | cat RIGHT dog ]
// RIGHT [ RIGHT player RIGHT cat | LEFT  dog ] -> [ LEFT  player | cat LEFT  dog ]
//
// Interpret `HORIZONTAL [ > player ] -> [ < crate ] to:
// LEFT  [ LEFT  player ] -> [ RIGHT crate ]
// RIGHT [ RIGHT player ] -> [ LEFT  crate ]
//
// Interpret `VERTICAL [ ^ player PARALLEL cat | PERPENDICULAR dog ] -> [ < crate |  dog ] to:
// UP    [ LEFT   player HORIZONTAL cat ] -> [ DOWN  crate | VERTICAL   dog ]
// DOWN  [ RIGHT  player HORIZONTAL cat ] -> [ UP    crate | VERTICAL   dog ]
// LEFT  [ DOWN   player VERTICAL   cat ] -> [ RIGHT crate | HORIZONTAL dog ]
// DOWN  [ RIGHT  player HORIZONTAL cat ] -> [ UP    crate | HORIZONTAL dog ]
//
// See https://www.puzzlescript.net/Documentation/executionorder.html
export class GameRule extends BaseForLines implements IRule {
    _modifiers: Set<RULE_MODIFIER>
    _commands: string[]
    _bracketPairs: RuleBracketPair[]
    _hasEllipsis: boolean
    _brackets: RuleBracket[]
    // _conditionCommandPair: RuleConditionCommandPair[]

    constructor(source: IGameCode, modifiers: Set<RULE_MODIFIER>, conditions: RuleBracket[], actions: RuleBracket[], commands: string[]) {
        super(source)
        this._modifiers = modifiers
        this._commands = commands
        this._hasEllipsis = false
        this._brackets = conditions

        // Set _hasEllipsis value
        for (let i = 0; i < conditions.length; i++) {
            const condition = conditions[i]
            if (condition.hasEllipsis()) {
                this._hasEllipsis = true
                break
            }
        }

        // Check if valid
        if (conditions.length !== actions.length && actions.length !== 0) {
            throw new Error(`Left side has "${conditions.length}" conditions and right side has "${actions.length}" actions!`)
        }

        // Subscribe the bracket and neighbors to cell Changes (only the condition side)
        conditions.forEach(bracket => {
            bracket.subscribeToNeighborChanges()
            bracket._neighbors.forEach(neighbor => {
                neighbor.subscribeToTileChanges()
                neighbor._tilesWithModifier.forEach(t => {
                    t.subscribeToCellChanges()
                })
            })
        })

        if (conditions.length === actions.length) {
            this._bracketPairs = _.zip(conditions, actions).map(([condition, action]) => {
                return new RuleBracketPair(this._modifiers, condition, action)
            })
        } else if (actions.length !== 0) {
            throw new Error(`Invalid Rule. The number of brackets on the right must match the structure of the left hand side or be 0`)
        }
        // TODO: build the _conditionCommandPair
        if (commands.length > 0) {
            this._bracketPairs = []
        }
    }

    evaluate() {
        if (this._bracketPairs.length === 0 || this.isLate()) {
            // TODO: Just commands are not supported yet
            return []
        }
        const allMutators: CellMutation[][] = []
        // Determine which directions to loop over
        // Include any simple UP, DOWN, LEFT, RIGHT ones
        let directionsToCheck = setIntersection(this._modifiers, SIMPLE_DIRECTIONS)
        // Include LEFT and RIGHT if HORIZONTAL
        if (this._modifiers.has(RULE_MODIFIER.HORIZONTAL)) {
            return [] // not supported properly
            // directionsToCheck.add(RULE_MODIFIER.LEFT)
            // directionsToCheck.add(RULE_MODIFIER.RIGHT)
        }
        // Include UP and DOWN if VERTICAL
        if (this._modifiers.has(RULE_MODIFIER.VERTICAL)) {
            return [] // not supported properly
            // directionsToCheck.add(RULE_MODIFIER.UP)
            // directionsToCheck.add(RULE_MODIFIER.DOWN)
        }
        // If no direction was specified then check UP, DOWN, LEFT, RIGHT
        if (directionsToCheck.size === 0) {
            directionsToCheck = new Set(SIMPLE_DIRECTIONS)
        }

        for (const direction of directionsToCheck) {

            // check that all the bracketPairs have at least one match
            let matchesAllBrackets = true
            for (const bracket of this._brackets) {
                const firstMatches = bracket.getFirstCellsInDir(direction)
                if (firstMatches.size === 0) {
                    matchesAllBrackets = false
                }
            }

            if (matchesAllBrackets) {
                // Evaluate!
                const mutators = this._brackets.map((bracket, index) => {
                    const firstMatches = new Set(bracket.getFirstCellsInDir(direction)) // Make it an Array just so we copy the elements out because Sets are mutable
                    const ret: CellMutation[][] = []
                    firstMatches.forEach(firstCell => {
                        ret.push(this._bracketPairs[index].evaluate(direction, firstCell))
                    })
                    if (process.env['NODE_ENV'] !== 'production') {
                        this.__coverageCount++
                    }
                    return _.flatten(ret)
                })
                allMutators.push(_.flatten(mutators))
                break // only evaluate the first direction that matches successfully
            }
        }
        return _.flatten(allMutators)
    }

    getMatchedMutatorsOrNull(cell: Cell) {
        // We do not support multiple bracket pairs yet
        if (this._bracketPairs.length > 1) {
            return
        }
        // If the rule has any modifiers that we do not understand, return null
        if (setDifference(this._modifiers, SUPPORTED_RULE_MODIFIERS).size > 0) {
            return null
        }
        return getMatchedMutatorsHelper(this._bracketPairs, cell)
    }

    isLate() {
        return this._modifiers.has(RULE_MODIFIER.LATE)
    }
    isRigid() {
        return this._modifiers.has(RULE_MODIFIER.RIGID)
    }
    isAgain() {
        return this._commands.indexOf(RULE_COMMAND.AGAIN) >= 0
    }
    isVanilla() {
        return !(this.isLate() || this.isRigid() || this.isAgain())
    }

}

export class RuleBracket extends BaseForLines {
    _neighbors: RuleBracketNeighbor[]
    _hasEllipsis: boolean
    _firstCellsInEachDirection: Map<RULE_DIRECTION, Set<Cell>>

    constructor(source: IGameCode, neighbors: RuleBracketNeighbor[], hack: string) {
        super(source)
        this._neighbors = neighbors
        this._hasEllipsis = false

        // populate the cache
        this._firstCellsInEachDirection = new Map()
        for (const direction of SIMPLE_DIRECTION_DIRECTIONS) {
            this._firstCellsInEachDirection.set(direction, new Set())
        }
        this._firstCellsInEachDirection.set(RULE_DIRECTION.ACTION, new Set())

        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i]
            if (neighbor.isEllipsis()) {
                this._hasEllipsis = true
                break
            }
        }
    }

    hasEllipsis() {
        return this._hasEllipsis
    }

    toKey() {
        return this._neighbors.map(n => n.toKey()).join('|')
    }

    subscribeToNeighborChanges() {
        this._neighbors.forEach(neighbor => {
            neighbor.addBracket(this)
        })
    }

    getFirstCellsInDir(direction: RULE_DIRECTION) {
        return this._firstCellsInEachDirection.get(direction)
    }

    updateCell(cell: Cell, sprite: GameSprite, tileWithModifier: TileWithModifier, neighbor: RuleBracketNeighbor, wantsToMove: RULE_DIRECTION, flagAdded: boolean) {
        const index = this._neighbors.indexOf(neighbor)
        if (flagAdded) {
            for (const direction of SIMPLE_DIRECTION_DIRECTIONS) {
                // cell was added
                // Check all the neighbors and add the firstNeighbor to the set of matches for this direction
                let matched = true
                let curCell = cell
                // Loop Downstream
                // check the neighbors downstream of curCell
                for (let x = index + 1; x < this._neighbors.length; x++) {
                    curCell = curCell.getNeighbor(direction)
                    if (curCell && this._neighbors[x].hasCell(curCell)) {
                        // keep going
                    } else {
                        matched = false
                        break
                    }
                }
                if (!matched) {
                    continue
                }
                // Loop Upstream
                // check the neighbors upstream of curCell
                matched = true
                curCell = cell
                // check the neighbors upstream of curCell
                for (let x = index - 1; x >= 0; x--) {
                    curCell = curCell.getNeighbor(opposite(direction))
                    if (curCell && this._neighbors[x].hasCell(curCell)) {
                        // keep going
                    } else {
                        matched = false
                        break
                    }
                }
                if (!matched) {
                    continue
                }

                // Add to the set of firstNeighbors
                // We have a match. Add to the firstCells set.
                // console.log(`Cell [${cell.rowIndex}][${cell.colIndex}] caused an additional match for a rule bracket`);
                this._firstCellsInEachDirection.get(direction).add(curCell)
                global['rules_updated_count'] += 1
            }
        } else {
            // cell was removed
            for (const direction of SIMPLE_DIRECTION_DIRECTIONS) {
                // Loop Upstream
                // Remove from the set of firstNeighbors
                // Loop Upstream
                // check the neighbors upstream of curCell
                let matched = true
                let curCell = cell
                // check the neighbors upstream of curCell
                for (let x = index - 1; x >= 0; x--) {
                    curCell = curCell.getNeighbor(opposite(direction))
                    if (curCell) {
                        // keep going
                    } else {
                        matched = false
                        break
                    }
                }
                if (!matched) {
                    continue
                }
                // console.log(`Cell [${cell.rowIndex}][${cell.colIndex}] caused a removal of rule bracket`);
                this._firstCellsInEachDirection.get(direction).delete(curCell)
                global['rules_updated_count'] += 1
            }
        }
    }
}

export class RuleBracketNeighbor extends BaseForLines {
    _brackets: RuleBracket[]
    _tilesWithModifier: TileWithModifier[]
    _isEllipsis: boolean
    _localCellCache: Set<Cell>

    constructor(source: IGameCode, tilesWithModifier: TileWithModifier[], isEllipsis: boolean) {
        super(source)
        this._tilesWithModifier = tilesWithModifier
        this._isEllipsis = isEllipsis

        this._localCellCache = new Set()
        this._brackets = []
    }

    toKey() {
        return this._tilesWithModifier.map(t => t.toKey()).sort().join(' ')
    }

    subscribeToTileChanges() {
        this._tilesWithModifier.forEach(t => {
            t.addRuleBracketNeighbor(this)
        })
    }

    isEllipsis() {
        return this._isEllipsis
    }

    addBracket(bracket: RuleBracket) {
        this._brackets.push(bracket)
    }

    updateCell(cells: Cell[], sprite: GameSprite, tileWithModifier: TileWithModifier, wantsToMove: RULE_DIRECTION, flagAdded) {
        for (const cell of cells) {
            let shouldPropagate = []
            if (flagAdded) {
                let shouldMatch = true
                for (const t of this._tilesWithModifier) {
                    if (!t.matchesCell2(cell, wantsToMove)) {
                        shouldMatch = false
                        break
                    }
                }
                if (shouldMatch) {
                    // console.log(`Cell [${cell.rowIndex}][${cell.colIndex}] impacted ${this._brackets.length} brackets`);
                    for (const bracket of this._brackets) {
                        bracket.updateCell(cell, sprite, tileWithModifier, this, wantsToMove, flagAdded)
                    }
                    this._localCellCache.add(cell)
                } else {
                    for (const bracket of this._brackets) {
                        bracket.updateCell(cell, sprite, tileWithModifier, this, wantsToMove, false)
                    }
                    this._localCellCache.delete(cell)
                }
            } else {
                // remove it from upstream
                for (const bracket of this._brackets) {
                    bracket.updateCell(cell, sprite, tileWithModifier, this, wantsToMove, flagAdded)
                }
                this._localCellCache.delete(cell)
            }
        }
    }
    hasCell(cell: Cell) {
        return this._localCellCache.has(cell)
    }
}

export class TileWithModifier extends BaseForLines {
    _neighbors: RuleBracketNeighbor[]
    _modifier?: string
    _tile: IGameTile

    constructor(source: IGameCode, modifier: string, tile: IGameTile) {
        super(source)
        this._modifier = modifier
        this._tile = tile
        this._neighbors = []

        if (!this._tile) {
            console.log('TODO: Do something about ellipses')
        }

    }

    // This should only be called on Condition Brackets
    subscribeToCellChanges() {
        // subscribe this to be notified of all Sprite changes of Cells
        if (this._tile) { // grr, ellipsis hack....
            this._tile.getSprites().forEach(sprite => {
                sprite.addTileWithModifier(this)
            })
        }
    }

    toKey() {
        return `${this._modifier || ''} ${this._tile ? this._tile.getSprites().map(sprite => sprite._getName()) : '|||(notile)|||'}`
    }

    isNo() {
        return M_NO === this._modifier
    }

    matchesCell(cell: Cell) {
        if (this._modifier && !SUPPORTED_CELL_MODIFIERS.has(this._modifier)) {
            return false // Modifier not supported yet
        }
        const hasTile = this._tile && this._tile.matchesCell(cell)
        if (this.isNo()) {
            return !hasTile
        } else {
            return hasTile
        }
    }
    matchesCell2(cell: Cell, wantsToMove: RULE_DIRECTION) {
        if (this._modifier === 'STATIONARY' && wantsToMove) {
            return false
        }
        if (this._modifier && !SUPPORTED_CELL_MODIFIERS.has(this._modifier)) {
            return false // Modifier not supported yet
        }
        const hasTile = this._tile && this._tile.matchesCell(cell)
        let matchesDirection = true
        if (RULE_DIRECTION.STATIONARY === RULE_DIRECTION[this._modifier]) {
            // matchesDirection = cell.wantsToMoveTo(this._tile, relativeDirectionToAbsolute(direction, RULE_DIRECTION[this._modifier]))
            matchesDirection = !wantsToMove
        }
        if (this.isNo()) {
            return !(hasTile && matchesDirection)
        } else {
            return hasTile && matchesDirection
        }
    }

    addRuleBracketNeighbor(neighbor: RuleBracketNeighbor) {
        this._neighbors.push(neighbor)
    }
    updateCell(cells: Cell[], wantsToMove: RULE_DIRECTION, sprite: GameSprite, wasAdded: boolean) {
        // TODO: check if the cell still matches

        // Cells all have the same sprites, so if the 1st matches, they all do
        let flagAdded = this._tile.matchesCell(cells[0])
        if (this.isNo()) {
            flagAdded = !flagAdded
        }

        // console.log(`Cell [${cell.rowIndex}][${cell.colIndex}] impacted ${this._neighbors.length} neighbors`);
        // Only pass up the food chain if the modifier (roughly) matches the wantsToMove (ignoring orientation)
        // if (!wantsToMove || wantsToMove && [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN, RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT, RULE_DIRECTION.ACTION].indexOf(this._modifier as RULE_DIRECTION) >= 0) {
            for (const neighbor of this._neighbors) {
                neighbor.updateCell(cells, sprite, this, wantsToMove, flagAdded)
            }
        // }
}
}

// Extend RuleBracketNeighbor so that NeighborPair doesn't break
export class HackNode extends RuleBracketNeighbor {
    fields: object

    // These should be addressed as we write the interpreter
    constructor(source: IGameCode, fields: object) {
        super(source, [], false)
        this.fields = fields
    }

    isEllipsis() {
        return false
    }
}

export interface IRule extends IGameNode {
    getMatchedMutatorsOrNull: (cell: Cell) => IMutator[] | null
}

export class GameRuleLoop extends BaseForLines implements IRule {
    _rules: GameRule[]

    constructor(source: IGameCode, rules: GameRule[]) {
        super(source)
        this._rules = rules
    }

    getMatchedMutatorsOrNull(cell: Cell): IMutator[] {
        return null // Not implemented yet
        // return getMatchedMutatorsHelper(this._rules, cell)
    }

}

export class GameRuleGroup extends GameRuleLoop {
    // do we really need this class?
}

const M_STATIONARY = 'STATIONARY'
const M_NO = 'NO'
const SUPPORTED_CELL_MODIFIERS = new Set([M_STATIONARY, M_NO])
const SUPPORTED_RULE_MODIFIERS = new Set([
    RULE_MODIFIER.UP,
    RULE_MODIFIER.DOWN,
    RULE_MODIFIER.LEFT,
    RULE_MODIFIER.RIGHT,
    RULE_MODIFIER.HORIZONTAL,
    RULE_MODIFIER.VERTICAL,
    RULE_MODIFIER.ORTHOGONAL
])

function relativeDirectionToAbsolute(currentDirection: RULE_DIRECTION, tileModifier: string) {
    let currentDir
    switch (currentDirection) {
      case RULE_DIRECTION.RIGHT:
        currentDir = 0
        break
      case RULE_DIRECTION.UP:
        currentDir = 1
        break
      case RULE_DIRECTION.LEFT:
        currentDir = 2
        break
      case RULE_DIRECTION.DOWN:
        currentDir = 3
        break
      default:
        throw new Error(`BUG! Invalid rule direction "${currentDirection}`)
    }

    switch (tileModifier) {
      case RULE_DIRECTION.RIGHT:
        currentDir += 0
        break
      case RULE_DIRECTION.UP:
        currentDir += 1
        break
      case RULE_DIRECTION.LEFT:
        currentDir += 2
        break
      case RULE_DIRECTION.DOWN:
        currentDir += 3
        break
    }
    switch (currentDir % 4) {
      case 0:
        return RULE_DIRECTION.RIGHT
      case 1:
        return RULE_DIRECTION.UP
      case 2:
        return RULE_DIRECTION.LEFT
      case 3:
        return RULE_DIRECTION.DOWN
      default:
        throw new Error(`BUG! Incorrectly computed rule direction "${currentDirection}" "${tileModifier}"`)
    }
  }