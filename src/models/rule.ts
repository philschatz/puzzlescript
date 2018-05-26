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
    SIMPLE_DIRECTIONS,
    CellMutation
} from '../pairs'
import { RULE_MODIFIER, setDifference, setIntersection, nextRandom, RULE_DIRECTION_ABSOLUTE, RULE_DIRECTION_ABSOLUTE_SET, RULE_DIRECTION_ABSOLUTE_LIST } from '../util'
import { Cell } from '../engine'
import { GameTree } from '../gameTree';
import { RULE_DIRECTION } from '../enums';

const MAX_ITERATIONS_IN_LOOP = 10

enum RULE_COMMAND {
    AGAIN = 'AGAIN'
}

export const SIMPLE_DIRECTION_DIRECTIONS = [
    RULE_DIRECTION.RIGHT,
    RULE_DIRECTION.DOWN,
    RULE_DIRECTION.LEFT,
    RULE_DIRECTION.UP
]

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

export class SimpleRuleGroup extends BaseForLines {
    _rules: SimpleRule[]
    constructor(source: IGameCode, rules: SimpleRule[]) {
        super(source)
        this._rules = rules
    }
}

// This is a rule that has been expanded from `DOWN [ > player < cat RIGHT dog ] -> [ ^ crate ]` to:
// DOWN [ DOWN player UP cat RIGHT dog ] -> [ RIGHT crate ]
//
// And a more complicated example:
// DOWN [ > player LEFT cat HORIZONTAL dog < crate VERTICAL wall ] -> [ ^ crate  HORIZONTAL dog ]
//
// DOWN [ DOWN player LEFT cat LEFT dog UP crate UP wall ] -> [ right crate LEFT dog ]
// DOWN [ DOWN player LEFT cat LEFT dog UP crate DOWN wall ] -> [ right crate LEFT dog ]
// DOWN [ DOWN player LEFT cat RIGHT dog UP crate UP wall ] -> [ RIGHT crate RIGHT dog ]
// DOWN [ DOWN player LEFT cat RIGHT dog UP crate DOWN wall ] -> [ RIGHT crate RIGHT dog ]
export class SimpleRule extends BaseForLines implements ICacheable {
    _evaluationDirection: RULE_DIRECTION_ABSOLUTE
    _conditionBrackets: SimpleBracket[]
    _actionBrackets: SimpleBracket[]
    _commands: string[]
    _isLate: boolean
    _isRigid: boolean
    _isAgain: boolean
    constructor(source: IGameCode, evaluationDirection: RULE_DIRECTION_ABSOLUTE, conditionBrackets: SimpleBracket[], actionBrackets: SimpleBracket[], commands: string[], isLate: boolean, isRigid: boolean, isAgain: boolean) {
        super(source)
        this._evaluationDirection = evaluationDirection
        this._conditionBrackets = conditionBrackets
        this._actionBrackets = actionBrackets
        this._commands = commands
        this._isLate = isLate
        this._isRigid = isRigid
        this._isAgain = isAgain
    }
    toKey() {
        return `${this._conditionBrackets.map(x => x.toKey())} -> ${this._actionBrackets.map(x => x.toKey())} ${this._commands.join(' ')}`
    }
}
class SimpleBracket extends BaseForLines implements ICacheable {
    _neighbors: SimpleNeighbor[]
    constructor(source: IGameCode, neighbors: SimpleNeighbor[]) {
        super(source)
        this._neighbors = neighbors
    }
    toKey() {
        return `[${this._neighbors.map(n => n.toKey()).join('|')}]`
    }
}
class SimpleNeighbor extends BaseForLines implements ICacheable {
    _tiles: Set<SimpleTileWithModifier>
    constructor(source: IGameCode, tiles: Set<SimpleTileWithModifier>) {
        super(source)
        this._tiles = tiles
    }
    toKey() {
        return `{${[...this._tiles].map(t => t.toKey()).sort().join(' ')}`
    }
}
class SimpleTileWithModifier extends BaseForLines implements ICacheable {
    _isNegated: boolean
    _direction: RULE_DIRECTION_ABSOLUTE
    _tile: IGameTile
    _parentNeighbors: SimpleNeighbor[]
    constructor(source: IGameCode, isNegated: boolean, direction: RULE_DIRECTION_ABSOLUTE, tile: IGameTile) {
        super(source)
        this._isNegated = isNegated
        this._direction = direction
        this._tile = tile
        this._parentNeighbors = []
    }

    toKey() {
        return `{${this._isNegated}} ${this._direction} [${this._tile.getSprites().map(sprite => sprite._getName()).sort()}]`
    }

    addRuleBracketNeighbor(neighbor: SimpleNeighbor) {
        this._parentNeighbors.push(neighbor)
    }


}

class Pair<A> {
    condition: A
    action: A
    constructor(condition: A, action: A) {
        this.condition = condition
        this.action = action
    }
}


interface ICacheable {
    toKey: () => string
}

function cacheSetAndGet<A extends ICacheable>(cache: Map<string, A>, obj: A) {
    const key = obj.toKey()
    if (!cache.has(key)) {
        cache.set(key, obj)
    }
    return cache.get(key)
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
export class GameRule extends BaseForLines implements IRule, ICacheable {
    _modifiers: RULE_MODIFIER[]
    _commands: string[]
    _bracketPairs: RuleBracketPair[]
    _hasEllipsis: boolean
    _brackets: RuleBracket[]
    _actionBrackets: RuleBracket[]
    // _conditionCommandPair: RuleConditionCommandPair[]

    toKey() {
        return `${this._brackets.map(x => x.toKey())} -> ${this._actionBrackets.map(x => x.toKey())} ${this._commands.join(' ')}`
    }

    simplify(ruleCache: Map<string, SimpleRule>,bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return this.convertToMultiple().map(r => r.toSimple(ruleCache, bracketCache, neighborCache, tileCache))
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const directions = this.getDirectionModifiers()
        if (directions.length !== 1) {
            throw new Error(`BUG: should have exactly 1 direction by now but found the following: "${directions}"`)
        }
        return cacheSetAndGet(ruleCache, new SimpleRule(this.__source, directions[0], this._brackets.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)), this._actionBrackets.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)), this._commands, this.isLate(), this.isRigid(), this.isAgain()))
    }

    convertToMultiple() {
        let rulesToConvert = [this]
        let convertedRules = []

        for (const direction of this.getDirectionModifiers()) {
            const expandModifiers = new Map()
            expandModifiers.set(RULE_MODIFIER.HORIZONTAL, [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT])
            expandModifiers.set(RULE_MODIFIER.VERTICAL, [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN])
            // switch (direction) {
            //     case RULE_DIRECTION_ABSOLUTE.UP:
            //     case RULE_DIRECTION_ABSOLUTE.DOWN:
            //         expandModifiers.set(RULE_MODIFIER.PARALLEL, [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN])
            //         expandModifiers.set(RULE_MODIFIER.PERPENDICULAR, [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT])
            //         break
            //     case RULE_DIRECTION_ABSOLUTE.LEFT:
            //     case RULE_DIRECTION_ABSOLUTE.RIGHT:
            //         expandModifiers.set(RULE_MODIFIER.PARALLEL, [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT])
            //         expandModifiers.set(RULE_MODIFIER.PERPENDICULAR, [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN])
            //         break
            //     default:
            //         throw new Error(`BUG: Invalid direction`)
            // }

            for (const rule of rulesToConvert) {
                for (const [nameToExpand, variations] of expandModifiers) {
                    if (rule.hasModifier(nameToExpand)) {
                        for (const variation of variations) {
                            convertedRules.push(rule.clone(direction, nameToExpand, variation))
                        }
                    } else if (rule === this) {
                        // don't add the current rule to the set
                    } else {
                        convertedRules.push(rule)
                    }
                }
            }

            rulesToConvert = convertedRules
            convertedRules = []
        }
        return rulesToConvert
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: RULE_MODIFIER, newName: RULE_DIRECTION) {
        const conditionBrackets = this._brackets.map(bracket => bracket.clone(direction, nameToExpand, newName))
        const actionBrackets = this._actionBrackets.map(bracket => bracket.clone(direction, nameToExpand, newName))
        return new GameRule(this.__source, [RULE_MODIFIER[direction]], conditionBrackets, actionBrackets, this._commands)
    }

    hasModifier(modifier: RULE_MODIFIER) {
        for (const bracket of this._brackets) {
            for (const neighbor of bracket._neighbors) {
                for (const t of neighbor._tilesWithModifier) {
                    if (t._modifier === modifier) {
                        return true
                    }
                }
            }
        }
        return false
    }

    getDirectionModifiers() {
        const directions = this._modifiers.filter(m => RULE_DIRECTION_ABSOLUTE_SET.has(m)).map(d => {
            switch(d) {
                case RULE_MODIFIER.UP:
                    return RULE_DIRECTION_ABSOLUTE.UP
                    case RULE_MODIFIER.DOWN:
                    return RULE_DIRECTION_ABSOLUTE.DOWN
                    case RULE_MODIFIER.LEFT:
                    return RULE_DIRECTION_ABSOLUTE.LEFT
                    case RULE_MODIFIER.RIGHT:
                    return RULE_DIRECTION_ABSOLUTE.RIGHT
                default:
                    throw new Error(`BUG: Invalid rule direction "${d}"`)
            }
        })
        if (directions.length === 0) {
            return RULE_DIRECTION_ABSOLUTE_LIST
        } else {
            return directions
        }
    }

    constructor(source: IGameCode, modifiers: RULE_MODIFIER[], conditions: RuleBracket[], actions: RuleBracket[], commands: string[]) {
        super(source)
        this._modifiers = modifiers
        this._commands = commands
        this._hasEllipsis = false
        this._brackets = conditions
        this._actionBrackets = actions

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

        // just see how much slower it is
        this.simplify(new Map(), new Map(), new Map(), new Map())
    }

    evaluate() {
        if (this._bracketPairs.length === 0 || this.isLate()) {
            // TODO: Just commands are not supported yet
            return []
        }
        const allMutators: CellMutation[][] = []
        // Determine which directions to loop over
        // Include any simple UP, DOWN, LEFT, RIGHT ones
        let directionsToCheck = []
        // Not sure what the order of checking should be. Used RIGHT first so the tests would be easier to write
        if (this._modifiers.indexOf(RULE_MODIFIER.RIGHT) >= 0) {
            directionsToCheck.push(RULE_DIRECTION.RIGHT)
        }
        if (this._modifiers.indexOf(RULE_MODIFIER.DOWN) >= 0) {
            directionsToCheck.push(RULE_DIRECTION.DOWN)
        }
        if (this._modifiers.indexOf(RULE_MODIFIER.LEFT) >= 0) {
            directionsToCheck.push(RULE_DIRECTION.LEFT)
        }
        if (this._modifiers.indexOf(RULE_MODIFIER.UP) >= 0) {
            directionsToCheck.push(RULE_DIRECTION.UP)
        }
        // Include LEFT and RIGHT if HORIZONTAL
        if (this._modifiers.indexOf(RULE_MODIFIER.HORIZONTAL) >= 0) {
            return [] // not supported properly
            // directionsToCheck.add(RULE_MODIFIER.LEFT)
            // directionsToCheck.add(RULE_MODIFIER.RIGHT)
        }
        // Include UP and DOWN if VERTICAL
        if (this._modifiers.indexOf(RULE_MODIFIER.VERTICAL) >= 0) {
            return [] // not supported properly
            // directionsToCheck.add(RULE_MODIFIER.UP)
            // directionsToCheck.add(RULE_MODIFIER.DOWN)
        }
        // If no direction was specified then check UP, DOWN, LEFT, RIGHT
        if (directionsToCheck.length === 0) {
            directionsToCheck = SIMPLE_DIRECTION_DIRECTIONS
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
                // let didExecute = false
                const mutators = this._brackets.map((bracket, index) => {
                    const firstMatches = new Set(bracket.getFirstCellsInDir(direction)) // Make it an Array just so we copy the elements out because Sets are mutable
                    const ret: CellMutation[][] = []
                    for (const firstCell of firstMatches) {
                        ret.push(this._bracketPairs[index].evaluate(direction, firstCell))
                    }
                    if (process.env['NODE_ENV'] !== 'production') {
                        this.__coverageCount++
                    }
                    // // Sometimes rules cannot execute. For example, `[ player ] -> [ > player ]`
                    // // should only work if there is a cell in that direction.
                    // // If there is no such cell, then the rule should not execute
                    // if (_.flatten(ret).length > 0) {
                    //     didExecute = true
                    // }
                    return _.flatten(ret)
                })
                allMutators.push(_.flatten(mutators))
                break // only evaluate the first direction that matches successfully
            }
        }
        return _.flatten(allMutators)
    }

    isLate() {
        return this._modifiers.indexOf(RULE_MODIFIER.LATE) >= 0
    }
    isRigid() {
        return this._modifiers.indexOf(RULE_MODIFIER.RIGID) >= 0
    }
    isAgain() {
        return this._commands.indexOf(RULE_COMMAND.AGAIN) >= 0
    }
    isVanilla() {
        return !(this.isLate() || this.isRigid() || this.isAgain())
    }

}

export class RuleBracket extends BaseForLines implements ICacheable {
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

    toKey() {
        return this._neighbors.map(n => n.toKey()).join('|')
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: RULE_MODIFIER, newName: RULE_DIRECTION) {
        return new RuleBracket(this.__source, this._neighbors.map(n => n.clone(direction, nameToExpand, newName)), null)
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return cacheSetAndGet(bracketCache, new SimpleBracket(this.__source, this._neighbors.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache))))
    }

    hasEllipsis() {
        return this._hasEllipsis
    }

    subscribeToNeighborChanges() {
        this._neighbors.forEach(neighbor => {
            neighbor.addBracket(this)
        })
    }

    getFirstCellsInDir(direction: RULE_DIRECTION) {
        return this._firstCellsInEachDirection.get(direction)
    }

    addCell(neighbor: RuleBracketNeighbor, t: TileWithModifier, sprite: GameSprite, cell: Cell, wantsToMove: RULE_DIRECTION) {
        const index = this._neighbors.indexOf(neighbor)
        for (const direction of SIMPLE_DIRECTION_DIRECTIONS) {
            // check if downstream neighbors match
            if (!this.matchesDownstream(cell, index, direction)) {
                continue
            }
            // Loop Upstream
            // check the neighbors upstream of curCell
            const firstCell  = this.matchesUpstream(cell, index, direction)
            if (!firstCell) {
                continue
            }

            // Add to the set of firstNeighbors
            // We have a match. Add to the firstCells set.
            this._firstCellsInEachDirection.get(direction).add(firstCell)
        }
    }
    // updateCell(neighbor: RuleBracketNeighbor, t: TileWithModifier, sprite: GameSprite, cell: Cell, wantsToMove: RULE_DIRECTION) {
    //     this.updateCellOld(cell, sprite, t, neighbor, wantsToMove, true)
    // }
    removeCell(neighbor: RuleBracketNeighbor, t: TileWithModifier, sprite: GameSprite, cell: Cell) {
        const index = this._neighbors.indexOf(neighbor)
        // cell was removed
        for (const direction of SIMPLE_DIRECTION_DIRECTIONS) {
            // Loop Upstream
            const firstCell = this.getFirstCellToRemove(cell, index, direction)
            // Bracket might not match for all directions (likely not), so we might not find a firstCell to remove
            // But that's OK.
            if (firstCell && this._firstCellsInEachDirection.get(direction).has(firstCell)) {
                this._firstCellsInEachDirection.get(direction).delete(firstCell)
            }
        }
    }

    matchesDownstream(cell: Cell, index: number, direction: RULE_DIRECTION) {
        // Check all the neighbors and add the firstNeighbor to the set of matches for this direction
        let matched = true
        let curCell = cell
        // Loop Downstream
        // check the neighbors downstream of curCell
        for (let x = index + 1; x < this._neighbors.length; x++) {
            curCell = curCell.getNeighbor(direction)
            // TODO: Convert the neighbor check into a method
            if (curCell && (this._neighbors[x]._tilesWithModifier.length === 0 || this._neighbors[x].hasCell(curCell))) {
                // keep going
            } else {
                matched = false
                break
            }
        }
        return matched
    }

    matchesUpstream(cell: Cell, index: number, direction: RULE_DIRECTION) {
        let matched = true
        let curCell = cell
        // check the neighbors upstream of curCell
        for (let x = index - 1; x >= 0; x--) {
            curCell = curCell.getNeighbor(opposite(direction))
            if (curCell && (this._neighbors[x]._tilesWithModifier.length === 0 || this._neighbors[x].hasCell(curCell))) {
                // keep going
            } else {
                matched = false
                break
            }
        }
        return matched ? curCell : null
    }

    getFirstCellToRemove(cell: Cell, index: number, direction: RULE_DIRECTION) {
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
        return matched ? curCell : null
    }
}

export class RuleBracketNeighbor extends BaseForLines implements ICacheable {
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

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: RULE_MODIFIER, newName: RULE_DIRECTION) {
        return new RuleBracketNeighbor(this.__source, this._tilesWithModifier.map(t => t.clone(direction, nameToExpand, newName)), this._isEllipsis)
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return cacheSetAndGet(neighborCache, new SimpleNeighbor(this.__source, new Set(this._tilesWithModifier.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)))))
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

    matchesCell(cell: Cell, wantsToMove: RULE_DIRECTION) {
        let shouldMatch = true
        for (const t of this._tilesWithModifier) {
            if (!t.matchesCell(cell, wantsToMove)) {
                shouldMatch = false
                break
            }
        }
        return shouldMatch
    }

    matchesFirstCell(cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION) {
        return this.matchesCell(cells[0], wantsToMove)
    }

    addCells(t: TileWithModifier, sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION) {
        for (const cell of cells) {
            const matchesTiles = this.matchesCell(cell, wantsToMove)
            if (matchesTiles) {
                // Commented because updates could cause the cell to already be in the cache
                //if (!this.hasCell(cell)) {
                for (const bracket of this._brackets) {
                    bracket.addCell(this, t, sprite, cell, wantsToMove)
                }
                this._localCellCache.add(cell)
                //}
            } else {
                // adding the Cell causes the set of Tiles to no longer match.
                // If it previously matched, notify the bracket that it no longer matches
                // (and delete it from our cache)
                if (this.hasCell(cell)) {
                    for (const bracket of this._brackets) {
                        bracket.removeCell(this, t, sprite, cell)
                    }
                    this._localCellCache.delete(cell)
                }
            }
        }
    }
    updateCells(t: TileWithModifier, sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION) {
        this.addCells(t, sprite, cells, wantsToMove)
    }
    removeCells(t: TileWithModifier, sprite: GameSprite, cells: Iterable<Cell>) {
        for (const cell of cells) {
            if (this.hasCell(cell)) {
                // remove it from upstream
                for (const bracket of this._brackets) {
                    bracket.removeCell(this, t, sprite, cell)
                }
                this._localCellCache.delete(cell)
            }
        }
    }

    hasCell(cell: Cell) {
        return this._localCellCache.has(cell)
    }
}

export class TileWithModifier extends BaseForLines implements ICacheable {
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

    toKey() {
        return `${this._modifier || ''} ${this._tile ? this._tile.getSprites().map(sprite => sprite._getName()) : '|||(notile)|||'}`
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: RULE_MODIFIER, newName: RULE_DIRECTION) {
        switch (this._modifier) {
            case nameToExpand:
                return new TileWithModifier(this.__source, newName, this._tile)
            case '>':
            case '<':
            case '^':
            case 'v':
                let modifier = relativeDirectionToAbsolute(direction, this._modifier)
                return new TileWithModifier(this.__source, modifier, this._tile)
            default:
                return this
        }
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        let direction
        switch (this._modifier) {
            case 'UP':
            case 'DOWN':
            case 'LEFT':
            case 'RIGHT':
                direction = RULE_DIRECTION_ABSOLUTE[this._modifier]
                break
            default:
                direction = null
        }
        return cacheSetAndGet(tileCache, new SimpleTileWithModifier(this.__source, this.isNo(), direction, this._tile))
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

    isNo() {
        return this._modifier === M_NO
    }
    isRandom() {
        return this._modifier === RULE_DIRECTION.RANDOM
    }
    isRandomDir() {
        return this._modifier === RULE_DIRECTION.RANDOMDIR
    }
    getDirectionActionOrStationary(): RULE_DIRECTION {
        let direction
        switch (this._modifier) {
            case RULE_DIRECTION.RANDOMDIR:
                switch (nextRandom(4)) {
                    case 0:
                        direction = RULE_DIRECTION.UP
                        break
                    case 1:
                        direction = RULE_DIRECTION.DOWN
                        break
                    case 2:
                        direction = RULE_DIRECTION.LEFT
                        break
                    case 3:
                        direction = RULE_DIRECTION.RIGHT
                        break
                    default:
                        throw new Error(`BUG: invalid random number chosen`)
                }
                break
            case RULE_DIRECTION.UP:
                direction = RULE_DIRECTION.UP
                break
            case RULE_DIRECTION.DOWN:
                direction = RULE_DIRECTION.DOWN
                break
            case RULE_DIRECTION.LEFT:
                direction = RULE_DIRECTION.LEFT
                break
            case RULE_DIRECTION.RIGHT:
                direction = RULE_DIRECTION.RIGHT
                break
            case RULE_DIRECTION.ACTION:
                direction = RULE_DIRECTION.ACTION
                break
            case RULE_DIRECTION.STATIONARY:
                // if the cell had a wantsToMove, then clear it
                direction = RULE_DIRECTION.STATIONARY
                break
            case undefined:
                direction = null
                break
            default:
                // throw new Error(`BUG: unsupported rule direction modifier "${this._modifier}"`)
                direction = null
        }
        return direction
    }

    matchesCell(cell: Cell, wantsToMove: RULE_DIRECTION) {
        const hasTile = this._tile && this._tile.matchesCell(cell)

        // Modifiers:
        // wantsToMove === ACTION and modifier === ACTION
        // wantsToMove === up/down/left/right and modifier === ><^v
        // wantsToMove === STATIONARY and modifier === STATIONARY
        // wantsToMove === null and modifier === STATIONARY
        const modifierDir = this.getDirectionActionOrStationary()
        let isOK = false
        switch (modifierDir) {
            case RULE_DIRECTION.ACTION:
                isOK = wantsToMove === RULE_DIRECTION.ACTION
                break
            case RULE_DIRECTION.UP:
            case RULE_DIRECTION.DOWN:
            case RULE_DIRECTION.LEFT:
            case RULE_DIRECTION.RIGHT:
                isOK = new Set(SIMPLE_DIRECTION_DIRECTIONS).has(wantsToMove)
                break
            case RULE_DIRECTION.STATIONARY:
            case null:
                isOK = wantsToMove === RULE_DIRECTION.STATIONARY || !wantsToMove/*STATIONARY*/
                break
            default:
                throw new Error(`BUG: Unsupported direction "${modifierDir}"`)
        }
        return this.isNo() != (hasTile && isOK)
    }

    matchesFirstCell(cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION) {
        return this.matchesCell(cells[0], wantsToMove)
    }

    addRuleBracketNeighbor(neighbor: RuleBracketNeighbor) {
        this._neighbors.push(neighbor)
    }
    addCells(sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION) {
        // Cells all have the same sprites, so if the 1st matches, they all do
        if (this.matchesFirstCell(cells, wantsToMove)) {
            for (const neighbor of this._neighbors) {
                neighbor.addCells(this, sprite, cells, wantsToMove)
            }
        } else {
            for (const neighbor of this._neighbors) {
                neighbor.removeCells(this, sprite, cells)
            }
        }
    }
    updateCells(sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION) {
        // Cells all have the same sprites, so if the 1st matches, they all do
        if (this.matchesFirstCell(cells, wantsToMove)) {
            for (const neighbor of this._neighbors) {
                neighbor.updateCells(this, sprite, cells, wantsToMove)
            }
        }
    }
    removeCells(sprite: GameSprite, cells: Iterable<Cell>) {
        // Cells all have the same sprites, so if the 1st matches, they all do
        if (this.matchesFirstCell(cells, null/*STATIONARY*/)) {
            for (const neighbor of this._neighbors) {
                neighbor.addCells(this, sprite, cells, null/*STATIONARY*/)
            }
        } else {
            for (const neighbor of this._neighbors) {
                neighbor.removeCells(this, sprite, cells)
            }
        }
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
    evaluate: () => CellMutation[]
}

export class GameRuleLoop extends BaseForLines implements IRule {
    _rules: GameRule[]

    constructor(source: IGameCode, rules: GameRule[]) {
        super(source)
        this._rules = rules
    }

    evaluate() {
        // Keep looping as long as once of the rules evaluated something
        // const allMutations = []
        // for (let iteration = 0; iteration < MAX_ITERATIONS_IN_LOOP; iteration++) {
        //     if (iteration === MAX_ITERATIONS_IN_LOOP - 1) {
        //         console.error(this.toString())
        //         throw new Error(`BUG: Iterated too many times in startloop`)
        //     }
        //     let evaluatedSomething = false
        //     for (const rule of this._rules) {
        //         const ret = rule.evaluate()
        //         if (ret.length > 0) {
        //             evaluatedSomething = true
        //             allMutations.push(ret)
        //             break
        //         }
        //     }
        //     if (!evaluatedSomething) {
        //         break
        //     }
        // }
        // return _.flatten(allMutations)
        return []
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

export function relativeDirectionToAbsolute(currentDirection: RULE_DIRECTION_ABSOLUTE, relativeModifier: string) {
    let currentDir
    switch (currentDirection) {
        case RULE_DIRECTION_ABSOLUTE.RIGHT:
            currentDir = 0
            break
        case RULE_DIRECTION_ABSOLUTE.UP:
            currentDir = 1
            break
        case RULE_DIRECTION_ABSOLUTE.LEFT:
            currentDir = 2
            break
        case RULE_DIRECTION_ABSOLUTE.DOWN:
            currentDir = 3
            break
        default:
            throw new Error(`BUG! Invalid rule direction "${currentDirection}`)
    }

    switch (relativeModifier) {
        case '>':
            currentDir += 0
            break
        case '^':
            currentDir += 1
            break
        case '<':
            currentDir += 2
            break
        case 'v':
            currentDir += 3
            break
        default:
            throw new Error(`BUG! invalid relative direction "${relativeModifier}"`)
    }
    switch (currentDir % 4) {
        case 0:
            return RULE_DIRECTION_ABSOLUTE.RIGHT
        case 1:
            return RULE_DIRECTION_ABSOLUTE.UP
        case 2:
            return RULE_DIRECTION_ABSOLUTE.LEFT
        case 3:
            return RULE_DIRECTION_ABSOLUTE.DOWN
        default:
            throw new Error(`BUG! Incorrectly computed rule direction "${currentDirection}" "${relativeModifier}"`)
    }
}