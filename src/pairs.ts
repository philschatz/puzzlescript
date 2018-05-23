// Maybe call this file `matchers.ts`?

import * as _ from 'lodash'
import {
  GameRule,
  RuleBracket,
  RuleBracketNeighbor,
  TileWithModifier
} from './models/rule'
import { Cell } from './engine'
import { RULE_MODIFIER, setIntersection, setDifference, setEquals, nextRandom } from './util'
import { RULE_DIRECTION } from './enums';
import { IGameTile } from './models/tile';

export class CellMutation {
  cell: Cell
  didSpritesChange: boolean
  constructor(cell, didSpritesChange) {
    this.cell = cell
    this.didSpritesChange = didSpritesChange
  }
}

export interface IMutator {
  mutate: () => CellMutation
}

export interface IMatcher {
  getMatchedMutatorsOrNull: (cell: Cell, direction?: RULE_DIRECTION) => IMutator[] | null
}

export function getMatchedMutatorsHelper(pairs: IMatcher[], cell: Cell, direction?: RULE_DIRECTION) {
  let ret: IMutator[] = []
  for (const pair of pairs) {
    const retChild = pair.getMatchedMutatorsOrNull(cell, direction)
    if (!retChild) return null
    ret = ret.concat(retChild)
  }
  return ret
}

export const SIMPLE_DIRECTIONS = new Set([
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

  evaluate(direction: RULE_DIRECTION, firstCell: Cell) {
    let curCell = firstCell
    return this._neighborPairs.map(neighborPair => {
      const ret = neighborPair.evaluate(direction, curCell)
      curCell = curCell.getNeighbor(direction)
      return ret
    })
  }

  getMatchedMutatorsOrNull(cell: Cell) {
    if (this._modifiers.has(RULE_MODIFIER.RANDOM) || this._modifiers.has(RULE_MODIFIER.LATE) || this._modifiers.has(RULE_MODIFIER.RIGID)) {
      // These are not implemented yet so ignore them
      return null
    }

    // Determine which directions to loop over
    // Include any simple UP, DOWN, LEFT, RIGHT ones
    let directionsToCheck = setIntersection(this._modifiers, SIMPLE_DIRECTIONS)
    // Include LEFT and RIGHT if HORIZONTAL
    if (this._modifiers.has(RULE_MODIFIER.HORIZONTAL)) {
      return null // not supported properly
      // directionsToCheck.add(RULE_MODIFIER.LEFT)
      // directionsToCheck.add(RULE_MODIFIER.RIGHT)
    }
    // Include UP and DOWN if VERTICAL
    if (this._modifiers.has(RULE_MODIFIER.VERTICAL)) {
      return null // not supported properly
      // directionsToCheck.add(RULE_MODIFIER.UP)
      // directionsToCheck.add(RULE_MODIFIER.DOWN)
    }
    // If no direction was specified then check UP, DOWN, LEFT, RIGHT
    if (directionsToCheck.size === 0) {
      directionsToCheck = new Set(SIMPLE_DIRECTIONS)
    }

    // Walk through each neighbor, checking if the adjacent cell matches.
    // If any do not match, return null (the pattern did not match)
    let ret: IMutator[] = []
    let curCell = cell
    for (const direction of directionsToCheck) {
      let neighborRet: IMutator[] = []
      for (const neighbor of this._neighborPairs) {
        if (!curCell) break // If we hit the end of the level then this does not match
        // Check if the individual tiles match
        const mutators = neighbor.getMatchedMutatorsOrNull(curCell, direction)
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
  _condition: TileWithModifier[]
  _action: TileWithModifier[]

  constructor(condition: RuleBracketNeighbor, action: RuleBracketNeighbor) {
    this._condition = condition._tilesWithModifier
    this._action = action._tilesWithModifier
  }

  evaluate(direction: RULE_DIRECTION, cell: Cell) {
    // TODO: Remove the CellMutator and just mutate directly since we know everything matches
    const mutator = new CellMutator(this._condition, this._action, cell, direction)
    return mutator.mutate()
  }

  getMatchedMutatorsOrNull(cell: Cell, direction: RULE_DIRECTION) {
    for (const tileWithModifier of this._condition) {
      if (!tileWithModifier.matchesCell(cell)) {
        return null
      }
    }
    return [new CellMutator(this._condition, this._action, cell, direction)]
  }
}


class CellMutator implements IMutator {
  _condition: TileWithModifier[]
  _action: TileWithModifier[]
  _cell: Cell
  _direction: RULE_DIRECTION
  constructor(condition: TileWithModifier[], action: TileWithModifier[], cell: Cell, direction: RULE_DIRECTION) {
    this._condition = condition
    this._action = action
    this._cell = cell
    this._direction = direction
  }
  mutate() {
    // Just remove all tiles for now and then add all of them back
    // TODO: only remove tiles that are matching the collisionLayer but wait, they already need to be exclusive

    // Remember the set of sprites before (so we can detect if the cell changed)
    const spritesBefore = new Set(this._cell.getSpritesAsSet())

    const newSpritesAndWantsToMoves = [...this._cell.getSpriteAndWantsToMoves()]


    const conditionTiles = new Map<IGameTile, TileWithModifier>()
    const actionTiles = new Map<IGameTile, TileWithModifier>()

    // remove sprites in tiles that are listed on the condition side
    this._condition.forEach(tileWithModifier => {
      if (!tileWithModifier._tile.isOr()) {
        if (!tileWithModifier.isNo()) {
          conditionTiles.set(tileWithModifier._tile, tileWithModifier)
        }
      }
    })
    // add sprites that are listed on the action side
    this._action.forEach(tileWithModifier => {
      if (!tileWithModifier._tile.isOr()) {
        if (!tileWithModifier.isNo()) {
          actionTiles.set(tileWithModifier._tile, tileWithModifier)
        }
      }
    })

    const conditionSprites = new Set()
    const actionSprites = new Set()
    for (const t of conditionTiles.values()) {
      if (!t.isNo()) {
        for (const sprite of t._tile.getSprites()) {
          conditionSprites.add(sprite)
        }
      }
    }
    for (const t of actionTiles.values()) {
      if (!t.isNo()) {
        for (const sprite of t._tile.getSprites()) {
          actionSprites.add(sprite)
        }
      }
    }

    const spritesToRemove = setDifference(conditionSprites, actionSprites)
    const spritesToAdd = setDifference(actionSprites, conditionSprites)

    for (const sprite of spritesToRemove) {
      this._cell.removeSprite(sprite)
    }

    // add sprites that are listed on the action side
    for (const tileWithModifier of actionTiles.values()) {
      // TODO: Only get the 1st sprite if tileWithModifier._tile is an OR tile (like in the 1st engine.test.js)
      if (!tileWithModifier._tile.getSpritesForRuleAction) {
        debugger
      }
      tileWithModifier._tile.getSpritesForRuleAction().forEach(sprite => {
        // if (spritesToAdd.has(sprite)) {
        if (tileWithModifier.isNo()) {
        } else {
          let direction
          switch (tileWithModifier._modifier) {
            case RULE_DIRECTION.RANDOM:
              // Decide whether or not to add the sprite since the tile has RANDOM on it
              if (nextRandom(2)) {
                // debugger
                // console.log('Randomly decided TO add the sprite');
                direction = undefined
              } else {
                // console.log('Randomly decided NOT to add the sprite');
                return
              }
              break
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
            case 'STATIONARY':
              console.log('Not supporting STATIONARY yet')
            case undefined:
              direction = undefined
              break
            default:
              throw new Error(`BUG: unsupported rule direction modifier "${tileWithModifier._modifier}"`)
          }
          this._cell.addSprite(sprite, direction)
        }
        // }
      })
    }

    // TODO: Be better about recording when the cell actually updated
    const spritesNow = this._cell.getSpritesAsSet()
    const didSpritesChange = !setEquals(spritesBefore, spritesNow)
    return new CellMutation(this._cell, didSpritesChange)
  }
}