import { CollisionLayer } from '../models/collisionLayer'
import { LookupHelper } from './lookup'
import { IGameTile } from '../models/tile'
import { ValidationLevel, AddValidationFunc } from './parser'
import { Parseable } from './gameGrammar';

export const COLLISIONLAYERS_GRAMMAR = `
    CollisionLayerItem = NonemptyListOf<lookupRuleVariableName, ","?> ","? /*support a trailing comma*/ lineTerminator+
`

export function getCollisionLayerSemantics(lookup: LookupHelper, addValidationMessage: AddValidationFunc) {
    return {
        CollisionLayerItem: function (tiles: Parseable<IGameTile[]>, _2: Parseable<string>, _3: Parseable<string>) {
            return new CollisionLayer(this.source, tiles.parse(), addValidationMessage)
        }
    }
}