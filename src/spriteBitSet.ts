import BitSet from 'bitset';
import { GameData } from './models/game';
import { GameSprite } from './models/tile';
import { CollisionLayer } from './models/collisionLayer';
// BitSet does not export a default so import does not work in webpack-built file
const BitSet2 = require('bitset')

abstract class CustomBitSet<T> {
    protected readonly bitSet: BitSet
    constructor(items?: Iterable<T>, bitSet?: BitSet) {
        if (bitSet) {
            this.bitSet = bitSet
        } else {
            this.bitSet = new BitSet2()
        }

        if (items) {
            this.addAll(items)
        }
    }

    protected abstract indexOf(item: T): number

    clear() {
        this.bitSet.clear()
    }

    isEmpty() {
        return this.bitSet.isEmpty()
    }

    addAll(items: Iterable<T>) {
        for (const sprite of items) {
            this.add(sprite)
        }
    }

    removeAll(items: Iterable<T>) {
        for (const sprite of items) {
            this.remove(sprite)
        }
    }

    private _indexOf(item: T) {
        const index = this.indexOf(item)
        if (index < 0) {
            throw new Error(`BUG: Expected the item index to be >= 0 but it was ${index}`)
        }
        return index
    }

    add(item: T) {
        this.bitSet.set(this._indexOf(item))
    }

    remove(item: T) {
        this.bitSet.clear(this._indexOf(item))
    }

    has(item: T) {
        return !!this.bitSet.get(this._indexOf(item))
    }

    containsAll(other: CustomBitSet<T>) {
        return other.bitSet.cardinality() === this.bitSet.and(other.bitSet).cardinality()
    }

    containsAny(other: CustomBitSet<T>) {
        return !this.bitSet.and(other.bitSet).isEmpty()
    }

    containsNone(other: CustomBitSet<T>) {
        return other.bitSet.and(this.bitSet).isEmpty()
    }
}

export class SpriteBitSet extends CustomBitSet<GameSprite> {

    indexOf(item: GameSprite) {
        return item.allSpritesBitSetIndex
    }

    getSprites(gameData: GameData) {
        const sprites = new Set<GameSprite>()
        for (const sprite of gameData.objects) {
            if (this.has(sprite)) {
                sprites.add(sprite)
            }
        }
        return sprites
    }

    toString(gameData: GameData) {
        const str = []
        for (const sprite of this.getSprites(gameData)) {
            str.push(sprite.getName())
        }
        return str.join(' ')
    }

    union(bitSets: Iterable<SpriteBitSet>) {
        let ret: SpriteBitSet = this
        for (const bitSet of bitSets) {
            ret = ret.or(bitSet)
        }
        return ret
    }

    private or(bitSet: SpriteBitSet) {
        return new SpriteBitSet(undefined, this.bitSet.or(bitSet.bitSet))
    }

}

export class CollisionLayerBitSet extends CustomBitSet<CollisionLayer> {

    indexOf(item: CollisionLayer) {
        return item.id
    }
}