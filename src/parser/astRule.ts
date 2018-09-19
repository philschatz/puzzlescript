import { Cell } from '../engine'
import { BaseForLines, IGameCode } from '../models/BaseForLines'
import { AbstractCommand } from '../models/command'
import {
    IRule,
    ISimpleBracket,
    SIMPLE_DIRECTION_DIRECTIONS,
    SimpleBracket,
    SimpleEllipsisBracket,
    SimpleNeighbor,
    SimpleRule,
    SimpleRuleGroup,
    SimpleRuleLoop,
    SimpleTileWithModifier} from '../models/rule'
import { IGameTile } from '../models/tile'
import { DEBUG_FLAG, ICacheable, Optional, RULE_DIRECTION, setIntersection } from '../util'

export enum AST_RULE_MODIFIER {
    RANDOM = 'RANDOM',
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    VERTICAL = 'VERTICAL',
    HORIZONTAL = 'HORIZONTAL',
    ORTHOGONAL = 'ORTHOGONAL',
    PERPENDICULAR = 'PERPENDICULAR',
    PARALLEL = 'PARALLEL',
    MOVING = 'MOVING',
    LATE = 'LATE',
    RIGID = 'RIGID'
}

const RULE_DIRECTION_LIST = [
    RULE_DIRECTION.UP,
    RULE_DIRECTION.DOWN,
    RULE_DIRECTION.LEFT,
    RULE_DIRECTION.RIGHT
]

const RULE_DIRECTION_SET: Set<string> = new Set(RULE_DIRECTION_LIST)

function cacheSetAndGet<A extends ICacheable>(cache: Map<string, A>, obj: A) {
    const key = obj.toKey()
    if (!cache.has(key)) {
        cache.set(key, obj)
    }
    return cache.get(key) as A
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
/**
 * Represents a rule as written in the game as well as the expanded intermediate version.
 *
 * See `.simplify()` for more details on the expanded intermediate version.
 */
export class ASTRule extends BaseForLines {
    private readonly modifiers: AST_RULE_MODIFIER[]
    private readonly commands: AbstractCommand[]
    private readonly brackets: IASTRuleBracket[]
    private readonly actionBrackets: IASTRuleBracket[]
    private readonly debugFlag: Optional<DEBUG_FLAG> // Used for setting a breakpoint when evaluating the rule

    constructor(source: IGameCode, modifiers: AST_RULE_MODIFIER[], conditions: IASTRuleBracket[], actions: IASTRuleBracket[], commands: AbstractCommand[], debugFlag: Optional<DEBUG_FLAG>) {
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
            // do nothing
        } else if (actions.length !== 0) {
            throw new Error(`Invalid Rule. The number of brackets on the right must match the structure of the left hand side or be 0`)
        }
    }

    // toKey() {
    //     return `${this.modifiers.join(' ')} ${this.brackets.map(x => x.toKey())} -> ${this.actionBrackets.map(x => x.toKey())} ${this.commands.join(' ')} {debugger?${this.debugFlag}}`
    // }

    /**
     * Expands this Rule into multiple `ASTRule` objects and then converts each one into a `SimpleRule`.
     *
     * For example, `HORIZONTAL [ > player ] -> [ < crate ]` gets expanded to the following `ASTRule`s:
     *
     * -  `LEFT  [ LEFT  player ] -> [ RIGHT crate ]`
     * -  `RIGHT [ RIGHT player ] -> [ LEFT  crate ]`
     *
     * and then each one is converted into a `SimpleRule` which only has absolute directions
     * rather than the relative ones that were specified in the original game code.
     *
     * @param ruleCache A cache for de-duplicating rules (so fewer need to be updated when the game is played)
     * @param bracketCache A cache for de-duplicating brackets found in the game (so fewer need to be updated)
     * @param neighborCache A cache for de-duplicating neighbors found in the game (so fewer need to be updated)
     * @param tileCache A cache for de-duplicating tiles in the game (so fewer need to be updated)
     */
    public simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const simpleRules = this.convertToMultiple().map((r) => r.toSimple(ruleCache, bracketCache, neighborCache, tileCache))
        // If the brackets are all the same object then that means we can just output 1 rule
        // (the brackets don't have any directions. Otherwise they would not have been
        // deduplicated as part of the .toKey() and cacheGetAndSet)
        const isDuplicate = simpleRules.length === 1 || (!this.isRandom() && simpleRules[1] && simpleRules[0].canCollapseBecauseBracketsMatch(simpleRules[1]))
        if (isDuplicate) {
            simpleRules[0].subscribeToCellChanges()
            // we still need it to be in a RuleGroup
            // so the Rule can be evaluated multiple times (not just once)
            return new SimpleRuleGroup(this.__source, this.isRandom(), [simpleRules[0]])
        } else {
            for (const rule of simpleRules) {
                rule.subscribeToCellChanges()
            }
            return new SimpleRuleGroup(this.__source, this.isRandom(), simpleRules)
        }
    }
    public isRandom() {
        return this.modifiers.indexOf(AST_RULE_MODIFIER.RANDOM) >= 0
    }

    private toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const directions = this.getDirectionModifiers()
        if (directions.length !== 1) {
            throw new Error(`BUG: should have exactly 1 direction by now but found the following: "${directions}"`)
        }

        // Check if the condition matches the action. If so, we can simplify evaluation.
        const conditionBrackets = this.brackets.map((x) => x.toSimple(directions[0], ruleCache, bracketCache, neighborCache, tileCache))
        const actionBrackets = this.actionBrackets.map((x) => x.toSimple(directions[0], ruleCache, bracketCache, neighborCache, tileCache))

        for (let index = 0; index < conditionBrackets.length; index++) {
            const action = actionBrackets[index]
            // Skip rules with no action bracket `[ > Player ] -> CHECKPOINT`
            if (!action) {
                continue
            }
        }
        return cacheSetAndGet(ruleCache, new SimpleRule(this.__source, directions[0], conditionBrackets, actionBrackets, this.commands, this.isLate(), this.isRigid(), this.debugFlag))
    }

    private convertToMultiple() {
        let rulesToConvert = []
        let convertedRules: ASTRule[] = []

        for (const direction of this.getDirectionModifiers()) {
            const expandedDirection = this.clone(direction, null, null)
            rulesToConvert.push(expandedDirection)
        }

        const expandModifiers = new Map()
        expandModifiers.set(AST_RULE_MODIFIER.HORIZONTAL, [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT])
        expandModifiers.set(AST_RULE_MODIFIER.VERTICAL, [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN])
        expandModifiers.set(AST_RULE_MODIFIER.MOVING, [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN, RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT, RULE_DIRECTION.ACTION])

        let didExpandRulesToConvert
        do {
            didExpandRulesToConvert = false
            for (const rule of rulesToConvert) {
                let didExpand = false
                const direction = rule.getDirectionModifiers()[0]
                if (rule.getDirectionModifiers().length !== 1) {
                    throw new Error(`BUG: should have already expanded the rule to only contian one direction`)
                }
                for (const [nameToExpand, variations] of expandModifiers) {
                    if (rule.hasModifier(nameToExpand)) {
                        for (const variation of variations) {
                            convertedRules.push(rule.clone(direction, nameToExpand, variation))
                            didExpand = true
                            didExpandRulesToConvert = true
                        }
                    }
                }
                if (!didExpand) {
                    // Try expanding PARALLEL and ORTHOGONAL (since they depend on the rule direction)
                    let perpendiculars
                    let parallels
                    switch (direction) {
                        case RULE_DIRECTION.UP:
                        case RULE_DIRECTION.DOWN:
                            perpendiculars = [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT]
                            parallels = [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN]
                            break
                        case RULE_DIRECTION.LEFT:
                        case RULE_DIRECTION.RIGHT:
                            perpendiculars = [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN]
                            parallels = [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT]
                            break
                        default:
                            throw new Error(`BUG: There must be some direction`)
                    }
                    if (perpendiculars && parallels) {
                        const orthoParallels = [
                            { nameToExpand: AST_RULE_MODIFIER.ORTHOGONAL, variations: perpendiculars },
                            { nameToExpand: AST_RULE_MODIFIER.PERPENDICULAR, variations: perpendiculars },
                            { nameToExpand: AST_RULE_MODIFIER.PARALLEL, variations: parallels }
                        ]
                        for (const { nameToExpand, variations } of orthoParallels) {

                            if (rule.hasModifier(nameToExpand)) {
                                for (const variation of variations) {
                                    convertedRules.push(rule.clone(direction, nameToExpand, variation))
                                    didExpand = true
                                    didExpandRulesToConvert = true
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
        } while (didExpandRulesToConvert)

        return rulesToConvert
    }

    private clone(direction: RULE_DIRECTION, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        const conditionBrackets = this.brackets.map((bracket) => bracket.clone(direction, nameToExpand, newName))
        const actionBrackets = this.actionBrackets.map((bracket) => bracket.clone(direction, nameToExpand, newName))
        // retain LATE and RIGID but discard the rest of the modifiers
        let directionModifier
        switch (direction) {
            case RULE_DIRECTION.UP:
                directionModifier = AST_RULE_MODIFIER.UP
                break
            case RULE_DIRECTION.DOWN:
                directionModifier = AST_RULE_MODIFIER.DOWN
                break
            case RULE_DIRECTION.LEFT:
                directionModifier = AST_RULE_MODIFIER.LEFT
                break
            case RULE_DIRECTION.RIGHT:
                directionModifier = AST_RULE_MODIFIER.RIGHT
                break
            default:
                throw new Error(`BUG: Invalid direction "${direction}"`)
        }
        const modifiers = [...setIntersection(new Set(this.modifiers), [AST_RULE_MODIFIER.LATE, AST_RULE_MODIFIER.RIGID, AST_RULE_MODIFIER.RANDOM])].concat([directionModifier])
        return new ASTRule(this.__source, modifiers, conditionBrackets, actionBrackets, this.commands, this.debugFlag)
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
            return [RULE_DIRECTION.LEFT, RULE_DIRECTION.RIGHT]
        }
        if (this.modifiers.indexOf(AST_RULE_MODIFIER.VERTICAL) >= 0) {
            return [RULE_DIRECTION.UP, RULE_DIRECTION.DOWN]
        }
        const directions = this.modifiers.filter((m) => RULE_DIRECTION_SET.has(m)).map((d) => {
            switch (d) {
                case AST_RULE_MODIFIER.UP:
                    return RULE_DIRECTION.UP
                case AST_RULE_MODIFIER.DOWN:
                    return RULE_DIRECTION.DOWN
                case AST_RULE_MODIFIER.LEFT:
                    return RULE_DIRECTION.LEFT
                case AST_RULE_MODIFIER.RIGHT:
                    return RULE_DIRECTION.RIGHT
                default:
                    throw new Error(`BUG: Invalid rule direction "${d}"`)
            }
        })
        if (directions.length === 0) {
            return RULE_DIRECTION_LIST
        } else {
            return directions
        }
    }

    private isLate() {
        return this.modifiers.indexOf(AST_RULE_MODIFIER.LATE) >= 0
    }
    private isRigid() {
        return this.modifiers.indexOf(AST_RULE_MODIFIER.RIGID) >= 0
    }
}

export interface IASTRuleBracket extends ICacheable {
    clone: (direction: RULE_DIRECTION, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) => IASTRuleBracket
    toSimple: (direction: RULE_DIRECTION, ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>,
               neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) => ISimpleBracket
    _getAllNeighbors: () => ASTRuleBracketNeighbor[]
}

export class ASTRuleBracket extends BaseForLines implements IASTRuleBracket {
    private readonly neighbors: ASTRuleBracketNeighbor[]
    private readonly firstCellsInEachDirection: Map<RULE_DIRECTION, Set<Cell>>
    private readonly debugFlag: Optional<DEBUG_FLAG>

    constructor(source: IGameCode, neighbors: ASTRuleBracketNeighbor[], hack: Optional<string>, debugFlag: Optional<DEBUG_FLAG>) {
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

    public toKey() {
        return this.neighbors.map((n) => n.toKey()).join('|')
    }

    public clone(direction: RULE_DIRECTION, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        return new ASTRuleBracket(this.__source, this.neighbors.map((n) => n.clone(direction, nameToExpand, newName)), null, this.debugFlag)
    }

    public toSimple(direction: RULE_DIRECTION, ruleCache: Map<string, SimpleRule>,
                    bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>,
                    tileCache: Map<string, SimpleTileWithModifier>) {

        return cacheSetAndGet(bracketCache, new SimpleBracket(this.__source, direction, this.neighbors.map((x) => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)), this.debugFlag))
    }

    public _getAllNeighbors() {
        return this.neighbors
    }
}

export class ASTRuleBracketEllipsis extends BaseForLines implements IASTRuleBracket {
    private readonly beforeEllipsisNeighbors: ASTRuleBracketNeighbor[]
    private readonly afterEllipsisNeighbors: ASTRuleBracketNeighbor[]
    private readonly debugFlag: Optional<DEBUG_FLAG>

    constructor(source: IGameCode, beforeEllipsisNeighbors: ASTRuleBracketNeighbor[], afterEllipsisNeighbors: ASTRuleBracketNeighbor[], debugFlag: Optional<DEBUG_FLAG>) {
        super(source)
        this.beforeEllipsisNeighbors = beforeEllipsisNeighbors
        this.afterEllipsisNeighbors = afterEllipsisNeighbors
        this.debugFlag = debugFlag
    }

    public toKey() {
        return `${this.beforeEllipsisNeighbors.map((n) => n.toKey()).join('|')} ... ${this.afterEllipsisNeighbors.map((n) => n.toKey()).join('|')}`
    }

    public clone(direction: RULE_DIRECTION, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        const beforeEllipsis = this.beforeEllipsisNeighbors.map((n) => n.clone(direction, nameToExpand, newName))
        const afterEllipsis = this.afterEllipsisNeighbors.map((n) => n.clone(direction, nameToExpand, newName))
        return new ASTRuleBracketEllipsis(this.__source, beforeEllipsis, afterEllipsis, this.debugFlag)
    }

    public toSimple(direction: RULE_DIRECTION, ruleCache: Map<string, SimpleRule>,
                    bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>,
                    tileCache: Map<string, SimpleTileWithModifier>) {

        const beforeEllipsis = this.beforeEllipsisNeighbors.map((x) => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache))
        const afterEllipsis = this.afterEllipsisNeighbors.map((x) => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache))
        return cacheSetAndGet(bracketCache, new SimpleEllipsisBracket(this.__source, direction, beforeEllipsis, afterEllipsis, this.debugFlag))
    }

    public _getAllNeighbors() {
        return [...this.beforeEllipsisNeighbors, ...this.afterEllipsisNeighbors]
    }
}

export class ASTRuleBracketNeighbor extends BaseForLines implements ICacheable {
    public readonly tilesWithModifier: ASTTileWithModifier[]
    private readonly debugFlag: Optional<DEBUG_FLAG>

    constructor(source: IGameCode, tilesWithModifier: ASTTileWithModifier[], debugFlag: Optional<DEBUG_FLAG>) {
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

    public toKey() {
        return `{${this.tilesWithModifier.map((t) => t.toKey()).sort().join(' ')} debugging?${!!this.debugFlag}}`
    }

    public clone(direction: RULE_DIRECTION, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        return new ASTRuleBracketNeighbor(this.__source, this.tilesWithModifier.map((t) => t.clone(direction, nameToExpand, newName)), this.debugFlag)
    }

    public toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const simpleTilesWithModifier = new Set(this.tilesWithModifier.map((x) => x.toSimple(ruleCache, bracketCache, neighborCache, tileCache)))
        return cacheSetAndGet(neighborCache, new SimpleNeighbor(this.__source, simpleTilesWithModifier, this.debugFlag))
    }
}

const M_NO = 'NO'

export class ASTTileWithModifier extends BaseForLines implements ICacheable {
    public readonly modifier: Optional<string>
    public readonly tile: IGameTile
    private readonly debugFlag: Optional<DEBUG_FLAG>

    constructor(source: IGameCode, modifier: Optional<string>, tile: IGameTile, debugFlag: Optional<DEBUG_FLAG>) {
        super(source)
        this.modifier = modifier
        this.tile = tile
        this.debugFlag = debugFlag
    }

    public toKey() {
        return `${this.modifier || ''} ${this.tile ? this.tile.getSprites().map((sprite) => sprite.getName()) : '|||(notile)|||'}{debugging?${!!this.debugFlag}}`
    }

    public clone(direction: RULE_DIRECTION, nameToExpand: Optional<AST_RULE_MODIFIER>, newName: Optional<RULE_DIRECTION>) {
        switch (this.modifier) {
            case '>':
            case '<':
            case '^':
            case 'v':
                const modifier = relativeDirectionToAbsolute(direction, this.modifier)
                return new ASTTileWithModifier(this.__source, modifier, this.tile, this.debugFlag)
            case nameToExpand:
                return new ASTTileWithModifier(this.__source, newName, this.tile, this.debugFlag)
            default:
                return this
        }
    }

    public toSimple(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        let direction
        switch (this.modifier) {
            case 'UP':
            case 'DOWN':
            case 'LEFT':
            case 'RIGHT':
                direction = RULE_DIRECTION[this.modifier]
                break
            case 'STATIONARY':
                direction = RULE_DIRECTION.STATIONARY
                break
            case 'ACTION':
                direction = RULE_DIRECTION.ACTION
                break
            case 'RANDOMDIR':
                direction = RULE_DIRECTION.RANDOMDIR
                break
            default:
                direction = null
        }
        return cacheSetAndGet(tileCache, new SimpleTileWithModifier(this.__source, this.isNo(), this.isRandom(), direction, this.tile, this.debugFlag))
    }

    public isNo() {
        return this.modifier === M_NO
    }
    public isRandom() {
        return this.modifier === AST_RULE_MODIFIER.RANDOM
    }
}

// Extend RuleBracketNeighbor so that NeighborPair doesn't break
export class ASTRuleBracketNeighborHack extends ASTRuleBracketNeighbor {
    public fields: object

    // These should be addressed as we write the interpreter
    constructor(source: IGameCode, fields: object, debugFlag: DEBUG_FLAG) {
        super(source, [], debugFlag)
        this.fields = fields
    }
}

export abstract class AbstractRuleish extends BaseForLines {

    public abstract simplify(ruleCache: Map<string, SimpleRule>,
                             bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>,
                             tileCache: Map<string, SimpleTileWithModifier>): IRule
}

export class ASTRuleLoop extends AbstractRuleish {
    private readonly rules: AbstractRuleish[]

    constructor(source: IGameCode, rules: AbstractRuleish[], debugFlag: Optional<DEBUG_FLAG>) {
        super(source)
        this.rules = rules
    }

    public simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        return new SimpleRuleLoop(this.__source, false/*isRandom*/, this.rules.map((rule) => rule.simplify(ruleCache, bracketCache, neighborCache, tileCache)))
    }
}

export class ASTRuleGroup extends BaseForLines {
    private isRandom: boolean
    private readonly rules: AbstractRuleish[]
    constructor(source: IGameCode, isRandom: boolean, rules: AbstractRuleish[], debugFlag: Optional<DEBUG_FLAG>) {
        super(source)
        this.isRandom = isRandom
        this.rules = rules
    }
    // Yes. One propagates isRandom while the other does not
    public simplify(ruleCache: Map<string, SimpleRule>, bracketCache: Map<string, ISimpleBracket>, neighborCache: Map<string, SimpleNeighbor>, tileCache: Map<string, SimpleTileWithModifier>) {
        const rules = this.rules.map((rule) => rule.simplify(ruleCache, bracketCache, neighborCache, tileCache))
        // if (rules.length === 1) {
        //     return rules[0]
        // }
        return new SimpleRuleGroup(this.__source, this.isRandom, rules)
    }

}

export function relativeDirectionToAbsolute(currentDirection: RULE_DIRECTION, relativeModifier: string) {
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
            return RULE_DIRECTION.RIGHT
        case 1:
            return RULE_DIRECTION.UP
        case 2:
            return RULE_DIRECTION.LEFT
        case 3:
            return RULE_DIRECTION.DOWN
        default:
            throw new Error(`BUG! Incorrectly computed rule direction "${currentDirection}" "${relativeModifier}"`)
    }
}
