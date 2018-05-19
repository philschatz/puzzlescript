 // Maybe call this file `matchers.ts`?

import * as _ from 'lodash'
import {
  GameRule,
  RuleBracket,
  RuleBracketNeighbor
} from './parser'
import { Cell } from './engine'
import { RULE_MODIFIER, setIntersection, setDifference } from './util'

export interface IMutator {
  mutate: () => Cell[]
}
interface IMatcher {
  getMatchedMutatorsOrNull: (cell: Cell) => IMutator[] | null
}

export function getMatchedMutatorsHelper(pairs: IMatcher[], cell: Cell) {
  let ret : IMutator[] = []
  for (const pair of pairs) {
    const retChild = pair.getMatchedMutatorsOrNull(cell)
    if (!retChild) return null
    ret = ret.concat(retChild)
  }
  return ret
}



const SIMPLE_DIRECTIONS = new Set([
  RULE_MODIFIER.UP,
  RULE_MODIFIER.DOWN,
  RULE_MODIFIER.LEFT,
  RULE_MODIFIER.RIGHT
])



export class RuleConditionActionPair implements IMatcher {
  _bracketPairs: RuleBracketPair[]

  // boilerplate constructor
  constructor (modifiers: Set<RULE_MODIFIER>, condition: RuleBracket, action: RuleBracket) {
    this._bracketPairs = _.zip(condition._neighbors, action._neighbors).map(([conditionBracket, actionBracket]) => {
      return new RuleBracketPair(modifiers, conditionBracket, actionBracket)
    })
  }

  getMatchedMutatorsOrNull (cell) {
    if (this._bracketPairs.length !== 1) {
      return null // not supported yet
    }
    return getMatchedMutatorsHelper(this._bracketPairs, cell)
  }
}

class RuleBracketPair implements IMatcher {
  _modifiers: Set<RULE_MODIFIER>
  _neighborPairs: NeighborPair[]

  // boilerplate constructor
  constructor(modifiers: Set<RULE_MODIFIER>, condition: RuleBracket, action: RuleBracket) {
    this._modifiers = modifiers
    this._neighborPairs = _.zip(condition._neighbors, action._neighbors).map(([conditionTileWithModifier, actionTileWithModifier]) => {
      return new NeighborPair(conditionTileWithModifier, actionTileWithModifier)
    })
  }

  getMatchedMutatorsOrNull (cell) {
    if (this._modifiers.has(RULE_MODIFIER.RANDOM) || this._modifiers.has(RULE_MODIFIER.LATE) || this._modifiers.has(RULE_MODIFIER.RIGID)) {
      // These are not implemented yet so ignore them
      return null
    }

    // Determine which directions to loop over
    // Include any simple UP, DOWN, LEFT, RIGHT ones
    let directionsToCheck = setIntersection(this._modifiers, SIMPLE_DIRECTIONS)
    // Include LEFT and RIGHT if HORIZONTAL
    if (this._modifiers.has(RULE_MODIFIER.HORIZONTAL)) {
      directionsToCheck.add(RULE_MODIFIER.LEFT)
      directionsToCheck.add(RULE_MODIFIER.RIGHT)
    }
    // Include UP and DOWN if VERTICAL
    if (this._modifiers.has(RULE_MODIFIER.VERTICAL)) {
      directionsToCheck.add(RULE_MODIFIER.UP)
      directionsToCheck.add(RULE_MODIFIER.DOWN)
    }
    // If no direction was specified then check UP, DOWN, LEFT, RIGHT
    if (directionsToCheck.size === 0 || this._modifiers.has(RULE_MODIFIER.ORTHOGONAL)) {
      directionsToCheck = new Set(SIMPLE_DIRECTIONS)
    }

    // Walk through each neighbor, checking if the adjacent cell matches.
    // If any do not match, return null (the pattern did not match)
    let ret = []
    let curCell = cell
    for (const direction of directionsToCheck) {
      let neighborRet = []
      for (const neighbor of this._neighborPairs) {
        if (!curCell) break // If we hit the end of the level then this does not match
        // Check if the individual tiles match
        const mutators = neighbor.matchesCell(curCell)
        if (!mutators) break
        neighborRet.push(mutators)

        // Move to the next neighboring cell
        curCell = curCell.getNeighbor(direction)
      }

      // If all the neighbors were matched then return the mutators
      if (neighborRet.length === this._neighborPairs.length) {
        ret = ret.concat(neighborRet)
      }
    }

    if (ret.length > 0) {
      return ret
    } else {
      return null
    }
  }
}

class NeighborPair {
  _condition: RuleBracketNeighbor
  _action: RuleBracketNeighbor

  constructor(condition: RuleBracketNeighbor, action: RuleBracketNeighbor) {
    this._condition = condition
    this._action = action
  }

  matchesCell (cell: Cell) {
    return this._condition._tile.matchesCell(cell)
  }
}
