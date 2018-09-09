import * as ohm from 'ohm-js'
import { CollisionLayer } from '../models/collisionLayer'
import { IGameTile } from '../models/tile'
import { IParseable } from './gameGrammar'
import { LookupHelper } from './lookup'
import { AddValidationFunc } from './parser'

export const COLLISIONLAYERS_GRAMMAR = `
    CollisionLayerItem = NonemptyListOf<lookupCollisionVariableName, ","?> ","? /*support a trailing comma*/ lineTerminator+
`

export function getCollisionLayerSemantics(lookup: LookupHelper, addValidationMessage: AddValidationFunc) {
    return {
        CollisionLayerItem(this: ohm.Node, tiles: IParseable<IGameTile[]>, _2: IParseable<string>, _3: IParseable<string>) {
            return new CollisionLayer(this.source, tiles.parse(), addValidationMessage)
        }
    }
}
