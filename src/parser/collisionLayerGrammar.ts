import { CollisionLayer } from '../models/collisionLayer'
import { LookupHelper } from './lookup'
import { IGameTile } from '../models/tile'
import { ValidationLevel } from './parser'

export const COLLISIONLAYERS_GRAMMAR = `
    CollisionLayerItem = NonemptyListOf<lookupRuleVariableName, ","?> ","? /*support a trailing comma*/ lineTerminator+
`

export function getCollisionLayerSemantics(lookup: LookupHelper, addValidationMessage) {
    return {
        CollisionLayerItem: function (tiles, _2, _3) {
            return new CollisionLayer(this.source, tiles.parse(), addValidationMessage)
        }
    }
}