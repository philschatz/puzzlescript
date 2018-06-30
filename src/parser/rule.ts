import * as _ from 'lodash'
import { ICacheable, DEBUG_FLAG, setDifference, RULE_DIRECTION_ABSOLUTE, RULE_DIRECTION_ABSOLUTE_SET, RULE_DIRECTION_ABSOLUTE_LIST, Optional } from "../util";
import { BaseForLines, IGameCode } from "../models/game";
import { AbstractCommand } from "../models/command";
import { SimpleRule, SimpleBracket, SimpleRuleGroup, SimpleNeighbor, SimpleTileWithModifier, SimpleBracketConditionOnly, SIMPLE_DIRECTION_DIRECTIONS, SimpleRuleLoop, ISimpleBracket, SimpleEllipsisBracket } from "../models/rule";
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
    private readonly modifiers: AST_RULE_MODIFIER[]
    private readonly commands: AbstractCommand[]
    private readonly brackets: ASTRuleBracket[]
    private readonly actionBrackets: ASTRuleBracket[]
    private readonly debugFlag: DEBUG_FLAG // Used for setting a breakpoint when evaluating the rule

    toKey() {
        return `${this.modifiers.join(' ')} ${this.brackets.map(x => x.toKey())} -> ${this.actionBrackets.map(x => x.toKey())} ${this.commands.join(' ')} {debugger?${this.debugFlag}}`
    }

    simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const simpleRules = this.convertToMultiple().map(r => r.toSimple(ruleCache, bracketCache, neighborCache, tileCache))
        // Register listeners to Cell changes
        for (const rule of simpleRules) {
            rule.subscribeToCellChanges()
        }
        return new SimpleRuleGroup(this.__source, this.isRandom(), simpleRules)
    }

    private toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const directions = this.getDirectionModifiers()
        if (directions.length !== 1) {
            throw new Error(`BUG: should have exactly 1 direction by now but found the following: "${directions}"`)
        }

        // Check if the condition matches the action. If so, we can simplify evaluation.
        const conditionBrackets = this.brackets.map(x => x.toSimple(directions[0], ruleCache, bracketCache, neighborCache, tileCache))
        const actionBrackets = this.actionBrackets.map(x => x.toSimple(directions[0], ruleCache, bracketCache, neighborCache, tileCache))

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
                conditionBrackets[index] = new SimpleBracketConditionOnly(condition)
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

        return cacheSetAndGet(ruleCache, new SimpleRule(this.__source, directions[0], conditionBrackets, actionBrackets, this.commands, this.isLate(), this.isRigid(), this.isRandom(), this.debugFlag, doesEvaluationOrderMatter))
    }

    private convertToMultiple() {
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

    private clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        const conditionBrackets = this.brackets.map(bracket => bracket.clone(direction, nameToExpand, newName))
        const actionBrackets = this.actionBrackets.map(bracket => bracket.clone(direction, nameToExpand, newName))
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
        const modifiers = _.intersection(this.modifiers, [AST_RULE_MODIFIER.LATE, AST_RULE_MODIFIER.RIGID, AST_RULE_MODIFIER.RANDOM]).concat([directionModifier])
        return new ASTGameRule(this.__source, modifiers, conditionBrackets, actionBrackets, this.commands, this.debugFlag)
    }

    private hasModifier(modifier: AST_RULE_MODIFIER) {
        for (const bracket of this.brackets) {
            for (const neighbor of bracket._getAllNeighbors()) {
                for (const t of neighbor.tilesWithModifier) {
                    if (t.modifier === modifier) {
                        return true
                    }
                }
            }
        }
        return false
    }

    private getDirectionModifiers() {
        // Convert HORIZONTAL and VERTICAL to 2:
        if (this.modifiers.indexOf(AST_RULE_MODIFIER.HORIZONTAL) >= 0) {
            return [RULE_DIRECTION_ABSOLUTE.LEFT, RULE_DIRECTION_ABSOLUTE.RIGHT]
        }
        if (this.modifiers.indexOf(AST_RULE_MODIFIER.VERTICAL) >= 0) {
            return [RULE_DIRECTION_ABSOLUTE.UP, RULE_DIRECTION_ABSOLUTE.DOWN]
        }
        const directions = this.modifiers.filter(m => RULE_DIRECTION_ABSOLUTE_SET.has(m)).map(d => {
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
        this.modifiers = modifiers
        this.commands = commands
        this.brackets = conditions
        this.actionBrackets = actions
        this.debugFlag = debugFlag

        // Check if valid
        if (conditions.length !== actions.length && actions.length !== 0) {
            throw new Error(`Left side has "${conditions.length}" conditions and right side has "${actions.length}" actions!`)
        }

        if (conditions.length === actions.length) {
        } else if (actions.length !== 0) {
            throw new Error(`Invalid Rule. The number of brackets on the right must match the structure of the left hand side or be 0`)
        }
    }


    private isLate() {
        return this.modifiers.indexOf(AST_RULE_MODIFIER.LATE) >= 0
    }
    private isRigid() {
        return this.modifiers.indexOf(AST_RULE_MODIFIER.RIGID) >= 0
    }
    isRandom() {
        return this.modifiers.indexOf(AST_RULE_MODIFIER.RANDOM) >= 0
    }

}

export interface IASTRuleBracket extends ICacheable {
    clone: (direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) => IASTRuleBracket
    toSimple: (direction: RULE_DIRECTION_ABSOLUTE, ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) => ISimpleBracket
    hasEllipsis: () => boolean
    _getAllNeighbors: () => ASTRuleBracketNeighbor[]
}

export class ASTRuleBracket extends BaseForLines implements IASTRuleBracket {
    private readonly neighbors: ASTRuleBracketNeighbor[]
    private readonly firstCellsInEachDirection: Map<RULE_DIRECTION, Set<Cell>>
    private readonly debugFlag: DEBUG_FLAG

    constructor(source: IGameCode, neighbors: ASTRuleBracketNeighbor[], hack: Optional<string>, debugFlag: DEBUG_FLAG) {
        super(source)
        this.neighbors = neighbors
        this.debugFlag = debugFlag

        // populate the cache
        this.firstCellsInEachDirection = new Map()
        for (const direction of SIMPLE_DIRECTION_DIRECTIONS) {
            this.firstCellsInEachDirection.set(direction, new Set())
        }
        this.firstCellsInEachDirection.set(RULE_DIRECTION.ACTION, new Set())
    }

    toKey() {
        return this.neighbors.map(n => n.toKey()).join('|')
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        return new ASTRuleBracket(this.__source, this.neighbors.map(n => n.clone(direction, nameToExpand, newName)), null, this.debugFlag)
    }

    toSimple(direction: RULE_DIRECTION_ABSOLUTE, ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return cacheSetAndGet(bracketCache, new SimpleBracket(this.__source, direction, this.neighbors.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)), this.debugFlag))
    }

    _getAllNeighbors() {
        return this.neighbors
    }

    hasEllipsis() {
        return false
    }

}

export class ASTEllipsisRuleBracket extends BaseForLines implements IASTRuleBracket {
    private readonly beforeEllipsisNeighbors: ASTRuleBracketNeighbor[]
    private readonly afterEllipsisNeighbors: ASTRuleBracketNeighbor[]
    private readonly debugFlag: DEBUG_FLAG

    constructor(source: IGameCode, beforeEllipsisNeighbors: ASTRuleBracketNeighbor[], afterEllipsisNeighbors: ASTRuleBracketNeighbor[], debugFlag: DEBUG_FLAG) {
        super(source)
        this.beforeEllipsisNeighbors = beforeEllipsisNeighbors
        this.afterEllipsisNeighbors = afterEllipsisNeighbors
        this.debugFlag = debugFlag
    }

    toKey() {
        return `${this.beforeEllipsisNeighbors.map(n => n.toKey()).join('|')} ... ${this.afterEllipsisNeighbors.map(n => n.toKey()).join('|')}`
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        return new ASTEllipsisRuleBracket(this.__source, this.beforeEllipsisNeighbors.map(n => n.clone(direction, nameToExpand, newName)), this.afterEllipsisNeighbors.map(n => n.clone(direction, nameToExpand, newName)), this.debugFlag)
    }

    toSimple(direction: RULE_DIRECTION_ABSOLUTE, ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return cacheSetAndGet(bracketCache, new SimpleEllipsisBracket(this.__source, direction, this.beforeEllipsisNeighbors.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)), this.afterEllipsisNeighbors.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)), this.debugFlag))
    }

    _getAllNeighbors() {
        return [...this.beforeEllipsisNeighbors, ...this.afterEllipsisNeighbors]
    }


    hasEllipsis() {
        return true
    }

}

export class ASTRuleBracketNeighbor extends BaseForLines implements ICacheable {
    readonly tilesWithModifier: ASTTileWithModifier[]
    private readonly debugFlag: DEBUG_FLAG

    constructor(source: IGameCode, tilesWithModifier: ASTTileWithModifier[], debugFlag: DEBUG_FLAG) {
        super(source)
        this.debugFlag = debugFlag

        // Collapse duplicate tiles into one.
        // e.g. Cyber-Lasso has the following rule:
        // ... -> [ ElectricFloor Powered no ElectricFloor Claimed ]
        //
        // ElectricFloor occurs twice (one is negated)
        // We keep the first and remove the rest
        const tilesMap = new Map()
        for (const t of tilesWithModifier) {
            if (!tilesMap.has(t.tile)) {
                tilesMap.set(t.tile, t)
            }
        }
        this.tilesWithModifier = [...tilesMap.values()]
    }

    toKey() {
        return `{${this.tilesWithModifier.map(t => t.toKey()).sort().join(' ')} debugging?${this.debugFlag}}`
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        return new ASTRuleBracketNeighbor(this.__source, this.tilesWithModifier.map(t => t.clone(direction, nameToExpand, newName)), this.debugFlag)
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return cacheSetAndGet(neighborCache, new SimpleNeighbor(this.__source, new Set(this.tilesWithModifier.map(x => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache))), this.debugFlag))
    }
}

export class ASTTileWithModifier extends BaseForLines implements ICacheable {
    readonly modifier: Optional<string>
    readonly tile: IGameTile
    private readonly debugFlag: DEBUG_FLAG

    constructor(source: IGameCode, modifier: Optional<string>, tile: IGameTile, debugFlag: DEBUG_FLAG) {
        super(source)
        this.modifier = modifier
        this.tile = tile
        this.debugFlag = debugFlag

        if (!this.tile) {
            console.warn('TODO: Do something about ellipses')
        }

    }

    toKey() {
        return `${this.modifier || ''} ${this.tile ? this.tile.getSprites().map(sprite => sprite.getName()) : '|||(notile)|||'}{debugging?${this.debugFlag}}`
    }

    clone(direction: RULE_DIRECTION_ABSOLUTE, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        switch (this.modifier) {
            case '>':
            case '<':
            case '^':
            case 'v':
                let modifier = relativeDirectionToAbsolute(direction, this.modifier)
                return new ASTTileWithModifier(this.__source, modifier, this.tile, this.debugFlag)
            case nameToExpand:
                return new ASTTileWithModifier(this.__source, newName, this.tile, this.debugFlag)
            default:
                return this
        }
    }

    toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        let direction
        switch (this.modifier) {
            case 'UP':
            case 'DOWN':
            case 'LEFT':
            case 'RIGHT':
                direction = RULE_DIRECTION_ABSOLUTE[this.modifier]
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
        return cacheSetAndGet(tileCache, new SimpleTileWithModifier(this.__source, this.isNo(), this.isRandom(), direction, this.tile, this.debugFlag))
    }

    isNo() {
        return this.modifier === M_NO
    }
    isRandom() {
        return this.modifier === RULE_DIRECTION.RANDOM
    }
    isRandomDir() {
        return this.modifier === RULE_DIRECTION.RANDOMDIR
    }
}

// Extend RuleBracketNeighbor so that NeighborPair doesn't break
export class ASTHackNode extends ASTRuleBracketNeighbor {
    fields: object

    // These should be addressed as we write the interpreter
    constructor(source: IGameCode, fields: object, debugFlag: DEBUG_FLAG) {
        super(source, [], debugFlag)
        this.fields = fields
    }
}

export class ASTGameRuleLoop extends BaseForLines {
    readonly rules: ASTGameRule[]

    constructor(source: IGameCode, rules: ASTGameRule[], debugFlag: DEBUG_FLAG) {
        super(source)
        this.rules = rules
    }

    simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return new SimpleRuleLoop(this.__source, this.isRandom(), this.rules.map(rule => rule.simplify(ruleCache, bracketCache, neighborCache, tileCache)))
    }
    isRandom() {
        return !!this.rules.filter(r => r.isRandom())[0]
    }
}

export class ASTGameRuleGroup extends ASTGameRuleLoop {
    // Yes. One propagates isRandom while the other does not
    simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return new SimpleRuleGroup(this.__source, this.isRandom(), this.rules.map(rule => rule.simplify(ruleCache, bracketCache, neighborCache, tileCache)))
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