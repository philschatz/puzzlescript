// Maybe call this file `matchers.ts`?

import * as _ from 'lodash'
import {
    GameRule,
    RuleBracket,
    RuleBracketNeighbor,
    TileWithModifier,
    relativeDirectionToAbsolute
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

// Not sure of the order these should be evaluated. Chose RIGHT first so that the tests were more predictable
export const SIMPLE_DIRECTIONS = [
    RULE_MODIFIER.RIGHT,
    RULE_MODIFIER.DOWN,
    RULE_MODIFIER.LEFT,
    RULE_MODIFIER.UP
]

export class RuleBracketPair {
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
}

class NeighborPair {
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

        const {conditionSprites, actionSprites, actionTiles} = this._getConditionAndActionSprites()

        const spritesToRemove = setDifference(conditionSprites, actionSprites)
        const spritesToAdd = setDifference(actionSprites, conditionSprites)

        this._cell.removeSprites(spritesToRemove)

        // add sprites that are listed on the action side
        for (const tileWithModifier of actionTiles.values()) {
            for (const sprite of tileWithModifier._tile.getSpritesForRuleAction()) {
                if (tileWithModifier.isNo()) {
                } else {
                    let relDirection: RULE_DIRECTION = null
                    if (tileWithModifier.isRandom()) {
                        // Decide whether or not to add the sprite since the tile has RANDOM on it
                        if (nextRandom(2)) {
                            relDirection = this._direction
                        } else {
                            break // out of the loop
                        }
                    } else {
                        relDirection = tileWithModifier.getDirectionActionOrStationary()
                    }
                    const absDirection = relativeDirectionToAbsolute(this._direction, relDirection)
                    if (absDirection !== relDirection) {
                        // console.log('Directions differ: rel: ', relDirection, ' abs:', absDirection)
                    }
                    this._cell.addSprite(sprite, absDirection)
                }
            }
        }

        // TODO: Be better about recording when the cell actually updated
        const spritesNow = this._cell.getSpritesAsSet()
        const didSpritesChange = !setEquals(spritesBefore, spritesNow)
        return new CellMutation(this._cell, didSpritesChange)
    }
    _getConditionAndActionSprites() {
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
        return {conditionSprites, actionSprites, actionTiles}
    }
}