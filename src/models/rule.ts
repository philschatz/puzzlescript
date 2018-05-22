import * as _ from 'lodash'
import {
    BaseForLines,
    IGameCode,
    IGameNode
} from '../models/game'
import { IGameTile } from './tile'
import {
    IMutator,
    RuleBracketPair,
    getMatchedMutatorsHelper,
    RULE_DIRECTION,
    SIMPLE_DIRECTIONS,
    CellMutation
} from '../pairs'
import { RULE_MODIFIER, setDifference, setIntersection } from '../util'
import { Cell } from '../engine'
import { GameTree } from '../gameTree';

enum RULE_COMMAND {
    AGAIN = 'AGAIN'
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
    // _conditionCommandPair: RuleConditionCommandPair[]

    constructor(source: IGameCode, modifiers: Set<RULE_MODIFIER>, conditions: RuleBracket[], actions: RuleBracket[], commands: string[]) {
        super(source)
        this._modifiers = modifiers
        this._commands = commands
        this._hasEllipsis = false

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

    evaluate(gameTree: GameTree) {
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
            this._bracketPairs.forEach(bracketPair => {
                const firstMatches = gameTree.getFirstCellMatchesFor(bracketPair, direction)
                if (firstMatches.size === 0) {
                    matchesAllBrackets = false
                }
            })

            if (matchesAllBrackets) {
                // Evaluate!
                const mutators = this._bracketPairs.map(bracketPair => {
                    const firstMatches = new Set(gameTree.getFirstCellMatchesFor(bracketPair, direction)) // Make it an Array just so we copy the elements out because Sets are mutable
                    const ret: CellMutation[][] = []
                    firstMatches.forEach(firstCell => {
                        ret.push(bracketPair.evaluate(direction, firstCell))
                    })
                    return _.flatten(ret)
                })
                allMutators.push(_.flatten(mutators))
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

    constructor(source: IGameCode, neighbors: RuleBracketNeighbor[], hack: string) {
        super(source)
        this._neighbors = neighbors
        this._hasEllipsis = false

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
}

export class RuleBracketNeighbor extends BaseForLines {
    _tilesWithModifier: TileWithModifier[]
    _isEllipsis: boolean

    constructor(source: IGameCode, tilesWithModifier: TileWithModifier[], isEllipsis: boolean) {
        super(source)
        this._tilesWithModifier = tilesWithModifier
        this._isEllipsis = isEllipsis
    }

    isEllipsis() {
        return this._isEllipsis
    }
}

export class TileWithModifier extends BaseForLines {
    _modifier?: string
    _tile: IGameTile

    constructor(source: IGameCode, modifier: string, tile: IGameTile) {
        super(source)
        this._modifier = modifier
        this._tile = tile
    }

    toKey() {
        return `${this._modifier || ''} ${this._tile ? this._tile.getSprites().map(sprite => sprite._getName()) : '|||(notile)|||'}`
    }

    isNo() {
        return M_NO === this._modifier
    }

    matchesCell(cell: Cell, direction: RULE_DIRECTION) {
        if (this._modifier && !SUPPORTED_CELL_MODIFIERS.has(this._modifier)) {
            return false // Modifier not supported yet
        }
        const hasTile = this._tile && this._tile.matchesCell(cell)
        let matchesDirection = true
        if (RULE_DIRECTION[this._modifier]) {
            matchesDirection = cell.wantsToMoveTo(this._tile, relativeDirectionToAbsolute(direction, RULE_DIRECTION[this._modifier]))
        }
        if (this.isNo()) {
            return !(hasTile && matchesDirection)
        } else {
            return hasTile && matchesDirection
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