import BitSet from 'bitset';
import { GameData } from './models/game';
import { GameSprite } from './models/tile';
import { CollisionLayer } from './models/collisionLayer';
// BitSet does not export a default so import does not work in webpack-built file
const BitSet2 = require('bitset')

abstract class CustomBitSet<T> {
    private readonly bitSet: BitSet
    constructor(items?: Iterable<T>) {
        this.bitSet = new BitSet2()

        if (items) {
            this.addAll(items)
        }
    }

    protected abstract indexOf(item: T): number

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

    add(item: T) {
        this.bitSet.set(this.indexOf(item))
    }

    remove(item: T) {
        this.bitSet.clear(this.indexOf(item))
    }

    has(item: T) {
        return !!this.bitSet.get(this.indexOf(item))
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
}

export class CollisionLayerBitSet extends CustomBitSet<CollisionLayer> {

    indexOf(item: CollisionLayer) {
        return item.id
    }
}