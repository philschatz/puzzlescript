import { CollisionLayer } from '../models/collisionLayer'
import { LookupHelper } from './lookup'
import { IGameTile } from '../models/tile'
import { ValidationLevel } from './parser'

export const COLLISIONLAYERS_GRAMMAR = `
    CollisionLayerItem = NonemptyListOf<ruleVariableName, ","?> ","? /*support a trailing comma*/ lineTerminator+
`

export function getCollisionLayerSemantics(lookup: LookupHelper, addValidationMessage) {
    return {
        CollisionLayerItem: function (tileNames, _2, _3) {
            const tiles = tileNames.parse().map((spriteName: string) => lookup.lookupObjectOrLegendTile(this.source, spriteName))
            const collisionLayer = new CollisionLayer(this.source, tiles)
            // Map all the Objects to the layer
            tiles.forEach((tile: IGameTile) => {
                if (tile.hasCollisionLayer()) {
                    addValidationMessage(tile, ValidationLevel.WARNING, 'An Object should not belong to more than one collision layer')
                }
                tile.setCollisionLayer(collisionLayer)
                tile._getDescendantTiles().forEach((subTile) => {
                    if (subTile.hasCollisionLayer()) {
                        addValidationMessage(subTile, ValidationLevel.WARNING, 'An Object should not belong to more than one collision layer. This item was referenced indirectly by an entry in the LEGEND section')
                    }
                    subTile.setCollisionLayer(collisionLayer)
                })

            })
            return collisionLayer
        }
    }
}