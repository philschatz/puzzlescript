import { GameSound, GameSoundSfx } from '../models/sound'
import { GameSprite, GameLegendTileSimple, IGameTile } from '../models/tile'
import { IGameCode } from '../models/game';

export class LookupHelper {
    _allSoundEffects: Map<string, GameSound>
    _allObjects: Map<string, GameSprite>
    _allLegendTiles: Map<string, IGameTile>
    _allLevelChars: Map<string, IGameTile>

    constructor() {
        this._allSoundEffects = new Map()
        this._allObjects = new Map()
        this._allLegendTiles = new Map()
        this._allLevelChars = new Map()
    }

    _addToHelper<A>(map: Map<string, A>, key: string, value: A) {
        if (map.has(key)) {
            throw new Error(`ERROR: Duplicate object is defined named "${key}". They are case-sensitive!`)
        }
        map.set(key, value)
    }
    addSoundEffect(key: string, soundEffect: GameSoundSfx) {
        this._addToHelper(this._allSoundEffects, key.toLowerCase(), soundEffect)
    }
    addToAllObjects(gameObject: GameSprite) {
        this._addToHelper(this._allObjects, gameObject.getName().toLowerCase(), gameObject)
    }
    addToAllLegendTiles(legendTile: GameLegendTileSimple) {
        this._addToHelper(this._allLegendTiles, legendTile.spriteNameOrLevelChar.toLowerCase(), legendTile)
    }
    addObjectToAllLevelChars(levelChar: string, gameObject: GameSprite) {
        this._addToHelper(this._allLegendTiles, levelChar.toLowerCase(), gameObject)
        this._addToHelper(this._allLevelChars, levelChar.toLowerCase(), gameObject)
    }
    addLegendToAllLevelChars(legendTile: GameLegendTileSimple) {
        this._addToHelper(this._allLevelChars, legendTile.spriteNameOrLevelChar.toLowerCase(), legendTile)
    }
    lookupObjectOrLegendTile(source: IGameCode, key: string) {
        key = key.toLowerCase()
        const value = this._allObjects.get(key) || this._allLegendTiles.get(key)
        if (!value) {
            console.error(source.getLineAndColumnMessage())
            throw new Error(`ERROR: Could not look up "${key}". Has it been defined in the Objects section or the Legend section?`)
        }
        return value
    }
    lookupByLevelChar(key: string) {
        const value = this._allLevelChars.get(key.toLowerCase())
        if (!value) {
            throw new Error(`ERROR: Could not look up "${key}" in the levelChars map. Has it been defined in the Objects section or the Legend section?`)
        }
        return value
    }
    lookupSoundEffect(key: string) {
        return this._allSoundEffects.get(key.toLowerCase())
    }
}