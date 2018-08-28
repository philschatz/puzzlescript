import * as _ from 'lodash'
import BitSet from 'bitset'
import {
    BaseForLines,
    IGameCode,
    IGameNode
} from './game'
import { IGameTile, GameSprite } from './tile'
import { setIntersection, nextRandom, RULE_DIRECTION, DEBUG_FLAG, ICacheable, Optional } from '../util'
import { Cell } from '../engine'
// import TerminalUI from '../ui/terminal'
import { AbstractCommand } from './command';
import { CollisionLayer } from './collisionLayer';
import LruCache from '../lruCache'
import { SpriteBitSet } from '../spriteBitSet';
const BitSet2 = require('bitset')

const MAX_ITERATIONS_IN_LOOP = 350 // Set by the Random World Generation game
const LRU_CACHE_SIZE = 50 // 1000

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

// Converts `[ [1,2], [a,b] ]` to:
// `[ [1,a], [2,a], [1,b], [2,b] ]`
function buildPermutations<T>(cells: T[][]) {
    let tuples: T[][] = [[]]

    for (let i = 0; i < cells.length; i++) {
        const row = cells[i]
        const newtuples = []
        for (let j = 0; j < row.length; j++) {
            const valtoappend = row[j]
            for (let k = 0; k < tuples.length; k++) {
                const tuple = tuples[k]
                const newtuple = tuple.concat([valtoappend])
                newtuples.push(newtuple)
            }
        }
        tuples = newtuples
    }
    return tuples
}


export class SimpleRuleGroup extends BaseForLines implements IRule {
    private rules: IRule[]
    private isRandom: boolean
    constructor(source: IGameCode, isRandom: boolean, rules: IRule[]) {
        super(source)
        this.rules = rules
        this.isRandom = isRandom
    }

    hasMatches(level: Cell[][]) {
        for (const rule of this.rules) {
            if (rule.hasMatches(level)) {
                return true
            }
        }
        return false
    }

    evaluate(level: Cell[][], onlyEvaluateFirstMatch: boolean) {
        // Keep looping as long as one of the rules evaluated something
        const allMutations: IMutation[][] = []
        for (let iteration = 0; iteration < MAX_ITERATIONS_IN_LOOP; iteration++) {
            if (process.env['NODE_ENV'] === 'development' && iteration === MAX_ITERATIONS_IN_LOOP - 10) {
                // Provide a breakpoint just before we run out of MAX_ITERATIONS_IN_LOOP
                // so that we can step through the evaluations.
                console.error(this.toString())
                console.error('BUG: Iterated too many times in startloop or + (rule group)')
                /*TerminalUI.debugRenderScreen();*/ debugger
            }
            if (iteration === MAX_ITERATIONS_IN_LOOP - 1) {
                console.error(this.toString())
                throw new Error(`BUG: Iterated too many times in startloop or + (rule group)`)
            }
            if (this.isRandom) {
                // Randomly pick one of the rules. I wonder if it needs to be smart
                // It is important that it only be evaluated once (hence the returns)
                const evaluatableRules = this.rules.filter(r => r.hasMatches(level))
                if (evaluatableRules.length === 0) {
                    return []
                } else if (evaluatableRules.length === 1) {
                    const ret = evaluatableRules[0].evaluate(level, true/*only evaluate the 1st match because we are RANDOM and in a loop*/)
                    return ret
                } else {
                    const randomIndex = nextRandom(evaluatableRules.length)
                    const rule = evaluatableRules[randomIndex]
                    const ret = rule.evaluate(level, true/*only evaluate the 1st match because we are RANDOM and in a loop*/)
                    return ret
                }
            } else {
                let evaluatedSomething = false
                for (const rule of this.rules) {
                    // Keep evaluating the rule until nothing changes
                    const ret = rule.evaluate(level, onlyEvaluateFirstMatch)
                    if (ret.length > 0) {
                        // filter because a Rule may have caused only command mutations
                        if (ret.filter(m => m.hasCell()).length > 0) {
                            evaluatedSomething = true
                        }
                        if (onlyEvaluateFirstMatch) {
                            return ret
                        }
                        allMutations.push(ret)
                    }
                }
                if (!evaluatedSomething) {
                    break
                }
            }

        }
        return _.flatten(allMutations)


        // let mutations = []
        // for (const rule of this._rules) {
        //     const ret = rule.evaluate()
        //     if (ret.length > 0) {
        //         mutations = mutations.concat(ret)
        //     }
        // }
        // return mutations
    }

    clearCaches() {
        for (const rule of this.rules) {
            rule.clearCaches()
        }
    }

    getChildRules() {
        return this.rules
    }

    isLate() {
        // All rules in a group should be parked as late if any is marked as late
        return this.rules[0].isLate()
    }

    hasRigid() {
        for (const rule of this.rules) {
            if (rule.hasRigid()) {
                return true
            }
        }
        return false
    }
    addCellsToEmptyRules(cells: Iterable<Cell>) {
        for (const rule of this.rules) {
            rule.addCellsToEmptyRules(cells)
        }
    }
}

export class SimpleRuleLoop extends SimpleRuleGroup {
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
export class SimpleRule extends BaseForLines implements ICacheable, IRule {
    private evaluationDirection: RULE_DIRECTION
    private conditionBrackets: ISimpleBracket[]
    private actionBrackets: ISimpleBracket[]
    private commands: AbstractCommand[]
    private _isLate: boolean
    private readonly isRigid: boolean
    private isSubscribedToCellChanges: boolean
    private debugFlag: DEBUG_FLAG
    constructor(source: IGameCode, evaluationDirection: RULE_DIRECTION, conditionBrackets: ISimpleBracket[], actionBrackets: ISimpleBracket[], commands: AbstractCommand[], isLate: boolean, isRigid: boolean, debugFlag: DEBUG_FLAG) {
        super(source)
        this.evaluationDirection = evaluationDirection
        this.conditionBrackets = conditionBrackets
        this.actionBrackets = actionBrackets
        this.commands = commands
        this._isLate = isLate
        this.isRigid = isRigid
        this.debugFlag = debugFlag
        this.isSubscribedToCellChanges = false

        if (actionBrackets.length > 0) {
            for (let index = 0; index < conditionBrackets.length; index++) {
                conditionBrackets[index].prepareAction(actionBrackets[index])
            }
        }
    }
    toKey() {
        return `{Late?${this._isLate}} {Rigid?${this.isRigid}}  ${this.evaluationDirection} ${this.conditionBrackets.map(x => x.toKey())} -> ${this.actionBrackets.map(x => x.toKey())} ${this.commands.join(' ')} {debugger?${this.debugFlag}}`
    }
    getChildRules(): IRule[] {
        return []
    }
    subscribeToCellChanges() {
        if (!this.isSubscribedToCellChanges) {
            // Subscribe the bracket and neighbors to cell Changes (only the condition side)
            for (const bracket of this.conditionBrackets) {
                bracket.subscribeToNeighborChanges()
            }
            this.isSubscribedToCellChanges = true
        }
    }

    clearCaches() {
        for (const bracket of this.conditionBrackets) {
            bracket.clearCaches()
        }
    }

    evaluate(level: Cell[][], onlyEvaluateFirstMatch: boolean) {
        const allMutations: IMutation[][] = []
        // Keep evaluating the rule until nothing changes
        let innerIteration
        for (innerIteration = 0; innerIteration < MAX_ITERATIONS_IN_LOOP; innerIteration++) {
            if (process.env['NODE_ENV'] === 'development' && innerIteration === MAX_ITERATIONS_IN_LOOP - 10) {
                // Provide a breakpoint just before we run out of MAX_ITERATIONS_IN_LOOP
                // so that we can step through the evaluations.
                /*TerminalUI.debugRenderScreen();*/ debugger
            }
            if (innerIteration === MAX_ITERATIONS_IN_LOOP - 1) {
                throw new Error(`BUG: Iterated too many times in rule or rule group\n${this.toString()}`)
            }
            const ret = this._evaluate(level, onlyEvaluateFirstMatch)
            if (ret.length > 0) {
                allMutations.push(ret)
                // Only evaluate once. This is a HACK since it always picks the 1st cell that matched rather than a RANDOM cell
                if (onlyEvaluateFirstMatch) {
                    break
                }
                // filter because a Rule may have caused only command mutations
                if (ret.filter(m => m.hasCell()).length > 0) {
                } else {
                    break
                }
            } else {
                break
            }
        }
        const flattenedMutations = _.flatten(allMutations)
        if (flattenedMutations.length > 0) {
            // Check if direction is important
            let isDirectionImportant = false
            for (const bracket of this.conditionBrackets) {
                if (bracket.getNeighbors().length > 1) {
                    isDirectionImportant = true
                }
            }
            if (process.env['LOG_LEVEL'] === 'debug') {
                console.error(`Rule ${this.__getSourceLineAndColumn().lineNum} ${isDirectionImportant ? this.evaluationDirection.toLowerCase() + ' ' : ''}applied.${innerIteration > 2 ? ` (x${innerIteration-1})` : ''}`)
            }
        }

        return flattenedMutations
    }

    getMatches(level: Cell[][]) {
        const allBracketsToProcess: MatchedCellsForRule[][] = []
        for (let index = 0; index < this.conditionBrackets.length; index++) {
            const condition = this.conditionBrackets[index]
            const action = this.actionBrackets[index]
            const bracketMatches = condition.getMatches(level, action)
            if (bracketMatches.length === 0) {
                return []
            }
            allBracketsToProcess.push(bracketMatches)
        }
        return allBracketsToProcess
    }

    private _evaluate(level: Cell[][], onlyEvaluateFirstMatch: boolean) {
        // Verify that each condition bracket has matches
        // for (const condition of this.conditionBrackets) {
        //     if (!condition.hasFirstCells()) {
        //         if (process.env['NODE_ENV'] === 'development' && this.debugFlag === DEBUG_FLAG.BREAKPOINT_REMOVE) {
        //             // A "DEBUGGER_REMOVE" flag was set in the game so we are pausing here
        //             /*TerminalUI.debugRenderScreen();*/ debugger
        //         }
        //         return [] // Rule did not match, so nothing ran
        //     }
        // }

        // If a Rule cannot impact itself then the evaluation order does not matter.
        // We can vastly simplify the evaluation in that case
        let ret: IMutation[] = []
        if (process.env['NODE_ENV'] === 'development' && this.debugFlag === DEBUG_FLAG.BREAKPOINT) {
            // A "DEBUGGER" flag was set in the game so we are pausing here
            /*TerminalUI.debugRenderScreen();*/ debugger
        }

        const allBracketsToProcess = this.getMatches(level)

        if (allBracketsToProcess.length === 0) {
            return []
        }

        // Some rules only contain commands.
        // If there are actionBrackets then evaluate them.
        // Get ready to Evaluate
        if (this.actionBrackets.length > 0) {
            const cellPermutations = buildPermutations(allBracketsToProcess)

            const allMutations: IMutation[][] = []

            for (const permutation of cellPermutations) {
                let didAllBracketsStillMatch = true
                const magicOrTiles = new Map()
                // Populate the magicOrTiles. This needs to be done first because of things like:
                // [ Player ] [ Color ] -> [ Player Color ] [ ]

                // Check that all Cells still match
                for (const x of permutation) {
                    if (!x.doesStillMatch()) {
                        didAllBracketsStillMatch = false
                        break
                    }
                    x.populateMagicOrTiles(magicOrTiles)
                }
                // break if the cells no longer match
                if (!didAllBracketsStillMatch) {
                    continue
                }

                for (const x of permutation) {
                    allMutations.push(x.evaluate(magicOrTiles))
                    if (process.env['NODE_ENV'] === 'development') {
                        this.__incrementCoverage()
                    }
                }

                // Only evaluate once. This is a HACK since it always picks the 1st cell that matched rather than a RANDOM cell
                if (onlyEvaluateFirstMatch) {
                    break // evaluate the subsequent brackets but do not continue evaluating cells
                }

            }

            ret = _.flatten(allMutations)
        }

        // Append any Commands that need to be evaluated (only if the rule was evaluated at least once)
        for (const command of this.commands) {
            ret.push(new CommandMutation(command))
        }
        return ret
    }

    hasMatches(level: Cell[][]) {
        for (let index = 0; index < this.conditionBrackets.length; index++) {
            const condition = this.conditionBrackets[index]
            const action = this.actionBrackets[index]
            if (!condition.hasMatches(level, action)) {
                return false
            }
        }
        return true
    }

    isLate() { return this._isLate }
    hasRigid() { return this.isRigid }

    addCellsToEmptyRules(cells: Iterable<Cell>) {
        for (const bracket of this.conditionBrackets) {
            bracket.addCellsToEmptyRules(cells)
        }
    }

}

// function CELL_COMPARATOR(a: Cell, b: Cell) {
//     return a.rowIndex - b.rowIndex || a.colIndex - b.colIndex
// }

export abstract class ISimpleBracket extends BaseForLines implements ICacheable {
    readonly debugFlag: DEBUG_FLAG
    readonly direction: RULE_DIRECTION
    protected firstCells: Set<Cell>
    private allNeighbors: SimpleNeighbor[]
    constructor(source: IGameCode, direction: RULE_DIRECTION, allNeighbors: SimpleNeighbor[], debugFlag: DEBUG_FLAG) {
        super(source)
        this.direction = direction
        this.debugFlag = debugFlag
        this.allNeighbors = allNeighbors
        this.firstCells = new Set<Cell>()
    }

    abstract subscribeToNeighborChanges(): void
    abstract evaluate(actionBracket: ISimpleBracket, cell: Cell, magicOrTiles: Map<IGameTile, Set<GameSprite>>): IMutation[]
    abstract toKey(ignoreDebugFlag?: boolean): string
    abstract populateMagicOrTiles(cell: Cell, magicOrTiles: Map<IGameTile, Set<GameSprite>>): void
    abstract clearCaches(): void
    abstract prepareAction(action: ISimpleBracket): void
    abstract getNeighbors(): SimpleNeighbor[]
    abstract addCell(index: number, neighbor: SimpleNeighbor, t: SimpleTileWithModifier, sprite: GameSprite, cell: Cell, wantsToMove: Optional<RULE_DIRECTION>): void
    abstract removeCell(index: number, neighbor: SimpleNeighbor, t: SimpleTileWithModifier, sprite: GameSprite, cell: Cell): void
    abstract addCellsToEmptyRules(cells: Iterable<Cell>): void
    abstract getMatches(level: Cell[][], actionBracket: Optional<ISimpleBracket>): MatchedCellsForRule[]

    _getAllNeighbors() {
        return this.allNeighbors
    }
    hasFirstCells() {
        return this.firstCells.size > 0
    }
    getFirstCellsSet(level: Cell[][]) {
        return this.firstCells
    }
    hasMatches(level: Cell[][], actionBracket: Optional<ISimpleBracket>) {
        return this.getMatches(level, actionBracket).length > 0
    }
}


export class SimpleBracket extends ISimpleBracket {
    private neighbors: SimpleNeighbor[]
    protected actionDebugFlag: Optional<DEBUG_FLAG>
    private ellipsisBracketListeners: Map<SimpleEllipsisBracket, BEFORE_OR_AFTER>
    constructor(source: IGameCode, direction: RULE_DIRECTION, neighbors: SimpleNeighbor[], debugFlag: DEBUG_FLAG) {
        super(source, direction, neighbors, debugFlag)
        this.neighbors = neighbors
        this.ellipsisBracketListeners = new Map()
    }
    toKey(ignoreDebugFlag?: boolean) {
        if (ignoreDebugFlag) {
            return `{${this.direction}[${this.neighbors.map(n => n.toKey(ignoreDebugFlag)).join('|')}]}`
        } else {
            return `{${this.direction}[${this.neighbors.map(n => n.toKey(ignoreDebugFlag)).join('|')}]{debugging?${this.debugFlag}}}`
        }
    }

    subscribeToNeighborChanges() {
        this.neighbors.forEach((neighbor, index) => {
            neighbor.subscribeToTileChanges(this, index)
        })
    }

    addEllipsisBracket(bracket: SimpleEllipsisBracket, token: BEFORE_OR_AFTER) {
        this.ellipsisBracketListeners.set(bracket, token)
    }

    clearCaches() {
        this.firstCells.clear()
        for (const neighbor of this.neighbors) {
            neighbor.clearCaches()
        }
    }

    getNeighbors() { return this.neighbors }

    prepareAction(action: ISimpleBracket) {
        const actionBracket = <SimpleBracket> action // since we know the condition and action side need to match
        this.actionDebugFlag = actionBracket.debugFlag
        for (let index = 0; index < this.neighbors.length; index++) {
            const condition = this.neighbors[index]
            const action = actionBracket.neighbors[index]
            condition.prepareAction(action)
        }
    }

    addCellsToEmptyRules(cells: Iterable<Cell>) {
        if (this.neighbors.length === 1) {
            if (this.neighbors[0]._tilesWithModifier.size === 0) {
                for (const cell of cells) {
                    this._addFirstCell(cell)
                }
            }
        }
    }

    evaluate(actionBracket: ISimpleBracket, cell: Cell, magicOrTiles: Map<IGameTile, Set<GameSprite>>) {
        if (process.env['NODE_ENV'] === 'development' && this.actionDebugFlag === DEBUG_FLAG.BREAKPOINT) {
            /*TerminalUI.debugRenderScreen();*/ debugger // pausing here because it is in the code
        }
        const ret: IMutation[] = []
        let curCell: Optional<Cell> = cell
        let index = 0
        for (const neighbor of this.neighbors) {
            if (!curCell) {
                throw new Error(`BUG: Cell is missing`)
            }
            const actionNeighbor = actionBracket.getNeighbors()[index]
            const mutation = neighbor.evaluate(actionNeighbor, curCell, magicOrTiles)
            if (mutation) {
                ret.push(mutation)
            }
            curCell = curCell.getNeighbor(this.direction)
            index++
        }
        return ret
    }

    populateMagicOrTiles(cell: Cell, magicOrTiles: Map<IGameTile, Set<GameSprite>>) {
        let curCell: Optional<Cell> = cell
        for (const neighbor of this.neighbors) {
            if (curCell) {
                neighbor.populateMagicOrTiles(curCell, magicOrTiles)
                curCell = curCell.getNeighbor(this.direction)
            }
        }
    }

    _addFirstCell(firstCell: Cell) {
        if (process.env['NODE_ENV'] === 'development' && this.debugFlag === DEBUG_FLAG.BREAKPOINT) {
            // Pausing here because it was marked in the code
            /*TerminalUI.debugRenderScreen();*/ debugger
        }
        this.firstCells.add(firstCell)
        for (const [ellipsisBracket, token] of this.ellipsisBracketListeners) {
            ellipsisBracket.addFirstCell(this, firstCell, token)
        }
    }

    protected _removeFirstCell(firstCell: Cell) {
        if (this.firstCells.has(firstCell)) {
            if (process.env['NODE_ENV'] === 'development' && this.debugFlag === DEBUG_FLAG.BREAKPOINT_REMOVE) {
                // Pausing here because it was marked in the code
                /*TerminalUI.debugRenderScreen();*/ debugger
            }
            this.firstCells.delete(firstCell)
            for (const [ellipsisBracket, token] of this.ellipsisBracketListeners) {
                ellipsisBracket.removeFirstCell(this, firstCell, token)
            }
        }
    }

    addCell(index: number, neighbor: SimpleNeighbor, t: SimpleTileWithModifier, sprite: GameSprite, cell: Cell, wantsToMove: Optional<RULE_DIRECTION>) {
        // check if downstream neighbors match
        if (!this.matchesDownstream(cell, index)) {
            // Try to remove the match if there is one
            const firstCell = this.getUpstream(cell, index)
            if (firstCell) {
                this._removeFirstCell(cell)
            }
            return
        }
        // Loop Upstream
        // check the neighbors upstream of curCell
        const firstCell = this.matchesUpstream(cell, index)
        if (!firstCell) {
            // Try to remove the match if there is one
            const firstCell = this.getUpstream(cell, index)
            if (firstCell) {
                this._removeFirstCell(firstCell)
            }
            return
        }

        // Add to the set of firstNeighbors
        // We have a match. Add to the firstCells set.
        this._addFirstCell(firstCell)
    }
    removeCell(index: number, neighbor: SimpleNeighbor, t: SimpleTileWithModifier, sprite: GameSprite, cell: Cell) {
        // cell was removed
        // Loop Upstream
        const firstCell = this.getFirstCellToRemove(cell, index)
        // Bracket might not match for all directions (likely not), so we might not find a firstCell to remove
        // But that's OK.
        if (firstCell && this.firstCells.has(firstCell)) {
            this._removeFirstCell(firstCell)
        }
    }

    private matchesDownstream(cell: Cell, index: number) {
        // Check all the neighbors and add the firstNeighbor to the set of matches for this direction
        let matched = true
        let curCell: Optional<Cell> = cell
        // Loop Downstream
        // check the neighbors downstream of curCell
        for (let x = index + 1; x < this.neighbors.length; x++) {
            curCell = curCell.getNeighbor(this.direction)
            // TODO: Convert the neighbor check into a method
            if (curCell && (this.neighbors[x]._tilesWithModifier.size === 0 || this.neighbors[x].matchesCellSimple(curCell))) {
                // keep going
            } else {
                matched = false
                break
            }
        }
        return matched
    }

    private getUpstream(cell: Cell, index: number) {
        let curCell: Optional<Cell> = cell
        for (let x = index - 1; x >= 0; x--) {
            curCell = curCell.getNeighbor(opposite(this.direction))
            if (curCell) {
                // keep going
            } else {
                return null
            }
        }
        return curCell
    }

    private matchesUpstream(cell: Cell, index: number) {
        let matched = true
        let curCell: Optional<Cell> = cell
        // check the neighbors upstream of curCell
        for (let x = index - 1; x >= 0; x--) {
            curCell = curCell.getNeighbor(opposite(this.direction))
            if (curCell && (this.neighbors[x]._tilesWithModifier.size === 0 || this.neighbors[x].matchesCellSimple(curCell))) {
                // keep going
            } else {
                matched = false
                break
            }
        }
        return matched ? curCell : null
    }

    private getFirstCellToRemove(cell: Cell, index: number) {
        // Loop Upstream
        // check the neighbors upstream of curCell
        let matched = true
        let curCell: Optional<Cell> = cell
        // check the neighbors upstream of curCell
        for (let x = index - 1; x >= 0; x--) {
            curCell = curCell.getNeighbor(opposite(this.direction))
            if (curCell) {
                // keep going
            } else {
                matched = false
                break
            }
        }
        return matched ? curCell : null
    }

    getMatches(level: Cell[][], actionBracket: Optional<SimpleBracket>) {
        const matches = []
        for (const row of level) {
            for (const cell of row) {
                if (this.neighbors[0].matchesCellSimple(cell) && this.matchesDownstream(cell, 0)) {
                    const cellMatches = []
                    let curCell: Optional<Cell> = cell
                    let didAllNeighborsMatch = true
                    for (let index = 0; index < this.neighbors.length; index++) {
                        if (!curCell) {
                            didAllNeighborsMatch = false
                            break
                        }
                        const condition = this.neighbors[index]
                        let action
                        // Some rules only contain a condition bracket and a command
                        if (actionBracket) {
                            action = actionBracket.neighbors[index]
                        }
                        const x: MatchedCellAndCorrespondingNeighbors = {
                            cell: curCell,
                            condition,
                            action
                        }
                        cellMatches.push(x)
                        curCell = curCell.getNeighbor(this.direction)
                    }
                    if (didAllNeighborsMatch) {
                        matches.push(new MatchedCellsForRule(cellMatches))
                    }
                }
            }
        }
        return matches
    }
}

type MatchedCellAndCorrespondingNeighbors = {
    cell: Cell,
    condition: SimpleNeighbor,
    action: Optional<SimpleNeighbor>
}

class MatchedCellsForRule {
    readonly cellsAndNeighbors: Iterable<MatchedCellAndCorrespondingNeighbors>
    constructor(cellsAndNeighbors: Iterable<MatchedCellAndCorrespondingNeighbors>) {
        this.cellsAndNeighbors = cellsAndNeighbors
    }

    firstCell() {
        for (const {cell} of this.cellsAndNeighbors) {
            return cell
        }
        throw new Error(`BUG: ? No cells were included in the match`)
    }

    lastCell() {
        let ret
        for (const {cell} of this.cellsAndNeighbors) {
            ret = cell
        }
        if (ret) {
            return ret
        }
        throw new Error(`BUG: ? No cells were included in the match`)
    }

    doesStillMatch() {
        for (const {cell, condition} of this.cellsAndNeighbors) {
            if (!condition.matchesCellSimple(cell)) {
                return false
            }
        }
        return true
    }

    populateMagicOrTiles(magicOrTiles: Map<IGameTile, Set<GameSprite>>) {
        // populate the OR tiles in all neighbors first. Example:
        // [ | Player ] -> [ Player | ]
        for (const {cell, condition} of this.cellsAndNeighbors) {
            condition.populateMagicOrTiles(cell, magicOrTiles)
        }
    }

    evaluate(magicOrTiles: Map<IGameTile, Set<GameSprite>>) {
        const mutations: CellMutation[] = []
        for (const {cell, condition, action} of this.cellsAndNeighbors) {
            if (!action) {
                throw new Error(`BUG: Should not have tried to evaluate something when there is no action`)
            }
            const mutation = condition.evaluate(action, cell, magicOrTiles)
            if (mutation) {
                mutations.push(mutation)
            }
        }
        return mutations
    }
}

export class SimpleBracketConditionOnly extends SimpleBracket {
    constructor(bracket: ISimpleBracket, actionBracket: ISimpleBracket) {
        super(bracket.__source, bracket.direction, bracket._getAllNeighbors(), bracket.debugFlag)
        this.actionDebugFlag = actionBracket.debugFlag
    }
    prepareAction() {
        // nothing to do since it is only a Condition
    }
    evaluate(): IMutation[] {
        if (process.env['NODE_ENV'] === 'development' && this.actionDebugFlag === DEBUG_FLAG.BREAKPOINT) {
            /*TerminalUI.debugRenderScreen();*/ debugger // pausing here because it is in the code
        }
        return []
    }
}

enum BEFORE_OR_AFTER {
    BEFORE,
    AFTER
}

class MultiMap<A, B> {
    private map: Map<A, Set<B>>
    constructor() {
        this.map = new Map()
    }
    clear() {
        this.map.clear()
    }
    has(a: A, b: B) {
        const set = this.map.get(a)
        if (set) {
            return set.has(b)
        }
        return false
    }
    protected /*unused*/ hasA(a: A) {
        return this.map.has(a)
    }
    protected /*unused*/ hasB(b: B) {
        return !!this.getA(b)
    }
    protected /*unused*/ getA(b: B) {
        const ret = new Set()
        for (const [a, set] of this.map) {
            if (set.has(b)) {
                ret.add(a)
            }
        }
        if (ret.size > 0) {
            return ret
        }
        return undefined
    }
    getB(a: A) {
        return this.map.get(a)
    }
    add(a: A, b: B) {
        let set = this.map.get(a)
        if (!set) {
            set = new Set()
            this.map.set(a, set)
        }
        if (!set.has(b)) {
            set.add(b)
            return true
        }
        return false
    }
    deleteAllA(a: A) {
        this.map.delete(a)
    }
    deleteAllB(b: B) {
        const asRemoved = new Set()
        for (const [a, set] of this.map) {
            if (set.has(b)) {
                set.delete(b)
                if (set.size === 0) {
                    this.map.delete(a)
                    asRemoved.add(a)
                }
            }
        }
        return asRemoved
    }
    delete(a: A, b: B) {
        const set = this.map.get(a)
        if (set) {
            if (!set.has(b)) {
                throw new Error(`BUG: Invariant error. Link did not exist so nothing to remove`)
            }
            set.delete(b)
        }
    }
    protected /*unused*/ size() {
        let size = 0
        for (const set of this.map.values()) {
            size += set.size
        }
        return size
    }
    sizeA() {
        return this.map.size
    }
}

export class SimpleEllipsisBracket extends ISimpleBracket {
    private beforeEllipsisBracket: SimpleBracket
    private afterEllipsisBracket: SimpleBracket
    private linkages: MultiMap<Cell, Cell> // 1 before may have many afters
    private actionDebugFlag: Optional<DEBUG_FLAG>
    constructor(source: IGameCode, direction: RULE_DIRECTION, beforeEllipsisNeighbors: SimpleNeighbor[], afterEllipsisNeighbors: SimpleNeighbor[], debugFlag: DEBUG_FLAG) {
        super(source, direction, [...beforeEllipsisNeighbors, ...afterEllipsisNeighbors], debugFlag)
        this.beforeEllipsisBracket = new SimpleBracket(source, direction, beforeEllipsisNeighbors, debugFlag)
        this.afterEllipsisBracket = new SimpleBracket(source, direction, afterEllipsisNeighbors, debugFlag)
        this.linkages = new MultiMap()
    }
    subscribeToNeighborChanges() {
        this.beforeEllipsisBracket.subscribeToNeighborChanges()
        this.afterEllipsisBracket.subscribeToNeighborChanges()
        this.beforeEllipsisBracket.addEllipsisBracket(this, BEFORE_OR_AFTER.BEFORE)
        this.afterEllipsisBracket.addEllipsisBracket(this, BEFORE_OR_AFTER.AFTER)
    }
    toKey(ignoreDebugFlag?: boolean) {
        return `[${this.beforeEllipsisBracket.toKey(ignoreDebugFlag)} ... ${this.afterEllipsisBracket.toKey(ignoreDebugFlag)}]}`
    }
    getNeighbors() {
        // throw new Error(`BUG: Should not be calling this method`)
        return [] // TODO: Implement me
    }

    private checkInvariants() {
        if (this.firstCells.size !== this.linkages.sizeA()) {
            debugger; throw new Error(`BUG: Invariant violation`)
        }
    }

    clearCaches() {
        this.firstCells.clear()
        this.linkages.clear()
        this.beforeEllipsisBracket.clearCaches()
        this.afterEllipsisBracket.clearCaches()
    }
    populateMagicOrTiles(cell: Cell, magicOrTiles: Map<IGameTile, Set<GameSprite>>) {
        const firstAfters = this.linkages.getB(cell)
        if (!firstAfters) {
            throw new Error(`BUG: Should have a match at this point since the rule is evaluating`)
        }
        this.beforeEllipsisBracket.populateMagicOrTiles(cell, magicOrTiles)
        for (const firstAfter of firstAfters) {
            this.afterEllipsisBracket.populateMagicOrTiles(firstAfter, magicOrTiles)
        }
    }
    prepareAction(action: ISimpleBracket) {
        const actionBracket = <SimpleEllipsisBracket> action // since we know the condition and action side need to match
        this.beforeEllipsisBracket.prepareAction(actionBracket.beforeEllipsisBracket)
        this.afterEllipsisBracket.prepareAction(actionBracket.afterEllipsisBracket)
        this.actionDebugFlag = actionBracket.debugFlag
    }
    addCellsToEmptyRules(cells: Iterable<Cell>) {
        this.beforeEllipsisBracket.addCellsToEmptyRules(cells)
        this.afterEllipsisBracket.addCellsToEmptyRules(cells)
    }
    evaluate(actionBracket: ISimpleBracket, cell: Cell, magicOrTiles: Map<IGameTile, Set<GameSprite>>) {
        if (process.env['NODE_ENV'] === 'development' && this.actionDebugFlag === DEBUG_FLAG.BREAKPOINT) {
            /*TerminalUI.debugRenderScreen();*/ debugger // pausing here because it is in the code
        }
        const action = <SimpleEllipsisBracket> actionBracket
        const firstBeforeCell = cell
        const firstAfterCells = this.linkages.getB(firstBeforeCell)
        if (!firstAfterCells) {
            throw new Error(`BUG: Could not find matching afterCell`)
        }

        let allMutations: IMutation[] = []
        const beforeMutations = this.beforeEllipsisBracket.evaluate(action.beforeEllipsisBracket, firstBeforeCell, magicOrTiles)
        allMutations = allMutations.concat(beforeMutations)
        for (const firstAfterCell of firstAfterCells) {
            const afterMutations = this.afterEllipsisBracket.evaluate(action.afterEllipsisBracket, firstAfterCell, magicOrTiles)
            allMutations = allMutations.concat(afterMutations)
        }
        return allMutations
    }


    addCell(index: number, neighbor: SimpleNeighbor, t: SimpleTileWithModifier, sprite: GameSprite, cell: Cell, wantsToMove: Optional<RULE_DIRECTION>) {
        throw new Error(`BUG: We should not be subscribed to these events`)
    }
    removeCell(index: number, neighbor: SimpleNeighbor, t: SimpleTileWithModifier, sprite: GameSprite, cell: Cell) {
        throw new Error(`BUG: We should not be subscribed to these events`)
    }

    addFirstCell(bracket: SimpleBracket, firstCell: Cell, token: BEFORE_OR_AFTER) {
        // // check to see if the new cell is in line with any firstCells in the other bracket. If so, we have a match!
        // let firstBeforeCells
        // let firstAfterCells
        // if (bracket == this.beforeEllipsisBracket) {
        //     firstBeforeCells = new Set([firstCell])
        //     // search for a matching afterCell
        //     firstAfterCells = this.findMatching(firstCell, this.direction, this.afterEllipsisBracket)
        // } else if (bracket === this.afterEllipsisBracket) {
        //     firstAfterCells = new Set([firstCell])
        //     // search for a matching beforeCell
        //     firstBeforeCells = this.findMatching(firstCell, opposite(this.direction), this.beforeEllipsisBracket)
        // } else {
        //     throw new Error(`BUG: Bracket should only ever be the before-ellipsis or after-ellipsis one`)
        // }

        // for (const firstBeforeCell of firstBeforeCells) {
        //     for (const firstAfterCell of firstAfterCells) {
        //         this.checkInvariants()
        //         // Check if we need to actually change anything first. Becauase the !doesEvaluationOrderMatter case
        //         // keeps iterating on the set of firstCells but if they keep flipping then it's a problem because it
        //         // runs in an infinite loop

        //         // Delete any mapping that may have existed before
        //         if (this.linkages.has(firstBeforeCell, firstAfterCell)) {
        //             // nothing to do. we already have those entries
        //         } else {
        //             this.linkages.add(firstBeforeCell, firstAfterCell)
        //             this.firstCells.add(firstBeforeCell)
        //         }
        //         this.checkInvariants()

        //     }
        // }
    }
    removeFirstCell(bracket: SimpleBracket, firstCell: Cell, token: BEFORE_OR_AFTER) {
        // Figure out the 1st cell for us and remove it (by maybe looking at the matching bracket)
        this.checkInvariants()
        if (bracket == this.beforeEllipsisBracket) {
            this.linkages.deleteAllA(firstCell)
            if (this.firstCells.has(firstCell)) {
                this.firstCells.delete(firstCell)
            } else {
                // console.warn('Removing firstCell but it has already been removed')
                // console.warn(this.toString())
            }
        } else if (bracket === this.afterEllipsisBracket) {
            const beforeCellsRemoved = this.linkages.deleteAllB(firstCell)
            for (const b of beforeCellsRemoved) {
                this.firstCells.delete(b)
            }
        } else {
            throw new Error(`BUG: Bracket should only ever be the before-ellipsis or after-ellipsis one`)
        }
        this.checkInvariants()
    }

    // private findMatching(cell: Cell, direction: RULE_DIRECTION, inBracket: SimpleBracket): Set<Cell> {
    //     throw new Error(`BUG: Ellipses not implemented yet`)
    //     // const matches = new Set()
    //     // for (const inBracketCell of inBracket.getFirstCellsSet()) {
    //     //     switch (direction) {
    //     //         case RULE_DIRECTION.UP:
    //     //             if (cell.colIndex === inBracketCell.colIndex && cell.rowIndex > inBracketCell.rowIndex) {
    //     //                 matches.add(inBracketCell)
    //     //             }
    //     //             break
    //     //         case RULE_DIRECTION.DOWN:
    //     //             if (cell.colIndex === inBracketCell.colIndex && cell.rowIndex < inBracketCell.rowIndex) {
    //     //                 matches.add(inBracketCell)
    //     //             }
    //     //             break
    //     //         case RULE_DIRECTION.LEFT:
    //     //             if (cell.colIndex > inBracketCell.colIndex && cell.rowIndex === inBracketCell.rowIndex) {
    //     //                 matches.add(inBracketCell)
    //     //             }
    //     //             break
    //     //         case RULE_DIRECTION.RIGHT:
    //     //             if (cell.colIndex < inBracketCell.colIndex && cell.rowIndex === inBracketCell.rowIndex) {
    //     //                 matches.add(inBracketCell)
    //     //             }
    //     //             break
    //     //         default:
    //     //             throw new Error(`BUG: Invalid direction`)
    //     //     }
    //     // }
    //     // return matches
    // }

    getMatches(level: Cell[][], actionBracket: SimpleEllipsisBracket): MatchedCellsForRule[] {
        const ret: MatchedCellsForRule[] = []
        const beforeMatches = this.beforeEllipsisBracket.getMatches(level, actionBracket.beforeEllipsisBracket)
        const afterMatches = this.afterEllipsisBracket.getMatches(level, actionBracket.afterEllipsisBracket)
        const beforeMatchesByIndex = new MultiMap<number, MatchedCellsForRule>()

        if (beforeMatches.length === 0 || afterMatches.length === 0) {
            return ret
        }

        switch (this.direction) {
            case RULE_DIRECTION.UP:
            case RULE_DIRECTION.DOWN:
                for (const beforeMatch of beforeMatches) {
                    beforeMatchesByIndex.add(beforeMatch.lastCell().colIndex, beforeMatch)
                }
                for (const afterMatch of afterMatches) {
                    const {colIndex, rowIndex} = afterMatch.firstCell()
                    for (const beforeMatch of beforeMatchesByIndex.getB(colIndex) || []) {
                        // check if the afterMatch matches it.
                        // If so, remove the beforeMatch and include the whole match
                        const {rowIndex: beforeRowIndex} = beforeMatch.lastCell()
                        const isAfter = (this.direction === RULE_DIRECTION.DOWN) ? beforeRowIndex < rowIndex : rowIndex < beforeRowIndex
                        if (isAfter) {
                            ret.push(new MatchedCellsForRule([...beforeMatch.cellsAndNeighbors].concat([...afterMatch.cellsAndNeighbors])))
                            // beforeMatchesByIndex.delete(colIndex, beforeMatch)
                        }
                    }
                }
                break
            case RULE_DIRECTION.LEFT:
            case RULE_DIRECTION.RIGHT:
                for (const beforeMatch of beforeMatches) {
                    beforeMatchesByIndex.add(beforeMatch.lastCell().rowIndex, beforeMatch)
                }
                for (const afterMatch of afterMatches) {
                    const {rowIndex, colIndex} = afterMatch.firstCell()
                    for (const beforeMatch of beforeMatchesByIndex.getB(rowIndex) || []) {
                        // check if the afterMatch matches it.
                        // If so, remove the beforeMatch and include the whole match
                        const {colIndex: beforeColIndex} = beforeMatch.lastCell()
                        const isAfter = (this.direction === RULE_DIRECTION.RIGHT) ? beforeColIndex < colIndex : colIndex < beforeColIndex
                        if (isAfter) {
                            ret.push(new MatchedCellsForRule([...beforeMatch.cellsAndNeighbors].concat([...afterMatch.cellsAndNeighbors])))
                            // beforeMatchesByIndex.delete(rowIndex, beforeMatch)
                        }
                    }
                }
                break
            default:
                throw new Error(`BUG: Invalid direction ${this.direction}`)
        }

        return ret
    }

}

class ReplaceTile {
    private collisionLayer: CollisionLayer
    private actionTileWithModifier: Optional<SimpleTileWithModifier>
    private mightNotFindConditionButThatIsOk: boolean
    private conditionSpritesToRemove: Optional<SimpleTileWithModifier>
    constructor(collisionLayer: CollisionLayer, actionTileWithModifier: Optional<SimpleTileWithModifier>, mightNotFindConditionButThatIsOk: boolean, conditionSpritesToRemove: Optional<SimpleTileWithModifier>) {
        if (!collisionLayer) {
            throw new Error('BUG: collisionLayer is not set')
        }
        this.collisionLayer = collisionLayer
        this.actionTileWithModifier = actionTileWithModifier
        this.mightNotFindConditionButThatIsOk = mightNotFindConditionButThatIsOk
        this.conditionSpritesToRemove = conditionSpritesToRemove
    }
    replace(cell: Cell, magicOrTiles: Map<IGameTile, Set<GameSprite>>, orTilesRemoved: Set<IGameTile>) {
        let didActuallyChange = false
        // Check if we are adding or removing....
        if (this.actionTileWithModifier) {
            // adding

            let sprites: Iterable<GameSprite>
            // if RANDOM is set then pick a random sprite to add
            if (this.actionTileWithModifier.isRandom()) {
                const spritesToChoose = this.actionTileWithModifier._tile.getSprites()
                const rnd = nextRandom(spritesToChoose.length)
                sprites = [spritesToChoose[rnd]]
            } else if (this.actionTileWithModifier._tile.isOr()) {
                // There is no sprite of this type already in the cell. It's in the magicOrTiles
                const s = magicOrTiles.get(this.actionTileWithModifier._tile)
                if (!s) {
                    debugger
                    console.log(`BUG: Magic OR tile not found`)
                    console.log(this.actionTileWithModifier.toString())
                    throw new Error(`BUG: Magic OR tile not found`)
                }
                sprites = s
            } else {
                sprites = this.actionTileWithModifier._tile.getSprites()
            }
            for (const sprite of sprites) {
                const c = sprite.getCollisionLayer()
                const added = cell.addSprite(sprite, cell.getCollisionLayerWantsToMove(c)) // preserve the wantsToMove if the sprite is in the same collision layer
                didActuallyChange = didActuallyChange || added
            }
        } else {
            // removing
            const tile = cell.getSpriteByCollisionLayer(this.collisionLayer)
            if (!tile && this.mightNotFindConditionButThatIsOk) {
                // this occurs when there is just a -> [ NO Color ] on the action side (remove color if it exists)
                return {actuallyDidChange: false}
            }
            if (!tile) {
                throw new Error(`BUG: No tile found`)
            }
            if (this.conditionSpritesToRemove) {
                // For OR tiles we need to only remove one of the sprites, not ALL of the sprites
                if (this.conditionSpritesToRemove._tile.isOr()) {
                    if (! orTilesRemoved.has(this.conditionSpritesToRemove._tile)) {
                        // only remove the sprites in the cell that match the condition... not all the sprites in a collisionLayer
                        const cellSprites = tile.getSprites()
                        for (const conditionSpriteToRemove of this.conditionSpritesToRemove._tile.getSprites()) {
                            if (cellSprites.indexOf(conditionSpriteToRemove) >= 0) {
                                const removed = cell.removeSprite(conditionSpriteToRemove)
                                didActuallyChange = didActuallyChange || removed

                                if (removed) {
                                    orTilesRemoved.add(this.conditionSpritesToRemove._tile)
                                }
                                break
                            }
                        }
                    }
                } else {
                    // only remove the sprites in the cell that match the condition... not all the sprites in a collisionLayer
                    const conditionSpritesToRemove = new Set(this.conditionSpritesToRemove._tile.getSprites())
                    for (const sprite of tile.getSprites()) {
                        if (conditionSpritesToRemove.has(sprite)) {
                            const removed = cell.removeSprite(sprite)
                            didActuallyChange = didActuallyChange || removed
                        }
                    }
                }

            } else {
                // remove all sprites
                for (const sprite of tile.getSprites()) {
                    const removed = cell.removeSprite(sprite)
                    didActuallyChange = didActuallyChange || removed
                }
            }
        }
        // return the oldSprite for UNDO
        return {
            didActuallyChange
        }
    }
}

class ReplaceDirection {
    private collisionLayer: CollisionLayer
    private direction: Optional<RULE_DIRECTION>
    private mightNotFindConditionButThatIsOk: boolean
    constructor(collisionLayer: CollisionLayer, direction: Optional<RULE_DIRECTION>, mightNotFindConditionButThatIsOk: boolean) {
        if (!collisionLayer) {
            throw new Error('BUG: collisionLayer is not set')
        }
        this.collisionLayer = collisionLayer
        this.direction = direction
        this.mightNotFindConditionButThatIsOk = mightNotFindConditionButThatIsOk
    }
    replace(cell: Cell) {
        let direction = this.direction
        // It's OK if this sprite is not in the condition. This happens when an OR action tile has sprites that are in multiple collision layers
        if (this.mightNotFindConditionButThatIsOk && !cell.getSpriteByCollisionLayer(this.collisionLayer)) {
            return false
        }

        // Pick a random direction
        if (this.direction === RULE_DIRECTION.RANDOMDIR) {
            // only set the direction if one has not already been set
            if (cell.getCollisionLayerWantsToMove(this.collisionLayer) === RULE_DIRECTION.STATIONARY) {
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
            } else {
                // a direction was already set
                return false
            }
        }
        if (direction) {
            return cell.setWantsToMoveCollisionLayer(this.collisionLayer, direction)
        } else {
            return false
        }
    }
}


export class SimpleNeighbor extends BaseForLines implements ICacheable {
    readonly _tilesWithModifier: Set<SimpleTileWithModifier>
    private brackets: Map<ISimpleBracket, Set<number>>
    private debugFlag: DEBUG_FLAG

    private staticCache: Map<SimpleNeighbor, {replaceTiles: Set<ReplaceTile>, replaceDirections: Set<ReplaceDirection>}>
    private cacheYesBitSets: Map<CollisionLayer, BitSet>
    private cacheNoBitSets: Map<CollisionLayer, BitSet>
    private cacheDirections: Map<CollisionLayer, RULE_DIRECTION>
    private cacheMultiCollisionLayerTiles: Set<SimpleTileWithModifier>

    private spritesPresent: SpriteBitSet
    private spritesMissing: SpriteBitSet
    private anySpritesPresent: Set<SpriteBitSet>
    private spriteMovementsPresent: Map<CollisionLayer, RULE_DIRECTION>
    private orTileMovementsPresent: Map<IGameTile, RULE_DIRECTION>
    private lruCache: LruCache<string, boolean>

    constructor(source: IGameCode, tilesWithModifier: Set<SimpleTileWithModifier>, debugFlag: DEBUG_FLAG) {
        super(source)
        // this.alreadyReportedMismatch = false
        this._tilesWithModifier = tilesWithModifier
        this.brackets = new Map()
        // this._localCellCache = new Map()
        this.debugFlag = debugFlag

        this.staticCache = new Map()

        this.spritesPresent = new SpriteBitSet()
        this.spritesMissing = new SpriteBitSet()
        this.anySpritesPresent = new Set<SpriteBitSet>()
        this.spriteMovementsPresent = new Map()
        this.orTileMovementsPresent = new Map()
        this.lruCache = new LruCache<string, boolean>(LRU_CACHE_SIZE)

        // Build up the cache BitSet for each collisionLayer
        this.cacheYesBitSets = new Map()
        this.cacheNoBitSets = new Map()
        this.cacheDirections = new Map()
        this.cacheMultiCollisionLayerTiles = new Set()
        const allTiles = [...tilesWithModifier]
        const noTiles = allTiles.filter(t => t.isNo())
        const yesTiles = allTiles.filter(t => !t.isNo())

        for (const t of yesTiles) {
            if (!t._tile) {
                continue // ellipsis
            } else if (t._tile.hasSingleCollisionLayer()) {
                for (const sprite of t._tile.getSprites()) {
                    const c = sprite.getCollisionLayer()
                    if (t._direction) {
                        this.cacheDirections.set(c, t._direction)
                    }
                    let yesBitSet = this.cacheYesBitSets.get(c)
                    if (!yesBitSet) {
                        yesBitSet = <BitSet> new BitSet2()
                        this.cacheYesBitSets.set(c, yesBitSet)
                    }
                    yesBitSet.set(c.getBitSetIndexOf(sprite))
                }
            } else {
                this.cacheMultiCollisionLayerTiles.add(t)
            }

            if (t._tile.isOr()) {
                this.anySpritesPresent.add(new SpriteBitSet(t._tile.getSprites()))
                if (t._direction) {
                    this.orTileMovementsPresent.set(t._tile, t._direction)
                }
            } else {
                this.spritesPresent.addAll(t._tile.getSprites())
                for (const sprite of t._tile.getSprites()) {
                    if (t._direction) {
                        const prevDir = this.spriteMovementsPresent.get(sprite.getCollisionLayer())
                        if (prevDir && prevDir !== t._direction) {
                            throw new Error(`BUG??? prev=${prevDir} ${t._direction}`)
                        }
                        this.spriteMovementsPresent.set(sprite.getCollisionLayer(), t._direction)
                    }
                }
            }
        }

        for (const t of noTiles) {
            if (t._tile.hasSingleCollisionLayer()) {
                for (const sprite of t._tile.getSprites()) {
                    const c = sprite.getCollisionLayer()
                    if (t._direction) {
                        this.cacheDirections.set(c, t._direction)
                    }
                    let noBitSet = this.cacheNoBitSets.get(c)
                    if (!noBitSet) {
                        noBitSet = <BitSet> new BitSet2()
                        this.cacheNoBitSets.set(c, noBitSet)
                    }
                    noBitSet.set(c.getBitSetIndexOf(sprite))
                }
            } else {
                this.cacheMultiCollisionLayerTiles.add(t)
            }

            if (t._tile.isOr()) {
                // NO Color === NO Red NO Green NO Blue
                this.spritesMissing.addAll(t._tile.getSprites())
            } else {
                this.spritesMissing.addAll(t._tile.getSprites())
            }
        }

        // NOTE: BitSets can be empty. Especially when checking that a Cell does NOT contain a sprite
        // for (const [collisionLayer, bitSet] of this._cacheBitSets) {
        //     if (bitSet.isEmpty()) {
        //         throw new Error(`BUG: BitSets should never be empty. "${bitSet.toString()}"`)
        //     }
        // }

    }
    toKey(ignoreDebugFlag?: boolean) {
        if (ignoreDebugFlag) {
            return `{${[...this._tilesWithModifier].map(t => t.toKey(ignoreDebugFlag)).sort().join(' ')}}`
        } else {
            return `{${[...this._tilesWithModifier].map(t => t.toKey(ignoreDebugFlag)).sort().join(' ')} debugging?${this.debugFlag}}`
        }
    }

    prepareAction(actionNeighbor: SimpleNeighbor) {
        if (process.env['NODE_ENV'] === 'development' && actionNeighbor.debugFlag === DEBUG_FLAG.BREAKPOINT) {
            // Pausing here because this breakpoint was marked in the game code
            debugger
        }

        if (this.staticCache.has(actionNeighbor)) {
            return
        }

        // Compute the Mutators on-the-fly for now....
        const pairsByCollisionLayer = new Map<CollisionLayer, ExtraPair<SimpleTileWithModifier>>()
        const orTiles = new Map<IGameTile, SimpleTileWithModifier>()
        for (const t of this._tilesWithModifier) {
            if (t._tile.isOr() && !t._tile.hasSingleCollisionLayer()) {
                if (!t.isNo()) {
                    orTiles.set(t._tile, t)
                }
            } else {
                // AND Tiles can have multiple collisionLayers too...
                if (t._tile.hasSingleCollisionLayer()) {
                    const c = t._tile.getCollisionLayer()
                    if (!c) {
                        console.log(t._tile.toString())
                        throw new Error(`BUG: Tile is not assigned to a collision layer`)
                    }
                    // If we have something like `[Player NO PlayerHold] -> ...` then keep the Player, not the PlayerHold
                    if (pairsByCollisionLayer.has(c)) {
                        // Determine whether to keep the 1st match or the current one.
                        // If the current one is a NO tile then definitely do not replace it.
                        // Maybe the correct thing to do is to always keep the 1st thing put in
                        // if (!t.isNo()) {
                        //     pairsByCollisionLayer.set(c, new ExtraPair<SimpleTileWithModifier>(t, null/*filled in later if there is an action*/, false/*okToIgnoreNonMatches*/))
                        // }
                    } else {
                        pairsByCollisionLayer.set(c, new ExtraPair<SimpleTileWithModifier>(t, null/*filled in later if there is an action*/, false/*okToIgnoreNonMatches*/))
                    }
                } else {
                    // loop over each collisionLayer
                    for (const sprite of t._tile.getSprites()) {
                        const c = sprite.getCollisionLayer()
                        if (!pairsByCollisionLayer.has(c)) {
                            // TODO: Should we ues the whole tileWithModifier or create a new one out of the sprite?
                            pairsByCollisionLayer.set(c, new ExtraPair<SimpleTileWithModifier>(t, null/*filled in later if there is an action*/, false/*okToIgnoreNonMatches*/))
                        }
                    }
                }
            }
        }

        // First just pair up all the conditions and actions (keep the negations)
        // Then, remove all negations
        // Then, build the ReplaceTile and ReplaceDirections
        const unmatchedOrTiles = new Map(orTiles.entries())
        for (const t of actionNeighbor._tilesWithModifier) {
            if (t._tile.isOr() && !t._tile.hasSingleCollisionLayer()) {
                // OR tiles may belong to different collisionlayers so... it's complicated
                const orTile = orTiles.get(t._tile)
                if (orTile) {
                    unmatchedOrTiles.delete(t._tile)
                    // simple case. at most we just change direction
                    const conditionT = orTile
                    if (conditionT._direction !== t._direction) {
                        for (const sprite of t._tile.getSprites()) {
                            const c =  sprite.getCollisionLayer()
                            if (!pairsByCollisionLayer.has(c)) {
                                pairsByCollisionLayer.set(c, new ExtraPair<SimpleTileWithModifier>(
                                    new SimpleTileWithModifier(conditionT.__source, conditionT._isNegated /*since the action side is a NO */, conditionT._isRandom/*isRandom*/, conditionT._direction, sprite, conditionT._debugFlag),
                                    new SimpleTileWithModifier(t.__source, t._isNegated /*since the action side is a NO */, t._isRandom/*isRandom*/, t._direction, sprite, t._debugFlag),
                                    true/*okToIgnoreNonMatches*/))
                            }
                        }
                    }
                } else {
                    if (t.isNo()) {
                        for (const sprite of t._tile.getSprites()) {
                            const c =  sprite.getCollisionLayer()
                            if (pairsByCollisionLayer.has(c)) {
                            } else {
                                pairsByCollisionLayer.set(c, new ExtraPair<SimpleTileWithModifier>(new SimpleTileWithModifier(t.__source, false /*since the action side is a NO */, t._isRandom/*isRandom*/, t._direction, t._tile, t._debugFlag), null, true/*okToIgnoreNonMatches*/))
                            }
                        }
                    } else {
                        for (const sprite of t._tile.getSprites()) {
                            const c =  sprite.getCollisionLayer()
                            if (pairsByCollisionLayer.has(c)) {
                            } else {
                                pairsByCollisionLayer.set(c, new ExtraPair<SimpleTileWithModifier>(null, new SimpleTileWithModifier(t.__source, false /*since the action side is NOT? NO */, t._isRandom/*isRandom*/, t._direction, t._tile, t._debugFlag), true/*okToIgnoreNonMatches*/))
                            }
                        }
                    }
                }
            } else {
                for (const c of t.getCollisionLayers()) {
                    if (!c) {
                        console.log(t._tile.toString())
                        throw new Error(`BUG: Tile is not assigned to a collision layer`)
                    }
                    // if the condition is the same as the action then it's a no-op and we can remove the code
                    const p = pairsByCollisionLayer.get(c)
                    const conditionVersion = (p && p.condition) || null
                    if (conditionVersion && conditionVersion.equals(t)) {
                        // condition and action are the same. No need to add a Pair
                        pairsByCollisionLayer.delete(c)
                    } else {
                        if (t.isNo()) {
                            // set it to be null (removed)
                            const p = pairsByCollisionLayer.get(c)
                            if (p) {
                                // just leave the action side as null (so it's removed)
                                if (p.condition === t) {
                                    // remove if both the condition and action are the same
                                    pairsByCollisionLayer.delete(c)
                                }
                            } else {
                                // we need to set the condition side to be the tile so that it is removed
                                // (it might not exist in the cell though but that's an optimization for later)
                                pairsByCollisionLayer.set(c, new ExtraPair<SimpleTileWithModifier>(new SimpleTileWithModifier(t.__source, false /*since the action side is a NO */, false/*isRandom*/, t._direction, t._tile, t._debugFlag), null, true/*okToIgnoreNonMatches*/))
                            }
                        } else {
                            const p = pairsByCollisionLayer.get(c)
                            if (p) {
                                p.action = t
                            } else {
                                pairsByCollisionLayer.set(c, new ExtraPair<SimpleTileWithModifier>(null, t, false/*okToIgnoreNonMatches*/))
                            }
                        }
                    }

                }
            }
        }

        // Any unmatched OR tiles need to be removed from the Cell
        if (unmatchedOrTiles.size > 0) {
            for (const t of unmatchedOrTiles.values()) {
                for (const sprite of t._tile.getSprites()) {
                    const c = sprite.getCollisionLayer()
                    if (!pairsByCollisionLayer.has(c)) {
                        pairsByCollisionLayer.set(c, new ExtraPair<SimpleTileWithModifier>(new SimpleTileWithModifier(t.__source, false /*since the action side is a NO */, false/*isRandom*/, t._direction, t._tile, t._debugFlag), null, true/*okToIgnoreNonMatches*/))
                    }
                }
            }
        }

        const replaceTiles = new Set<ReplaceTile>()
        const replaceDirections = new Set<ReplaceDirection>()

        for (const [collisionLayer, {condition, action, extra}] of pairsByCollisionLayer.entries()) {
            if (condition && action) {
                if (condition !== action) { // Could be `[ TrolleyFull no CleanDishes] -> [TrolleyEmpty no CleanDishes ]`
                    if (!condition._tile.equals(action._tile) || condition.isNo()) {
                        replaceTiles.add(new ReplaceTile(collisionLayer, action, extra, null))
                    }
                    if (condition._direction !== action._direction) {
                        replaceDirections.add(new ReplaceDirection(collisionLayer, action._direction || RULE_DIRECTION.STATIONARY, extra))
                    } else if (condition.isNo()) {
                        replaceDirections.add(new ReplaceDirection(collisionLayer, action._direction || RULE_DIRECTION.STATIONARY, extra))
                    }
                }
            } else if (condition) {
                if (!condition.isNo()) {
                    replaceTiles.add(new ReplaceTile(collisionLayer, null, extra, condition))
                    replaceDirections.add(new ReplaceDirection(collisionLayer, null, extra))
                }
            } else if (action) {
                if (!action.isNo()) {
                    replaceTiles.add(new ReplaceTile(collisionLayer, action, extra, null))
                    replaceDirections.add(new ReplaceDirection(collisionLayer, action._direction || RULE_DIRECTION.STATIONARY, extra))
                }
            }
        }

        this.staticCache.set(actionNeighbor, {replaceTiles, replaceDirections})
    }

    evaluate(actionNeighbor: SimpleNeighbor, cell: Cell, magicOrTiles: Map<IGameTile, Set<GameSprite>>) {
        if (process.env['NODE_ENV'] === 'development' && actionNeighbor.debugFlag === DEBUG_FLAG.BREAKPOINT) {
            // Pausing here because this breakpoint was marked in the game code
            /*TerminalUI.debugRenderScreen();*/ debugger
        }

        let r = this.staticCache.get(actionNeighbor)
        if (!r) {
            this.prepareAction(actionNeighbor)
            r = this.staticCache.get(actionNeighbor)
        }
        if (!r) {
            throw new Error('BUG: Missing actionNeighbor. Should have been prepared before')
        }
        const {replaceTiles, replaceDirections} = r

        let didChangeSprites = false
        let didChangeDirection = false
        const orTilesRemoved = new Set()
        for (const replaceTile of replaceTiles) {
            const {didActuallyChange} = replaceTile.replace(cell, magicOrTiles, orTilesRemoved)
            didChangeSprites = didChangeSprites || didActuallyChange || false
        }
        for (const replaceDirection of replaceDirections) {
            const didActuallyChange = replaceDirection.replace(cell)
            didChangeDirection = didChangeDirection || didActuallyChange
        }

        // TODO: Be better about recording when the cell actually updated
        if (didChangeSprites || didChangeDirection) {
            return new CellMutation(cell, didChangeSprites)
        } else {
            return null
        }

    }

    clearCaches() {
        // this._localCellCache.clear()
        for (const t of this._tilesWithModifier) {
            t.clearCaches()
        }
    }

    // set this ahead of time becuase order does not matter when populating the magicOrTiles `[ > Player | Pill ] -> [ Pill OldPos | Player ]`
    populateMagicOrTiles(cell: Cell, magicOrTiles: Map<IGameTile, Set<GameSprite>>) {
        for (const t of this._tilesWithModifier) {
            if (!t.isNo() && t._tile.isOr()) {
                const sprites = setIntersection(new Set(t._tile.getSprites()), cell.getSpritesAsSet())
                magicOrTiles.set(t._tile, sprites)
            }
        }
    }

    subscribeToTileChanges(bracket: ISimpleBracket, index: number) {
        // add the bracket and then subscribe the tiles
        let b = this.brackets.get(bracket)
        if (!b) {
            b = new Set()
            this.brackets.set(bracket, b)
        }
        b.add(index)

        this._tilesWithModifier.forEach(t => {
            t.subscribeToCellChanges(this)
        })
    }

    matchesCellSimple(cell: Cell) {
        return this.matchesCell(cell, null, null)
    }
    private matchesCell(cell: Cell, tileWithModifier: Optional<SimpleTileWithModifier>, wantsToMove: Optional<RULE_DIRECTION>) {
        // let doesMatch = false
        // Prepare the bit vectors (does not count against us in the timing)
        // const collisionLayersToCheck = new Set<CollisionLayer>()
        // Compare using bit vectors
        // const cellVectors = new Map()
        // for (const c of cell.getCollisionLayers()) {
        //     const sprite = cell.getSpriteByCollisionLayer(c)
        //     if (sprite) {
        //         const bitSet = sprite.getBitSet()
        //         cellVectors.set(c, bitSet)
        //     }
        // }

        // doesMatch = true

        // for (const t of this.cacheMultiCollisionLayerTiles) {
        //     if (!t.matchesCellWithoutDirection(cell)) {
        //         doesMatch = false
        //         break
        //     }
        //     // check the direction as well
        //     let matchesDirection = false
        //     if (t.isNo()) {
        //         // no games have "NO" and a Direction. Let's make sure
        //         if (t._direction) {
        //             throw new Error(`BUG: Invariant vfailed. Assumed NO tiles should never have a direction associated with them`)
        //         }
        //         matchesDirection = true

        //     } else {
        //         for (const sprite of t._tile.getSprites()) {
        //             const c = sprite.getCollisionLayer()
        //             let cellDirection = cell.getCollisionLayerWantsToMove(c) || RULE_DIRECTION.STATIONARY
        //             if (cell.hasSprite(sprite)) {
        //                 if (!t._direction || cellDirection === t._direction) {
        //                     matchesDirection = true
        //                     break
        //                 }
        //             }
        //         }
        //     }
        //     if (!matchesDirection) {
        //         doesMatch = false
        //         break
        //     }
        // }

        // if (doesMatch) {
        //     for (const [collisionLayer, tileBitSet] of this.cacheYesBitSets) {
        //         if (cellVectors.has(collisionLayer)) {
        //             const cellBitSet = cellVectors.get(collisionLayer)
        //             if (cellBitSet && !cellBitSet.and(tileBitSet).isEmpty()) {
        //             } else {
        //                 doesMatch = false
        //                 break
        //             }
        //         } else {
        //             doesMatch = false
        //             break
        //         }
        //         collisionLayersToCheck.add(collisionLayer)
        //     }
        // }

        // if (doesMatch) {
        //     for (const [collisionLayer, tileBitSet] of this.cacheNoBitSets) {
        //         if (cellVectors.has(collisionLayer)) {
        //             const cellBitSet = cellVectors.get(collisionLayer)
        //             if (cellBitSet.and(tileBitSet).isEmpty()) {
        //             } else {
        //                 doesMatch = false
        //                 break
        //             }
        //         } else {
        //             // Still ok, nothing to change since the Cell clearly does not have the NO tile
        //         }
        //         collisionLayersToCheck.add(collisionLayer)
        //     }
        // }

        // if (doesMatch) {
        //     const ary = [...this.cacheDirections.keys()]
        //     for (let index = 0; index < ary.length; index++) {
        //         const collisionLayer = ary[index]
        //         // Check directions too (only if the rule has one set)
        //         const ruleDirection = this.cacheDirections.get(collisionLayer)
        //         const cellDirection = cell.getCollisionLayerWantsToMove(collisionLayer)
        //         if (ruleDirection === RULE_DIRECTION.STATIONARY && !cellDirection) {
        //             // This is OK
        //         } else if (ruleDirection !== cellDirection) {
        //             doesMatch = false
        //             break
        //         }
        //     }
        // }

        function keyFn() {
            return `[${cell.toKey()}]`
        }
        const valueFn = () => {
            // try using the spritesPresent, spritesMissing, anySpritesPresent, and the movement sets
            let doesMatch =
                cell.spriteBitSet.containsAll(this.spritesPresent) &&
                cell.spriteBitSet.containsNone(this.spritesMissing)
            if (doesMatch) {
                for (const anySpritesPresent of this.anySpritesPresent) {
                    doesMatch = doesMatch && cell.spriteBitSet.containsAny(anySpritesPresent)
                }
            }
            // Check CollisionLayers
            // TODO: Move this into the Cell definition
            if (doesMatch) {
                for (const [collisionLayer, direction] of this.spriteMovementsPresent) {
                    const cellDir = cell.getCollisionLayerWantsToMove(collisionLayer)
                    if (direction !== cellDir) {
                        doesMatch = false
                    }
                }
            }

            if (doesMatch) {
                for (const [orTile, direction] of this.orTileMovementsPresent) {
                    if (orTile.hasSingleCollisionLayer()) {
                        const cellDir = cell.getCollisionLayerWantsToMove(orTile.getCollisionLayer())
                        if (direction !== cellDir) {
                            doesMatch = false
                        }
                    } else {
                        // find which sprite in the OR tile matched and get its direction
                        let foundSprite = false
                        for (const sprite of orTile.getSprites()) {
                            if (cell.spriteBitSet.has(sprite)) {
                                foundSprite = true
                                const cellDir = cell.getCollisionLayerWantsToMove(sprite.getCollisionLayer())
                                if (direction !== cellDir) {
                                    doesMatch = false
                                }
                            }
                        }
                        if (!foundSprite) {
                            throw new Error(`BUG: Could not find sprite. One should have already been matched before`)
                        }
                    }
                }
            }
            return doesMatch
        }

        // if (doesMatch !== doesMatch2) {
        //     if (!this.alreadyReportedMismatch) {
        //         this.alreadyReportedMismatch = true
        //         console.error(this.toString())
        //         console.error(cell.toString())
        //         console.error(`BUG: using bit sets does not match. Expected ${doesMatch} but got: ${doesMatch2}`)
        //     }
        // }
        return this.lruCache.get(keyFn(), valueFn)

    }
    private matchesCellWithout(cell: Cell, sprite: GameSprite) {
        // Temporarily remove the sprite from the cell
        if (cell.hasSprite(sprite)) {
            const wantsToMove = cell.getWantsToMove(sprite)
            cell._deleteWantsToMove(sprite)
            const matches = this.matchesCellSimple(cell)
            cell._setWantsToMove(sprite, wantsToMove)
            return matches
        } else {
            return this.matchesCellSimple(cell)
        }
    }

    addCells(t: SimpleTileWithModifier, sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: Optional<RULE_DIRECTION>) {
        if (process.env['NODE_ENV'] === 'development' && this.debugFlag === DEBUG_FLAG.BREAKPOINT) {
            // Pausing here because it was marked in the code
            /*TerminalUI.debugRenderScreen();*/ debugger
        }
        for (const cell of cells) {
            const matchesTiles = this.matchesCell(cell, t, wantsToMove)
            if (matchesTiles) {
                for (const [bracket, indexes] of this.brackets.entries()) {
                    for (const index of indexes) {
                        bracket.addCell(index, this, t, sprite, cell, wantsToMove)
                    }
                }
            } else {
                // adding the Cell causes the set of Tiles to no longer match.
                // If it previously matched, notify the bracket that it no longer matches
                // (and delete it from our cache)
                for (const [bracket, indexes] of this.brackets.entries()) {
                    for (const index of indexes) {
                        bracket.removeCell(index, this, t, sprite, cell)
                    }
                }
            }
        }
    }
    updateCells(t: SimpleTileWithModifier, sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION) {
        this.addCells(t, sprite, cells, wantsToMove)
    }
    removeCells(t: SimpleTileWithModifier, sprite: GameSprite, cells: Iterable<Cell>) {
        if (process.env['NODE_ENV'] === 'development' && this.debugFlag === DEBUG_FLAG.BREAKPOINT_REMOVE) {
            // Pausing here because it was marked in the code
            /*TerminalUI.debugRenderScreen();*/ debugger
        }
        for (const cell of cells) {
            // Check if the cell still matches. If not, remove it from upstream
            // It's a little funky if we have a NO tile. I _think_ we need to negate the
            // result of matchesCellWithout in that case but not completely sure
            if (t.isNo() === this.matchesCellWithout(cell, sprite)) {
                // remove it from upstream
                for (const [bracket, indexes] of this.brackets.entries()) {
                    for (const index of indexes) {
                        bracket.removeCell(index, this, t, sprite, cell)
                    }
                }
            }
        }
    }

}

export class SimpleTileWithModifier extends BaseForLines implements ICacheable {
    readonly _isNegated: boolean
    readonly _isRandom: boolean
    readonly _direction: Optional<RULE_DIRECTION>
    readonly _tile: IGameTile
    readonly _debugFlag: DEBUG_FLAG
    private neighbors: Set<SimpleNeighbor>
    constructor(source: IGameCode, isNegated: boolean, isRandom: boolean, direction: Optional<RULE_DIRECTION>, tile: IGameTile, debugFlag: DEBUG_FLAG) {
        super(source)
        this._isNegated = isNegated
        this._isRandom = isRandom
        this._direction = direction
        this._tile = tile
        this.neighbors = new Set()
        this._debugFlag = debugFlag
        // this._localCache = new Map()
    }

    toKey(ignoreDebugFlag?: boolean) {
        if (ignoreDebugFlag) {
            return `{-?${this._isNegated}} {#?${this._isRandom}} dir="${this._direction}" [${this._tile.getSprites().map(sprite => sprite.getName()).sort().join(' ')}]`
        } else {
            return `{-?${this._isNegated}} {#?${this._isRandom}} dir="${this._direction}" [${this._tile.getSprites().map(sprite => sprite.getName()).sort().join(' ')}]{debugging?${this._debugFlag}}`
        }
    }

    equals(t: SimpleTileWithModifier) {
        return this._isNegated === t._isNegated && this._tile.equals(t._tile) && this._direction === t._direction && this._isRandom === t._isRandom
    }

    clearCaches() {
        // this._localCache.clear()
    }

    isNo() {
        return this._isNegated
    }
    isRandom() {
        return this._isRandom
    }

    getCollisionLayers() {
        const collisionLayers = new Set<CollisionLayer>()
        for (const sprite of this._tile.getSprites()) {
            collisionLayers.add(sprite.getCollisionLayer())
        }
        return collisionLayers
    }

    // This should only be called on Condition Brackets
    subscribeToCellChanges(neighbor: SimpleNeighbor) {
        this.neighbors.add(neighbor)

        // subscribe this to be notified of all Sprite changes of Cells
        for (const sprite of this._tile.getSprites()) {
            sprite.addTileWithModifier(this)
        }
    }

    matchesCellWithoutDirection(cell: Cell) {
        const hasTile = this._tile && this._tile.matchesCell(cell)
        return this._isNegated != hasTile
    }

    private matchesCellWantsToMove(cell: Cell, wantsToMove: Optional<RULE_DIRECTION>) {
        const hasTile = this._tile && this._tile.matchesCell(cell)
        return this._isNegated != (hasTile && (this._direction === wantsToMove || this._direction === null))
    }

    private matchesFirstCell(cells: Cell[], wantsToMove: Optional<RULE_DIRECTION>) {
        return this.matchesCellWantsToMove(cells[0], wantsToMove)
    }

    addCells(sprite: GameSprite, cells: Cell[], wantsToMove: Optional<RULE_DIRECTION>) {
        if (process.env['NODE_ENV'] === 'development' && this._debugFlag === DEBUG_FLAG.BREAKPOINT) {
            // Pause here because it was marked in the code
            /*TerminalUI.debugRenderScreen();*/ debugger
        }
        // Cells all have the same sprites, so if the 1st matches, they all do
        if (this.matchesFirstCell(cells, wantsToMove)) {
            // const cellsNotInCache = setDifference(new Set(cells), new Set(this._localCache.keys()))
            for (const neighbor of this.neighbors) {
                // neighbor.addCells(this, sprite, cellsNotInCache, wantsToMove)
                neighbor.addCells(this, sprite, cells, wantsToMove)
            }
            // this._addCellsToCache(cellsNotInCache, wantsToMove)
        } else {
            // const cellsInCache = setIntersection(new Set(cells), new Set(this._localCache.keys()))
            for (const neighbor of this.neighbors) {
                // neighbor.removeCells(this, sprite, cellsInCache)
                neighbor.removeCells(this, sprite, cells)
            }
            // this._removeCellsFromCache(cellsInCache)
        }
    }
    updateCells(sprite: GameSprite, cells: Cell[], wantsToMove: RULE_DIRECTION) {
        if (process.env['NODE_ENV'] === 'development' && this._debugFlag === DEBUG_FLAG.BREAKPOINT) {
            // Pause here because it was marked in the code
            /*TerminalUI.debugRenderScreen();*/ debugger
        }
        // Cells all have the same sprites, so if the 1st matches, they all do
        if (this.matchesFirstCell(cells, wantsToMove)) {
            for (const neighbor of this.neighbors) {
                neighbor.updateCells(this, sprite, cells, wantsToMove)
            }
        } else {
            for (const neighbor of this.neighbors) {
                neighbor.removeCells(this, sprite, cells)
            }
        }
    }
    removeCells(sprite: GameSprite, cells: Cell[]) {
        if (process.env['NODE_ENV'] === 'development' && this._debugFlag === DEBUG_FLAG.BREAKPOINT_REMOVE) {
            // Pause here because it was marked in the code
            /*TerminalUI.debugRenderScreen();*/ debugger
        }
        // Cells all have the same sprites, so if the 1st matches, they all do
        if (this.matchesFirstCell(cells, null/*STATIONARY*/)) {
            for (const neighbor of this.neighbors) {
                neighbor.addCells(this, sprite, cells, RULE_DIRECTION.STATIONARY)
            }
        } else {
            for (const neighbor of this.neighbors) {
                neighbor.removeCells(this, sprite, cells)
            }
        }
    }

}

class BracketPair<A> {
    readonly condition: Optional<A>
    action: Optional<A>
    constructor(condition: Optional<A>, action: Optional<A>) {
        this.condition = condition
        this.action = action
    }
}

class ExtraPair<A> extends BracketPair<A> {
    readonly extra: boolean
    constructor(condition: Optional<A>, action: Optional<A>, extra: boolean) {
        super(condition, action)
        this.extra = extra
    }
}

export interface IRule extends IGameNode {
    hasMatches: (level: Cell[][]) => boolean
    evaluate: (level: Cell[][], onlyEvaluateFirstMatch: boolean) => IMutation[]
    getChildRules: () => IRule[]
    isLate: () => boolean
    hasRigid: () => boolean
    clearCaches: () => void
    addCellsToEmptyRules: (cells: Iterable<Cell>) => void
}


export interface IMutation {
    hasCell: () => boolean
    getCell: () => Cell
    hasCommand: () => boolean
    getCommand: () => AbstractCommand
    getDidSpritesChange: () => boolean
}

class CellMutation implements IMutation {
    private cell: Cell
    private didSpritesChange: boolean
    constructor(cell: Cell, didSpritesChange: boolean) {
        this.cell = cell
        this.didSpritesChange = didSpritesChange
    }
    hasCell() { return true }
    getCell() { return this.cell }
    getDidSpritesChange() { return this.didSpritesChange }
    hasCommand() { return false }
    getCommand(): AbstractCommand {
        throw new Error(`BUG: check hasCommand first`)
    }
}

class CommandMutation implements IMutation {
    private command: AbstractCommand
    constructor(command: AbstractCommand) {
        this.command = command
    }
    hasCommand() { return true }
    getCommand() { return this.command }
    getDidSpritesChange() { return false }
    hasCell() { return false }
    getCell(): Cell {
        throw new Error(`BUG: check hasCell first`)
    }
}
