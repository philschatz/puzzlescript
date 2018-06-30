import * as _ from 'lodash'
import { ICacheable, DEBUG_FLAG, setDifference, RULE_DIRECTION_ABSOLUTE, RULE_DIRECTION_ABSOLUTE_SET, RULE_DIRECTION_ABSOLUTE_LIST, Optional } from "../util";
import { BaseForLines, IGameCode } from "../models/game";
import { AbstractCommand } from "../models/command";
import { SimpleRule, SimpleBracket, SimpleRuleGroup, SimpleNeighbor, SimpleTileWithModifier, SimpleBracketConditionOnly, SIMPLE_DIRECTION_DIRECTIONS, SimpleEllipsisNeighbor, SimpleEllipsisTileWithModifier, SimpleRuleLoop, ISimpleBracket, SimpleEllipsisBracket } from "../models/rule";
import { RULE_DIRECTION } from "../enums";
import { Cell } from '../engine';
import { IGameTile } from '../models/tile';

export enum AST_RULE_MODIFIER {
    RANDOM = 'RANDOM',
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    VERTICAL = 'VERTICAL',
    HORIZONTAL = 'HORIZONTAL',
    ORTHOGONAL = 'ORTHOGONAL',
    PARALLEL = 'PARALLEL',
    MOVING = 'MOVING',
    LATE = 'LATE',
    RIGID = 'RIGID',
}

function cacheSetAndGet<A extends ICacheable>(cache: Map<string, A>, obj: A) {
    const key = obj.toKey()
    if (!cache.has(key)) {
        cache.set(key, obj)
    }
    return <A> cache.get(key)
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
export class ASTGameRule extends BaseForLines implements ICacheable {
    _modifiers: AST_RULE_MODIFIER[]
    _commands: AbstractCommand[]
    _hasEllipsis: boolean
    _brackets: ASTRuleBracket[]
    _actionBrackets: ASTRuleBracket[]
    _debugFlag: DEBUG_FLAG // Used for setting a breakpoint when evaluating the rule
    // _conditionCommandPair: RuleConditionCommandPair[]

    toKey() {
        return `${this._modifiers.join(' ')} ${this._brackets.map(x => x.toKey())} -> ${this._actionBrackets.map(x => x.toKey())} ${this._commands.join(' ')} {debugger?${this._debugFlag}}`
    }

    simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const simpleRules = this.convertToMultiple().map(r => r.toSimple(ruleCache, bracketCache, neighborCache, tileCache))
        // Register listeners to Cell changes
        for (const rule of simpleRules) {
            rule.subscribeToCellChanges()
        }
        return new SimpleRuleGroup(this.__source, this.isRandom(), simpleRules)
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const directions = this.getDirectionModifiers()
        if (directions.length !== 1) {
            throw new Error(`BUG: should have exactly 1 direction by now but found the following: "${directions}"`)
        }

        // Check if the condition matches the action. If so, we can simplify evaluation.
        const conditionBrackets = this._brackets.map(x => x.toSimple(directions[0], ruleCache, bracketCache, neighborCache, tileCache))
        const actionBrackets = this._actionBrackets.map(x => x.toSimple(directions[0], ruleCache, bracketCache, neighborCache, tileCache))

        // Below (in the loop) we check to see if evaluation order matters
        let doesEvaluationOrderMatter = false

        for (let index = 0; index < conditionBrackets.length; index++) {
            const condition = conditionBrackets[index]
            const action = actionBrackets[index]
            // Skip rules with no action bracket `[ > Player ] -> CHECKPOINT`
            if (!action) {
                continue
            }

            // Optimization. Brackets that are only used for testing conditions
            // can be optimized out so they do not need to be evaluated.
            if (condition === action) {
                conditionBrackets[index] = new SimpleBracketConditionOnly(condition.__source, condition._direction, condition.getNeighbors(), condition._debugFlag)
                // actionBrackets[index] = null
            }

            // If there is only 1 bracket with only 1 neighbor then order does not matter
            // So we can skip the introspection loops below
            if (conditionBrackets.length === 1 && conditionBrackets[0].getNeighbors().length === 1) {
                continue
            }
            // Brackets that only involve adding/removing Tiles (or directions) that are not on the condition side can be evaluated easier
            // since they do not need to run in-order
            const conditionTilesWithModifiers = new Set()
            const conditionTilesMap = new Map()
            const actionTilesWithModifiers = new Set()
            for (let index = 0; index < condition.getNeighbors().length; index++) {
                const neighbor = condition.getNeighbors()[index]
                for (const t of neighbor._tilesWithModifier) {
                    conditionTilesWithModifiers.add(t)
                    conditionTilesMap.set(t._tile, { direction: t._direction, neighborIndex: index })
                }
            }
            for (let index = 0; index < action.getNeighbors().length; index++) {
                const neighbor = action.getNeighbors()[index]
                for (const t of neighbor._tilesWithModifier) {
                    actionTilesWithModifiers.add(t)
                    if (t._tile /* because of ellipsis*/ && t._tile.isOr()) {
                        // check if the condition contains the OR tile and maybe is more specific
                        let orTileOnConditionSide
                        for (const conditionTile of condition.getNeighbors()[index]._tilesWithModifier) {
                            if (t._tile === conditionTile._tile && !conditionTile.isNo()) {
                                orTileOnConditionSide = conditionTile
                            }
                        }
                        if (orTileOnConditionSide) {

                        } else {
                            // console.log('Marking as slow because the action side has an OR tile')
                            // console.log(this.toString())
                            doesEvaluationOrderMatter = true // not strictly true, but it means we need to use the magicOrTiles
                        }
                    }
                }
            }
            const uniqueActionTiles = setDifference(actionTilesWithModifiers, conditionTilesWithModifiers)
            for (const t of uniqueActionTiles) {
                if (conditionTilesMap.has(t._tile)) { //use .get instead of HAS because if we are setting a direction then we should be ok
                    // Determine the neighbor index of the tile
                    for (let index = 0; index < action.getNeighbors().length; index++) {
                        const neighbor = action.getNeighbors()[index]
                        if (neighbor._tilesWithModifier.has(t)) {
                            if (index !== conditionTilesMap.get(t._tile).neighborIndex) {
                                // console.log('Marking as slow because the action side has a Tile that may modify the condition and need to re-run')
                                // console.log(this.toString())
                                // console.log(t.toString())
                                // console.log(t._tile.toString())
                                // console.log('------------------------------------');

                                doesEvaluationOrderMatter = true
                            }
                        }
                    }
                }
            }
        }

        return cacheSetAndGet(ruleCache, new SimpleRule(this.__source, directions[0], conditionBrackets, actionBrackets, this._commands, this.isLate(), this.isRigid(), this.isRandom(), this._debugFlag, doesEvaluationOrderMatter))
    }

    convertToMultiple() {
        let rulesToConvert = []
        let convertedRules: ASTGameRule[] = []

        for (const direction of this.getDirectionModifiers()) {
            const expandedDirection = this.clone(direction, null, null)
            rulesToConvert.push(expandedDirection)
        }

        const expandModifiers = new Map()
        expandModifiers.set(AST_RULE_MODIFIER.HORIZONTAL, [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT])
        expandModifiers.set(AST_RULE_MODIFIER.VERTICAL, [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN])
        expandModifiers.set(AST_RULE_MODIFIER.MOVING, [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN, RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT, RULE_DIRECTION.ACTION])

        let didExpand
        do {
            didExpand = false
            for (const rule of rulesToConvert) {
                const direction = rule.getDirectionModifiers()[0]
                if (rule.getDirectionModifiers().length !== 1) {
                    throw new Error(`BUG: should have already expanded the rule to only contian one direction`)
                }
                for (const [nameToExpand, variations] of expandModifiers) {
                    if (rule.hasModifier(nameToExpand)) {
                        for (const variation of variations) {
                            convertedRules.push(rule.clone(direction, nameToExpand, variation))
                            didExpand = true
                        }
                    }
                }
                if (!didExpand) {
                    // Try expanding PARALLEL and ORTHOGONAL (since they depend on the rule direction)
                    let orthogonals
                    let parallels
                    switch(direction) {
                        case RULE_DIRECTION_ABSOLUTE.UP:
                        case RULE_DIRECTION_ABSOLUTE.DOWN:
                            orthogonals = [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT]
                            parallels = [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN]
                            break
                        case RULE_DIRECTION_ABSOLUTE.LEFT:
                        case RULE_DIRECTION_ABSOLUTE.RIGHT:
                            orthogonals = [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN]
                            parallels = [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT]
                            break
                        default:
                    }
                    if (orthogonals && parallels) {
                        for (const {nameToExpand, variations} of [{nameToExpand: AST_RULE_MODIFIER.ORTHOGONAL, variations: orthogonals}, {nameToExpand: AST_RULE_MODIFIER.PARALLEL, variations: parallels}]) {
                            if (rule.hasModifier(nameToExpand)) {
                                for (const variation of variations) {
                                    convertedRules.push(rule.clone(direction, nameToExpand, variation))
                                    didExpand = true
                                }
                            }
                        }
                    }

                }
                // If nothing was expanded and this is the current rule
                // then just keep it
                if (!didExpand) {
                    convertedRules.push(rule)
                }
            }
            rulesToConvert = convertedRules
            convertedRules = []
        } while (didExpand)

        return rulesToConvert
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        const conditionBrackets = this._brackets.map(bracket => bracket.clone(direction, nameToExpand, newName))
        const actionBrackets = this._actionBrackets.map(bracket => bracket.clone(direction, nameToExpand, newName))
        // retain LATE and RIGID but discard the rest of the modifiers
        let directionModifier
        switch (direction) {
            case RULE_DIRECTION_ABSOLUTE.UP:
                directionModifier = AST_RULE_MODIFIER.UP
                break
            case RULE_DIRECTION_ABSOLUTE.DOWN:
                directionModifier = AST_RULE_MODIFIER.DOWN
                break
            case RULE_DIRECTION_ABSOLUTE.LEFT:
                directionModifier = AST_RULE_MODIFIER.LEFT
                break
            case RULE_DIRECTION_ABSOLUTE.RIGHT:
                directionModifier = AST_RULE_MODIFIER.RIGHT
                break
            default:
                throw new Error(`BUG: Invalid direction "${direction}"`)
        }
        const modifiers = _.intersection(this._modifiers, [AST_RULE_MODIFIER.LATE, AST_RULE_MODIFIER.RIGID, AST_RULE_MODIFIER.RANDOM]).concat([directionModifier])
        return new ASTGameRule(this.__source, modifiers, conditionBrackets, actionBrackets, this._commands, this._debugFlag)
    }

    hasModifier(modifier: AST_RULE_MODIFIER) {
        for (const bracket of this._brackets) {
            for (const neighbor of bracket._getAllNeighbors()) {
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
        if (this._modifiers.indexOf(AST_RULE_MODIFIER.HORIZONTAL) >= 0) {
            return [RULE_DIRECTION_ABSOLUTE.LEFT, RULE_DIRECTION_ABSOLUTE.RIGHT]
        }
        if (this._modifiers.indexOf(AST_RULE_MODIFIER.VERTICAL) >= 0) {
            return [RULE_DIRECTION_ABSOLUTE.UP, RULE_DIRECTION_ABSOLUTE.DOWN]
        }
        const directions = this._modifiers.filter(m => RULE_DIRECTION_ABSOLUTE_SET.has(m)).map(d => {
            switch (d) {
                case AST_RULE_MODIFIER.UP:
                    return RULE_DIRECTION_ABSOLUTE.UP
                case AST_RULE_MODIFIER.DOWN:
                    return RULE_DIRECTION_ABSOLUTE.DOWN
                case AST_RULE_MODIFIER.LEFT:
                    return RULE_DIRECTION_ABSOLUTE.LEFT
                case AST_RULE_MODIFIER.RIGHT:
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

    constructor(source: IGameCode, modifiers: AST_RULE_MODIFIER[], conditions: ASTRuleBracket[], actions: ASTRuleBracket[], commands: AbstractCommand[], debugFlag: DEBUG_FLAG) {
        super(source)
        this._modifiers = modifiers
        this._commands = commands
        this._hasEllipsis = false
        this._brackets = conditions
        this._actionBrackets = actions
        this._debugFlag = debugFlag

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
    }


    isLate() {
        return this._modifiers.indexOf(AST_RULE_MODIFIER.LATE) >= 0
    }
    isRigid() {
        return this._modifiers.indexOf(AST_RULE_MODIFIER.RIGID) >= 0
    }
    isRandom() {
        return this._modifiers.indexOf(AST_RULE_MODIFIER.RANDOM) >= 0
    }

}

export interface IASTRuleBracket extends ICacheable {
    clone: (direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) => IASTRuleBracket
    toSimple: (direction: RULE_DIRECTION_ABSOLUTE, ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) => ISimpleBracket
    hasEllipsis: () => boolean
    _getAllNeighbors: () => ASTRuleBracketNeighbor[]
}

export class ASTRuleBracket extends BaseForLines implements IASTRuleBracket {
    _neighbors: ASTRuleBracketNeighbor[]
    _firstCellsInEachDirection: Map<RULE_DIRECTION, Set<Cell>>
    _debugFlag: DEBUG_FLAG

    constructor(source: IGameCode, neighbors: ASTRuleBracketNeighbor[], hack: Optional<string>, debugFlag: DEBUG_FLAG) {
        super(source)
        this._neighbors = neighbors
        this._debugFlag = debugFlag

        // populate the cache
        this._firstCellsInEachDirection = new Map()
        for (const direction of SIMPLE_DIRECTION_DIRECTIONS) {
            this._firstCellsInEachDirection.set(direction, new Set())
        }
        this._firstCellsInEachDirection.set(RULE_DIRECTION.ACTION, new Set())
    }

    toKey() {
        return this._neighbors.map(n => n.toKey()).join('|')
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        return new ASTRuleBracket(this.__source, this._neighbors.map(n => n.clone(direction, nameToExpand, newName)), null, this._debugFlag)
    }

    toSimple(direction: RULE_DIRECTION_ABSOLUTE, ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return cacheSetAndGet(bracketCache, new SimpleBracket(this.__source, direction, this._neighbors.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)), this._debugFlag))
    }

    _getAllNeighbors() {
        return this._neighbors
    }

    hasEllipsis() {
        return false
    }

}

export class ASTEllipsisRuleBracket extends BaseForLines implements IASTRuleBracket {
    _beforeEllipsisNeighbors: ASTRuleBracketNeighbor[]
    _afterEllipsisNeighbors: ASTRuleBracketNeighbor[]
    _debugFlag: DEBUG_FLAG

    constructor(source: IGameCode, beforeEllipsisNeighbors: ASTRuleBracketNeighbor[], afterEllipsisNeighbors: ASTRuleBracketNeighbor[], debugFlag: DEBUG_FLAG) {
        super(source)
        this._beforeEllipsisNeighbors = beforeEllipsisNeighbors
        this._afterEllipsisNeighbors = afterEllipsisNeighbors
        this._debugFlag = debugFlag
    }

    toKey() {
        return `${this._beforeEllipsisNeighbors.map(n => n.toKey()).join('|')} ... ${this._afterEllipsisNeighbors.map(n => n.toKey()).join('|')}`
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        return new ASTEllipsisRuleBracket(this.__source, this._beforeEllipsisNeighbors.map(n => n.clone(direction, nameToExpand, newName)), this._afterEllipsisNeighbors.map(n => n.clone(direction, nameToExpand, newName)), this._debugFlag)
    }

    toSimple(direction: RULE_DIRECTION_ABSOLUTE, ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return cacheSetAndGet(bracketCache, new SimpleEllipsisBracket(this.__source, direction, this._beforeEllipsisNeighbors.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)), this._afterEllipsisNeighbors.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)), this._debugFlag))
    }

    _getAllNeighbors() {
        return [...this._beforeEllipsisNeighbors, ...this._afterEllipsisNeighbors]
    }


    hasEllipsis() {
        return true
    }

}

export class ASTRuleBracketNeighbor extends BaseForLines implements ICacheable {
    _brackets: ASTRuleBracket[]
    _tilesWithModifier: ASTTileWithModifier[]
    _isEllipsis: boolean
    _localCellCache: Set<Cell>
    _debugFlag: DEBUG_FLAG

    constructor(source: IGameCode, tilesWithModifier: ASTTileWithModifier[], isEllipsis: boolean, debugFlag: DEBUG_FLAG) {
        super(source)
        // See below: this._tilesWithModifier = tilesWithModifier
        this._isEllipsis = isEllipsis

        this._localCellCache = new Set()
        this._brackets = []
        this._debugFlag = debugFlag

        // Collapse duplicate tiles into one.
        // e.g. Cyber-Lasso has the following rule:
        // ... -> [ ElectricFloor Powered no ElectricFloor Claimed ]
        //
        // ElectricFloor occurs twice (one is negated)
        // We keep the first and remove the rest
        const tilesMap = new Map()
        for (const t of tilesWithModifier) {
            if (!tilesMap.has(t._tile)) {
                tilesMap.set(t._tile, t)
            }
        }
        this._tilesWithModifier = [...tilesMap.values()]
    }

    toKey() {
        return `{isEllipsis?${this._isEllipsis} ${this._tilesWithModifier.map(t => t.toKey()).sort().join(' ')} debugging?${this._debugFlag}}`
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        return new ASTRuleBracketNeighbor(this.__source, this._tilesWithModifier.map(t => t.clone(direction, nameToExpand, newName)), this._isEllipsis, this._debugFlag)
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        if (this.isEllipsis()) {
            return new SimpleEllipsisNeighbor(this.__source, new Set(this._tilesWithModifier.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache))), this._debugFlag)
        }
        return cacheSetAndGet(neighborCache, new SimpleNeighbor(this.__source, new Set(this._tilesWithModifier.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache))), this._debugFlag))
    }

    isEllipsis() {
        return this._isEllipsis
    }

}

export class ASTTileWithModifier extends BaseForLines implements ICacheable {
    _neighbors: ASTRuleBracketNeighbor[]
    _modifier: Optional<string>
    _tile: IGameTile
    _debugFlag: DEBUG_FLAG

    constructor(source: IGameCode, modifier: Optional<string>, tile: IGameTile, debugFlag: DEBUG_FLAG) {
        super(source)
        this._modifier = modifier
        this._tile = tile
        this._neighbors = []
        this._debugFlag = debugFlag

        if (!this._tile) {
            console.warn('TODO: Do something about ellipses')
        }

    }

    toKey() {
        return `${this._modifier || ''} ${this._tile ? this._tile.getSprites().map(sprite => sprite.getName()) : '|||(notile)|||'}{debugging?${this._debugFlag}}`
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        switch (this._modifier) {
            case '>':
            case '<':
            case '^':
            case 'v':
                let modifier = relativeDirectionToAbsolute(direction, this._modifier)
                return new ASTTileWithModifier(this.__source, modifier, this._tile, this._debugFlag)
            case nameToExpand:
                return new ASTTileWithModifier(this.__source, newName, this._tile, this._debugFlag)
            default:
                return this
        }
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        if (!this._tile) {
            return new SimpleEllipsisTileWithModifier(this.__source, this.isNo(), this.isRandom(), RULE_DIRECTION_ABSOLUTE.STATIONARY, this._tile, this._debugFlag)
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
        return cacheSetAndGet(tileCache, new SimpleTileWithModifier(this.__source, this.isNo(), this.isRandom(), direction, this._tile, this._debugFlag))
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
}

// Extend RuleBracketNeighbor so that NeighborPair doesn't break
export class ASTHackNode extends ASTRuleBracketNeighbor {
    fields: object

    // These should be addressed as we write the interpreter
    constructor(source: IGameCode, fields: object, debugFlag: DEBUG_FLAG) {
        super(source, [], false, debugFlag)
        this.fields = fields
    }

    isEllipsis() {
        return false
    }
}

export class ASTGameRuleLoop extends BaseForLines {
    _rules: ASTGameRule[]
    _debugFlag: DEBUG_FLAG

    constructor(source: IGameCode, rules: ASTGameRule[], debugFlag: DEBUG_FLAG) {
        super(source)
        this._rules = rules
        this._debugFlag = debugFlag
    }

    simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return new SimpleRuleLoop(this.__source, this.isRandom(), this._rules.map(rule => rule.simplify(ruleCache, bracketCache, neighborCache, tileCache)))
    }
    isRandom() {
        return !!this._rules.filter(r => r.isRandom())[0]
    }
}

export class ASTGameRuleGroup extends ASTGameRuleLoop {
    // Yes. One propagates isRandom while the other does not
    simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return new SimpleRuleGroup(this.__source, this.isRandom(), this._rules.map(rule => rule.simplify(ruleCache, bracketCache, neighborCache, tileCache)))
    }

}

const M_NO = 'NO'

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