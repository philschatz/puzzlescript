import { IGameCode } from './BaseForLines'
import { BaseForLines } from "./BaseForLines";
import { GameSprite, IGameTile } from './tile'
import { ValidationLevel, AddValidationFunc } from '../parser/parser';
import { _flatten } from '../util';

let collisionIdCounter = 0
export class CollisionLayer extends BaseForLines {
    private sprites: GameSprite[]
    readonly id: number // Used for sorting collision layers for rendering

    constructor(source: IGameCode, tiles: IGameTile[], addValidationMessage: AddValidationFunc) {
        super(source)
        this.id = collisionIdCounter++

        // Map all the Objects to the layer
        tiles.forEach((tile: IGameTile) => {
            if (tile.hasCollisionLayer()) {
                addValidationMessage(tile, ValidationLevel.WARNING, 'An Object should not belong to more than one collision layer')
            }
            tile.setCollisionLayer(this)
            tile._getDescendantTiles().forEach((subTile) => {
                if (subTile.hasCollisionLayer()) {
                    addValidationMessage(subTile, ValidationLevel.WARNING, 'An Object should not belong to more than one collision layer. This item was referenced indirectly by an entry in the LEGEND section')
                }
                subTile.setCollisionLayer(this)
            })
        })

        // build an array of Sprites so we can index to them in a BitSet
        this.sprites = [...new Set(_flatten(tiles.map(t => t.getSprites())))]

        this.sprites.forEach((sprite, index) => sprite.setCollisionLayerAndIndex(this, index))
    }

    // isInvalid(): Optional<string> {
    //     return null
    // }

    getBitSetIndexOf(sprite: GameSprite) {
        const index = this.sprites.indexOf(sprite)
        if (index < 0) {
            throw new Error(`BUG: Sprite is not in this CollisionLayer`)
        }
        return index
    }

    // bitSetToSprites(bitSet: BitSet) {
    //     const ret = []
    //     let index = 0
    //     for (const sprite of this.sprites) {
    //         if (bitSet.get(index)) {
    //             ret.push(sprite)
    //         }
    //         index++
    //     }
    //     return ret
    // }
}
