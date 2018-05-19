// Maybe call this file `matchers.ts`?

import * as _ from 'lodash'
import {
  GameRule,
  RuleBracket,
  RuleBracketNeighbor,
  TileWithModifier
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
  let ret: IMutator[] = []
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


export class RuleBracketPair implements IMatcher {
  _modifiers: Set<RULE_MODIFIER>
  _neighborPairs: NeighborPair[]

  // boilerplate constructor
  constructor(modifiers: Set<RULE_MODIFIER>, condition: RuleBracket, action: RuleBracket) {
    this._modifiers = modifiers
    this._neighborPairs = _.zip(condition._neighbors, action._neighbors).map(([conditionTileWithModifier, actionTileWithModifier]) => {
      return new NeighborPair(conditionTileWithModifier, actionTileWithModifier)
    })
  }

  getMatchedMutatorsOrNull(cell) {
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
        const mutators = neighbor.getMatchedMutatorsOrNull(curCell)
        if (!mutators) break
        neighborRet = neighborRet.concat(mutators)

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

class NeighborPair implements IMatcher {
  _condition: RuleBracketNeighbor
  _action: RuleBracketNeighbor
  _tileWithModifierPairs: TileWithModifierPair[]

  constructor(condition: RuleBracketNeighbor, action: RuleBracketNeighbor) {
    this._condition = condition
    this._action = action
    this._tileWithModifierPairs = _.zip(this._condition._tilesWithModifier, this._action._tilesWithModifier).map(([conditionTileWithModifier, actionTileWithModifier]) => {
      return new TileWithModifierPair(conditionTileWithModifier, actionTileWithModifier)
    })
  }

  getMatchedMutatorsOrNull(cell: Cell) {
    for (const tileWithModifier of this._tileWithModifierPairs) {
      if (!tileWithModifier.matchesCell(cell)) {
        return null
      }
    }
    return [new CellMutator(this._condition._tilesWithModifier, this._action._tilesWithModifier, cell)]
  }
}

class TileWithModifierPair {
  _condition: TileWithModifier
  _action: TileWithModifier
  constructor(condition: TileWithModifier, action: TileWithModifier) {
    if (!this._condition) {
      throw new Error('sdklfjsldkjflsdkjflsdkfj')
    }
    this._condition = condition
    this._action = action
  }
  matchesCell(cell: Cell) {
    const hasTile = cell.getSpritesAsSet().has(this._condition._tile)
    if (this._condition.isNo()) {
      return !hasTile
    } else {
      return hasTile
    }
  }
}

class CellMutator implements IMutator {
  _condition: TileWithModifier[]
  _action: TileWithModifier[]
  _cell: Cell
  constructor(condition: TileWithModifier[], action: TileWithModifier[], cell) {
    this._condition = condition
    this._action = action
    this._cell = cell
  }
  mutate() {
    // Just remove all tiles for now and then add all of them back
    // TODO: only remove tiles that are matching the collisionLayer but wait, they already need to be exclusive
    const newSetOfSprites = new Set(this._cell.getSpritesAsSet())

    // remove sprites that are listed on the condition side
    this._condition.forEach(tileWithModifier => {
      tileWithModifier._tile.getSprites().forEach(sprite => {
        newSetOfSprites.delete(sprite)
      })
    })
    this._action.forEach(tileWithModifier => {
      tileWithModifier._tile.getSprites().forEach(sprite => {
        if (tileWithModifier.isNo()) {
          newSetOfSprites.delete(sprite)
        } else {
          newSetOfSprites.add(sprite)
        }
      })
    })

    if (!this._cell.equalsSprites(newSetOfSprites)) {
      this._cell.updateSprites(newSetOfSprites)
      return [this._cell]
    } else {
      return []
    }
  }
}