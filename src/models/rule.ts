import * as _ from 'lodash'
import {
    BaseForLines,
    IGameCode,
    IGameNode
} from '../models/game'
import { IGameTile, GameSprite } from './tile'
import { RULE_MODIFIER, setDifference, setIntersection, nextRandom, RULE_DIRECTION_ABSOLUTE, RULE_DIRECTION_ABSOLUTE_SET, RULE_DIRECTION_ABSOLUTE_LIST, setEquals } from '../util'
import { Cell } from '../engine'
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

function opposite(dir: RULE_DIRECTION_ABSOLUTE) {
    switch (dir) {
        case RULE_DIRECTION_ABSOLUTE.UP:
            return RULE_DIRECTION_ABSOLUTE.DOWN
        case RULE_DIRECTION_ABSOLUTE.DOWN:
            return RULE_DIRECTION_ABSOLUTE.UP
        case RULE_DIRECTION_ABSOLUTE.LEFT:
            return RULE_DIRECTION_ABSOLUTE.RIGHT
        case RULE_DIRECTION_ABSOLUTE.RIGHT:
            return RULE_DIRECTION_ABSOLUTE.LEFT
        default:
            throw new Error(`BUG: Invalid direction: "${dir}"`)
    }
}

export class SimpleRuleGroup extends BaseForLines implements IRule {
    _rules: IRule[]
    constructor(source: IGameCode, rules: IRule[]) {
        super(source)
        this._rules = rules
    }

    evaluate() {
        let mutations = []
        for (const rule of this._rules) {
            const ret = rule.evaluate()
            if (ret.length > 0) {
                mutations = mutations.concat(ret)
            }
        }
        return mutations
    }

    getChildRules() {
        return this._rules
    }

    isLate() {
        // All rules in a group should be parked as late if any is marked as late
        return this._rules[0].isLate()
    }
    isAgain() {
        return this._rules[0].isAgain()
    }
    isRigid() {
        return this._rules[0].isRigid()
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
export class SimpleRule extends BaseForLines implements ICacheable, IRule {
    _evaluationDirection: RULE_DIRECTION_ABSOLUTE
    _conditionBrackets: SimpleBracket[]
    _actionBrackets: SimpleBracket[]
    _commands: string[]
    _isLate: boolean
    _isAgain: boolean
    _isRigid: boolean
    _isSubscribedToCellChanges: boolean
    constructor(source: IGameCode, evaluationDirection: RULE_DIRECTION_ABSOLUTE, conditionBrackets: SimpleBracket[], actionBrackets: SimpleBracket[], commands: string[], isLate: boolean, isAgain: boolean, isRigid: boolean) {
        super(source)
        this._evaluationDirection = evaluationDirection
        this._conditionBrackets = conditionBrackets
        this._actionBrackets = actionBrackets
        this._commands = commands
        this._isLate = isLate
        this._isAgain = isAgain
        this._isRigid = isRigid
    }
    toKey() {
        return `{Late?${this._isLate}}{Rigid?${this._isRigid}}{again?${this._isAgain}}${this._conditionBrackets.map(x => x.toKey())} -> ${this._actionBrackets.map(x => x.toKey())} ${this._commands.join(' ')}`
    }
    getChildRules() {
        return []
    }
    subscribeToCellChanges() {
        if (!this._isSubscribedToCellChanges) {
            // Subscribe the bracket and neighbors to cell Changes (only the condition side)
            for (const bracket of this._conditionBrackets) {
                bracket.subscribeToNeighborChanges()
                for (const neighbor of bracket._neighbors) {
                    neighbor.subscribeToTileChanges()
                    for (const t of neighbor._tilesWithModifier) {
                        t.subscribeToCellChanges()
                    }
                }
            }
            this._isSubscribedToCellChanges = true
        }
    }

    evaluate() {
        if (this._actionBrackets.length === 0 || this._isAgain || this._isRigid) {
            // TODO: Just commands are not supported yet
            return []
        }
        const allMutators: CellMutation[][] = []
        // Determine which directions to loop over
        // Include any simple UP, DOWN, LEFT, RIGHT ones
        let directionsToCheck = []

        // check that all the bracketPairs have at least one match
        let matchesAllBrackets = true
        for (const bracket of this._conditionBrackets) {
            const firstMatches = bracket.getFirstCells()
            if (firstMatches.size === 0) {
                matchesAllBrackets = false
            }
        }

        if (matchesAllBrackets) {
            // Evaluate!
            // let didExecute = false
            const mutators = this._conditionBrackets.map((bracket, index) => {
                // Sort the firstMatches so they are applied in order from top->bottom and left->right
                const firstMatches = [...bracket.getFirstCells()].sort((a, b) => {
                    // if (a.rowIndex < b.rowIndex) {
                    //     return -1
                    // } else if (a.rowIndex > b.rowIndex) {
                    //     return 1
                    // } else {
                    //     if (a.colIndex < b.colIndex) {
                    //         return -1
                    //     } else if (a.colIndex > b.colIndex) {
                    //         return 1
                    //     } else {
                    //         throw new Error(`BUG: We seem to be comparing the same cell`)
                    //     }
                    // }
                    return a.rowIndex - b.rowIndex || a.colIndex - b.colIndex
                })
                const ret: CellMutation[][] = []
                for (const firstCell of firstMatches) {
                    // Check if firstCell is still in the set
                    // (a previous application of this rule could have made it no longer apply)
                    if (bracket.getFirstCells().has(firstCell)) {
                        ret.push(bracket.evaluate(this._actionBrackets[index], firstCell))

                        if (process.env['NODE_ENV'] !== 'production') {
                            this.__coverageCount++
                        }
                    }
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
        }
        return _.flatten(allMutators)
    }
    isLate() { return this._isLate }
    isAgain() { return this._isAgain }
    isRigid() { return this._isRigid }

}

class SimpleBracket extends BaseForLines implements ICacheable {
    _direction: RULE_DIRECTION_ABSOLUTE
    _neighbors: SimpleNeighbor[]
    _firstCells: Set<Cell>
    constructor(source: IGameCode, direction: RULE_DIRECTION_ABSOLUTE, neighbors: SimpleNeighbor[]) {
        super(source)
        this._direction = direction
        this._neighbors = neighbors
        this._firstCells = new Set()
    }
    toKey() {
        return `${this._direction}[${this._neighbors.map(n => n.toKey()).join('|')}]`
    }

    subscribeToNeighborChanges() {
        this._neighbors.forEach((neighbor, index) => {
            neighbor.addBracket(this, index)
        })
    }

    getFirstCells() {
        return this._firstCells
    }

    evaluate(actionBracket: SimpleBracket, cell: Cell) {
        const ret: CellMutation[] = []
        let curCell = cell
        let index = 0
        for (const neighbor of this._neighbors) {
            const actionNeighbor = actionBracket._neighbors[index]
            ret.push(neighbor.evaluate(actionNeighbor, curCell))
            curCell = curCell.getNeighbor(this._direction)
            index++
        }
        return ret
    }

    addCell(index: number, neighbor: SimpleNeighbor, t: SimpleTileWithModifier, sprite: GameSprite, cell: Cell, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        // check if downstream neighbors match
        if (!this.matchesDownstream(cell, index)) {
            return
        }
        // Loop Upstream
        // check the neighbors upstream of curCell
        const firstCell = this.matchesUpstream(cell, index)
        if (!firstCell) {
            return
        }

        // Add to the set of firstNeighbors
        // We have a match. Add to the firstCells set.
        this._firstCells.add(firstCell)
    }
    // updateCell(neighbor: SimpleNeighbor, t: SimpleTileWithModifier, sprite: GameSprite, cell: Cell, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
    //     this.updateCellOld(cell, sprite, t, neighbor, wantsToMove, true)
    // }
    removeCell(index: number, neighbor: SimpleNeighbor, t: SimpleTileWithModifier, sprite: GameSprite, cell: Cell) {
        // cell was removed
        // Loop Upstream
        const firstCell = this.getFirstCellToRemove(cell, index)
        // Bracket might not match for all directions (likely not), so we might not find a firstCell to remove
        // But that's OK.
        if (firstCell && this._firstCells.has(firstCell)) {
            this._firstCells.delete(firstCell)
        }
    }

    matchesDownstream(cell: Cell, index: number) {
        // Check all the neighbors and add the firstNeighbor to the set of matches for this direction
        let matched = true
        let curCell = cell
        // Loop Downstream
        // check the neighbors downstream of curCell
        for (let x = index + 1; x < this._neighbors.length; x++) {
            curCell = curCell.getNeighbor(this._direction)
            // TODO: Convert the neighbor check into a method
            if (curCell && (this._neighbors[x]._tilesWithModifier.size === 0 || this._neighbors[x].hasCell(curCell))) {
                // keep going
            } else {
                matched = false
                break
            }
        }
        return matched
    }

    matchesUpstream(cell: Cell, index: number) {
        let matched = true
        let curCell = cell
        // check the neighbors upstream of curCell
        for (let x = index - 1; x >= 0; x--) {
            curCell = curCell.getNeighbor(opposite(this._direction))
            if (curCell && (this._neighbors[x]._tilesWithModifier.size === 0 || this._neighbors[x].hasCell(curCell))) {
                // keep going
            } else {
                matched = false
                break
            }
        }
        return matched ? curCell : null
    }

    getFirstCellToRemove(cell: Cell, index: number) {
        // Loop Upstream
        // check the neighbors upstream of curCell
        let matched = true
        let curCell = cell
        // check the neighbors upstream of curCell
        for (let x = index - 1; x >= 0; x--) {
            curCell = curCell.getNeighbor(opposite(this._direction))
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

class SimpleNeighbor extends BaseForLines implements ICacheable {
    _tilesWithModifier: Set<SimpleTileWithModifier>
    _brackets: Map<SimpleBracket, Set<number>>
    _localCellCache: Set<Cell>

    constructor(source: IGameCode, tilesWithModifier: Set<SimpleTileWithModifier>) {
        super(source)
        this._tilesWithModifier = tilesWithModifier
        this._brackets = new Map()
        this._localCellCache = new Set()
    }
    toKey() {
        return `{${[...this._tilesWithModifier].map(t => t.toKey()).sort().join(' ')}`
    }

    evaluate(actionNeighbor: SimpleNeighbor, cell: Cell) {
        // Just remove all tiles for now and then add all of them back
        // TODO: only remove tiles that are matching the collisionLayer but wait, they already need to be exclusive

        // Remember the set of sprites before (so we can detect if the cell changed)
        const spritesBefore = new Set(cell.getSpritesAsSet())
        const newSpritesAndWantsToMoves = [...cell.getSpriteAndWantsToMoves()]

        const { spritesToRemove, spritesToUpdate, spritesToAdd } = this._getConditionAndActionSprites(cell, actionNeighbor)

        // Remove any sprites that are in the same collisionLayer as sprites that are being added
        const collisionLayerOfSpritesToRemove = new Map<number, GameSprite>()
        for (const sprite of cell.getSpritesAsSet()) {
            collisionLayerOfSpritesToRemove.set(sprite.getCollisionLayerNum(), sprite)
        }
        for (const sprite of spritesToAdd.keys()) {
            if (collisionLayerOfSpritesToRemove.has(sprite.getCollisionLayerNum())) {
                spritesToRemove.add(collisionLayerOfSpritesToRemove.get(sprite.getCollisionLayerNum()))
            }
        }

        cell.removeSprites(spritesToRemove)

        // add sprites that are listed on the action side
        for (let [sprite, direction] of spritesToUpdate) {
            cell.addSprite(sprite, direction)
        }
        for (let [sprite, direction] of spritesToAdd) {
            cell.addSprite(sprite, direction)
        }

        // TODO: Be better about recording when the cell actually updated
        const spritesNow = cell.getSpritesAsSet()
        const didSpritesChange = !setEquals(spritesBefore, spritesNow)
        return new CellMutation(cell, didSpritesChange)
    }

    getSpriteMap(cell: Cell) {
        const spriteMap = new Map<GameSprite, RULE_DIRECTION_ABSOLUTE>()
        for (const t of this._tilesWithModifier) {
            if (t.isRandom()) {
                const sprites = t._tile.getSprites()
                if (sprites.length === 1) {
                    // Decide whether or not to include the sprite
                    if (nextRandom(2)) {
                        spriteMap.set(sprites[0], RULE_DIRECTION_ABSOLUTE.STATIONARY)
                    }
                } else {
                    const index = nextRandom(sprites.length)
                    const sprite = sprites[index]
                    // It seems like `[ RANDOM > tree ]` does not exist anywhere
                    // (RANDOM flag and a direction)
                    spriteMap.set(sprite, RULE_DIRECTION_ABSOLUTE.STATIONARY)
                }
            } else if (!t.isNo()) {
                let sprites
                if (t._tile.isOr()) {
                    // only update sprites that are in the cell
                    sprites = setIntersection(new Set(t._tile.getSprites()), cell.getSpritesAsSet())
                } else {
                    sprites = t._tile.getSprites()
                }
                for (const sprite of sprites) {
                    spriteMap.set(sprite, t._direction)
                }
            }
        }
        return spriteMap
    }

    _getConditionAndActionSprites(cell: Cell, actionNeighbor: SimpleNeighbor) {
        // Return:
        // - sprites to remove
        // - sprites to update (with wantsToMove)
        // - sprites to add (with wantsToMove)
        //
        // Notes:
        // If the action has an OR tile then the condition has the same OR tile
        // If the action has a MOVING direction then the condition has a MOVING direction


        // [   player ] -> [   player ]
        // [ > player ] -> [   player ]
        // [   Thing  ] -> [   Thing  ]
        // [ > Thing  ] -> [   Thing  ]
        // [   Thing  ] -> [ > Thing  ]
        // [ mvng Thing ] -> [ mvng Thing ]
        // [ Thing ] -> [ ]
        // [ Thing ] -> [ tree ]
        // [ a ] -> [ b ]
        // [ NO a ] -> [ b ]
        // [ a ] -> [ NO a ] ???
        // [ MOVING a ] -> [ MOVING a ] ???
        // [ MOVING a MOVING c ] -> [ MOVING c MOVING b ] : c moves but b is stationary

        const conditionSpritesMap = this.getSpriteMap(cell)
        const actionSpritesMap = actionNeighbor.getSpriteMap(cell)

        const spritesToRemove = new Set<GameSprite>()
        const spritesToUpdate = new Map<GameSprite, RULE_DIRECTION_ABSOLUTE>()
        const spritesToAdd = new Map<GameSprite, RULE_DIRECTION_ABSOLUTE>()

        // Determine the direction should have based on what was specified in the condition
        function getActionDir(sprite: GameSprite) {
            const conditionDir = conditionSpritesMap.get(sprite)
            const actionDir = actionSpritesMap.get(sprite)
            let direction
            switch (actionDir) {
                case RULE_DIRECTION_ABSOLUTE.UP:
                case RULE_DIRECTION_ABSOLUTE.DOWN:
                case RULE_DIRECTION_ABSOLUTE.LEFT:
                case RULE_DIRECTION_ABSOLUTE.RIGHT:
                case RULE_DIRECTION_ABSOLUTE.ACTION:
                case RULE_DIRECTION_ABSOLUTE.RANDOMDIR:
                case RULE_DIRECTION_ABSOLUTE.STATIONARY:
                    direction = actionDir
                    break
                case null:
                    if (conditionDir) {
                        // Stop moving because the condition was moving
                        direction = RULE_DIRECTION_ABSOLUTE.STATIONARY
                    } else {
                        // Don't change the direction
                        direction = null
                    }
                    break
                default:
                    throw new Error(`BUG: Unsupported direction "${actionDir}"`)
            }
            return direction
        }

        for (const sprite of setDifference(new Set(conditionSpritesMap.keys()), new Set(actionSpritesMap.keys()))) {
            spritesToRemove.add(sprite)
        }

        for (const sprite of setIntersection(new Set(conditionSpritesMap.keys()), new Set(actionSpritesMap.keys()))) {
            const direction = getActionDir(sprite)
            if (direction) { // optimization
                spritesToUpdate.set(sprite, direction)
            }
        }

        for (const sprite of setDifference(new Set(actionSpritesMap.keys()), new Set(conditionSpritesMap.keys()))) {
            const direction = getActionDir(sprite)
            spritesToAdd.set(sprite, direction)
        }

        return { spritesToRemove, spritesToUpdate, spritesToAdd }
    }

    addBracket(bracket: SimpleBracket, index: number) {
        if (!this._brackets.has(bracket)) {
            this._brackets.set(bracket, new Set())
        }
        this._brackets.get(bracket).add(index)
    }

    subscribeToTileChanges() {
        this._tilesWithModifier.forEach(t => {
            t.addRuleBracketNeighbor(this)
        })
    }

    matchesCell(cell: Cell, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        let shouldMatch = true
        for (const t of this._tilesWithModifier) {
            if (!t.matchesCell(cell, wantsToMove)) {
                shouldMatch = false
                break
            }
        }
        return shouldMatch
    }

    matchesFirstCell(cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        return this.matchesCell(cells[0], wantsToMove)
    }

    addCells(t: SimpleTileWithModifier, sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        for (const cell of cells) {
            const matchesTiles = this.matchesCell(cell, wantsToMove)
            if (matchesTiles) {
                // Commented because updates could cause the cell to already be in the cache
                //if (!this.hasCell(cell)) {
                for (const [bracket, indexes] of this._brackets.entries()) {
                    for (const index of indexes) {
                        bracket.addCell(index, this, t, sprite, cell, wantsToMove)
                    }
                }
                this._localCellCache.add(cell)
                //}
            } else {
                // adding the Cell causes the set of Tiles to no longer match.
                // If it previously matched, notify the bracket that it no longer matches
                // (and delete it from our cache)
                if (this.hasCell(cell)) {
                    for (const [bracket, indexes] of this._brackets.entries()) {
                        for (const index of indexes) {
                            bracket.removeCell(index, this, t, sprite, cell)
                        }
                    }
                    this._localCellCache.delete(cell)
                }
            }
        }
    }
    updateCells(t: SimpleTileWithModifier, sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        this.addCells(t, sprite, cells, wantsToMove)
    }
    removeCells(t: SimpleTileWithModifier, sprite: GameSprite, cells: Iterable<Cell>) {
        for (const cell of cells) {
            if (this.hasCell(cell)) {
                // remove it from upstream
                for (const [bracket, indexes] of this._brackets.entries()) {
                    for (const index of indexes) {
                        bracket.removeCell(index, this, t, sprite, cell)
                    }
                }
                this._localCellCache.delete(cell)
            }
        }
    }

    hasCell(cell: Cell) {
        return this._localCellCache.has(cell)
    }

}

class SimpleEllipsisNeighbor extends SimpleNeighbor {
    constructor(source: IGameCode, tilesWithModifier: Set<SimpleTileWithModifier>) {
        super(source, tilesWithModifier)
    }
    toKey() {
        return `{...ellipsishack...}`
    }
    subscribeToTileChanges() {
        // don't subscribe to changes since we do not handle ellipses
    }
}

export class SimpleTileWithModifier extends BaseForLines implements ICacheable {
    _isNegated: boolean
    _isRandom: boolean
    _direction: RULE_DIRECTION_ABSOLUTE
    _tile: IGameTile
    _neighbors: Set<SimpleNeighbor>
    constructor(source: IGameCode, isNegated: boolean, isRandom: boolean, direction: RULE_DIRECTION_ABSOLUTE, tile: IGameTile) {
        super(source)
        this._isNegated = isNegated
        this._isRandom = isRandom
        this._direction = direction
        this._tile = tile
        this._neighbors = new Set()
    }

    toKey() {
        return `{-?${this._isNegated}} {#?${this._isRandom}} dir="${this._direction}" [${this._tile.getSprites().map(sprite => sprite._getName()).sort()}]`
    }

    isNo() {
        return this._isNegated
    }
    isRandom() {
        return this._isRandom
    }

    addRuleBracketNeighbor(neighbor: SimpleNeighbor) {
        this._neighbors.add(neighbor)
    }

    // This should only be called on Condition Brackets
    subscribeToCellChanges() {
        // subscribe this to be notified of all Sprite changes of Cells
        if (this._tile) { // grr, ellipsis hack....
            for (const sprite of this._tile.getSprites()) {
                sprite.addTileWithModifier(this)
            }
        }
    }

    matchesCell(cell: Cell, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        const hasTile = this._tile && this._tile.matchesCell(cell)
        return this._isNegated != (hasTile && (this._direction === wantsToMove || this._direction === null))
    }

    matchesFirstCell(cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        return this.matchesCell(cells[0], wantsToMove)
    }

    addCells(sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
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
    updateCells(sprite: GameSprite, cells: Iterable<Cell>, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
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
                neighbor.addCells(this, sprite, cells, RULE_DIRECTION_ABSOLUTE.STATIONARY)
            }
        } else {
            for (const neighbor of this._neighbors) {
                neighbor.removeCells(this, sprite, cells)
            }
        }
    }

}

class SimpleEllipsisTileWithModifier extends SimpleTileWithModifier {
    constructor(source: IGameCode, isNegated: boolean, isRandom: boolean, direction: RULE_DIRECTION_ABSOLUTE, tile: IGameTile) {
        super(source, isNegated, isRandom, direction, tile)
    }
    toKey() {
        return `HACK_SIMPLE_ELLIPSIS_TILEWITHMODIFIER`
    }
    subscribeToCellChanges() {
        // Don't actually subscribe
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
export class GameRule extends BaseForLines implements ICacheable {
    _modifiers: RULE_MODIFIER[]
    _commands: string[]
    _hasEllipsis: boolean
    _brackets: RuleBracket[]
    _actionBrackets: RuleBracket[]
    // _conditionCommandPair: RuleConditionCommandPair[]

    toKey() {
        return `${this._brackets.map(x => x.toKey())} -> ${this._actionBrackets.map(x => x.toKey())} ${this._commands.join(' ')}`
    }

    simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const simpleRules = this.convertToMultiple().map(r => r.toSimple(ruleCache, bracketCache, neighborCache, tileCache))
        // Register listeners to Cell changes
        for (const rule of simpleRules) {
            rule.subscribeToCellChanges()
        }
        return new SimpleRuleGroup(this.__source, simpleRules)
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const directions = this.getDirectionModifiers()
        if (directions.length !== 1) {
            throw new Error(`BUG: should have exactly 1 direction by now but found the following: "${directions}"`)
        }
        return cacheSetAndGet(ruleCache, new SimpleRule(this.__source, directions[0], this._brackets.map(x => x.toSimple(directions[0], ruleCache, bracketCache, neighborCache, tileCache)), this._actionBrackets.map(x => x.toSimple(directions[0], ruleCache, bracketCache, neighborCache, tileCache)), this._commands, this.isLate(), this.isAgain(), this.isRigid()))
    }

    convertToMultiple() {
        let rulesToConvert = [this]
        let convertedRules = []

        for (const direction of this.getDirectionModifiers()) {
            const expandModifiers = new Map()
            expandModifiers.set(RULE_MODIFIER.HORIZONTAL, [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT])
            expandModifiers.set(RULE_MODIFIER.VERTICAL, [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN])
            expandModifiers.set(RULE_MODIFIER.MOVING, [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN, RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT, RULE_DIRECTION.ACTION])
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
                let didExpand = false
                for (const [nameToExpand, variations] of expandModifiers) {
                    if (rule.hasModifier(nameToExpand)) {
                        for (const variation of variations) {
                            convertedRules.push(rule.clone(direction, nameToExpand, variation))
                            didExpand = true
                        }
                    }
                }
                // If nothing was expanded and this is the current rule
                // then just simplify it (converting all the relative directions to absolute)
                if (!didExpand) {
                    if (rule === this) {
                        // Simplify the current rule
                        // the special `null` nameToExpand means to just copy the tile
                        convertedRules.push(this)
                        convertedRules.push(rule.clone(direction, null, null))
                    } else {
                        convertedRules.push(rule)
                    }
                }
            }

            rulesToConvert = convertedRules
            convertedRules = []
        }
        // Remove the original, non-converted rule
        return rulesToConvert.filter(rule => rule !== this)
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: RULE_MODIFIER, newName: RULE_DIRECTION) {
        const conditionBrackets = this._brackets.map(bracket => bracket.clone(direction, nameToExpand, newName))
        const actionBrackets = this._actionBrackets.map(bracket => bracket.clone(direction, nameToExpand, newName))
        // retain LATE and RIGID but discard the rest of the modifiers
        const modifiers = _.intersection(this._modifiers, [RULE_MODIFIER.LATE, RULE_MODIFIER.RIGID]).concat([RULE_MODIFIER[direction]])
        return new GameRule(this.__source, modifiers, conditionBrackets, actionBrackets, this._commands)
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
        // Convert HORIZONTAL and VERTICAL to 2:
        if (this._modifiers.indexOf(RULE_MODIFIER.HORIZONTAL) >= 0) {
            return [RULE_DIRECTION_ABSOLUTE.LEFT, RULE_DIRECTION_ABSOLUTE.RIGHT]
        }
        if (this._modifiers.indexOf(RULE_MODIFIER.VERTICAL) >= 0) {
            return [RULE_DIRECTION_ABSOLUTE.UP, RULE_DIRECTION_ABSOLUTE.DOWN]
        }
        const directions = this._modifiers.filter(m => RULE_DIRECTION_ABSOLUTE_SET.has(m)).map(d => {
            switch (d) {
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

        if (conditions.length === actions.length) {
        } else if (actions.length !== 0) {
            throw new Error(`Invalid Rule. The number of brackets on the right must match the structure of the left hand side or be 0`)
        }
        // TODO: build the _conditionCommandPair
        if (commands.length > 0) {
            this._brackets = []
            this._actionBrackets = []
        }
    }


    isLate() {
        return this._modifiers.indexOf(RULE_MODIFIER.LATE) >= 0
    }
    isAgain() {
        return this._commands.indexOf(RULE_COMMAND.AGAIN) >= 0
    }
    isRigid() {
        return this._modifiers.indexOf(RULE_MODIFIER.RIGID) >= 0
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

    toSimple(direction: RULE_DIRECTION_ABSOLUTE, ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return cacheSetAndGet(bracketCache, new SimpleBracket(this.__source, direction, this._neighbors.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache))))
    }

    hasEllipsis() {
        return this._hasEllipsis
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
        if (this.isEllipsis()) {
            return new SimpleEllipsisNeighbor(this.__source, new Set(this._tilesWithModifier.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache))))
        }
        return cacheSetAndGet(neighborCache, new SimpleNeighbor(this.__source, new Set(this._tilesWithModifier.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)))))
    }

    isEllipsis() {
        return this._isEllipsis
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
            case '>':
            case '<':
            case '^':
            case 'v':
                let modifier = relativeDirectionToAbsolute(direction, this._modifier)
                return new TileWithModifier(this.__source, modifier, this._tile)
            case nameToExpand:
                // the special `null` nameToExpand means to just copy the tile
                if (nameToExpand === null) {
                    return this
                } else {
                    return new TileWithModifier(this.__source, newName, this._tile)
                }
            default:
                return this
        }
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        if (!this._tile) {
            return new SimpleEllipsisTileWithModifier(this.__source, this.isNo(), this.isRandom(), RULE_DIRECTION_ABSOLUTE.STATIONARY, this._tile)
        }
        let direction
        switch (this._modifier) {
            case 'UP':
            case 'DOWN':
            case 'LEFT':
            case 'RIGHT':
                direction = RULE_DIRECTION_ABSOLUTE[this._modifier]
                break
            case 'STATIONARY':
                direction = RULE_DIRECTION_ABSOLUTE.STATIONARY
                break
            case 'ACTION':
                direction = RULE_DIRECTION_ABSOLUTE.ACTION
                break
            case 'RANDOMDIR':
                direction = RULE_DIRECTION_ABSOLUTE.RANDOMDIR
                break
            default:
                direction = null
        }
        return cacheSetAndGet(tileCache, new SimpleTileWithModifier(this.__source, this.isNo(), this.isRandom(), direction, this._tile))
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
    getChildRules: () => IRule[]
    isLate: () => boolean
    isRigid: () => boolean
    isAgain: () => boolean
}

export class GameRuleLoop extends BaseForLines {
    _rules: GameRule[]

    constructor(source: IGameCode, rules: GameRule[]) {
        super(source)
        this._rules = rules
    }

    simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, SimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return new SimpleRuleGroup(this.__source, this._rules.map(rule => rule.simplify(ruleCache, bracketCache, neighborCache, tileCache)))
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

export class CellMutation {
    cell: Cell
    didSpritesChange: boolean
    constructor(cell, didSpritesChange) {
        this.cell = cell
        this.didSpritesChange = didSpritesChange
    }
}
