import * as _ from 'lodash'
import * as ohm from 'ohm-js'
import { lookupColorPalette } from '../colors'
import { IMutator, RuleBracketPair, getMatchedMutatorsHelper } from '../pairs'
import { Cell } from '../engine';
import { RULE_MODIFIER, setIntersection, setDifference } from '../util'
import { PUZZLESCRIPT_GRAMMAR } from './grammar'
import { BaseForLines, IGameCode, IGameNode, IGameTile, GameData } from '../models/game'
import { GameRuleLoop, GameRuleGroup, GameRule, HackNode, RuleBracket, RuleBracketNeighbor, TileWithModifier } from '../models/gameRule'

class Dimension {
  width: number
  height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
}

export class GameSettings {
  author?: string
  homepage?: string
  youtube?: string
  zoomscreen?: Dimension
  flickscreen?: Dimension
  color_palette?: string
  background_color?: IColor
  text_color?: IColor
  realtime_interval?: string
  key_repeat_interval?: string
  again_interval?: string
  noaction: false
  noundo: false
  run_rules_on_level_start?: string
  norepeat_action: false
  throttle_movement: false
  norestart: false
  require_player_movement: false
  verbose_logging: false

  constructor() { }

  _setValue(key: any, value: any) {
    this[key] = value
  }
}

export class LevelMap extends BaseForLines {
  _rows: IGameTile[][]

  constructor(source: IGameCode, rows: any[][]) {
    super(source)
    this._rows = rows
  }
  isInvalid(): string {
    const firstRowLength = this._rows[0].length
    let isInvalid = null
    this._rows.forEach((row, index) => {
      if (firstRowLength !== row.length) {
        isInvalid = `Row ${index + 1} does not have the same column count as the first row. Expected ${firstRowLength} columns but found ${row.length}.`
      }
    })
    return isInvalid
  }
  isMap() {
    return true
  }
  getRows() {
    return this._rows
  }
}

export class GameMessage extends BaseForLines {
  _message: string

  constructor(source: IGameCode, message: string) {
    super(source)
    this._message = message
  }
  isInvalid(): string {
    return null
  }
  isMap() {
    return false
  }
}

function hexToRgb(hex: string) {
  // https://stackoverflow.com/a/5624139
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b
  })

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return new RGB(
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    )
  } else {
    throw new Error('BUG: hex color was invalid')
  }
}

class RGB {
  r: number
  g: number
  b: number

  constructor(r: number, g: number, b: number) {
    this.r = r
    this.g = g
    this.b = b
  }
}

export declare interface IColor extends IGameNode {
  isTransparent: () => boolean
  toRgb: () => RGB
}

export class HexColor extends BaseForLines implements IColor {
  _color: RGB
  _colorName: string // only for unit tests & debugging

  constructor(source: IGameCode, color: string) {
    super(source)
    this._color = hexToRgb(color)
    this._colorName = color
  }

  isTransparent() { return false }
  toRgb() {
    return this._color
  }
}

class TransparentColor extends BaseForLines implements IColor {
  isTransparent() { return true }
  toRgb(): RGB {
    throw new Error('BUG: Transparent colors do not have RGB data')
  }
}

export class GameSprite extends BaseForLines implements IGameTile {
  _name: string
  _optionalLegendChar?: string
  _collisionLayer: CollisionLayer

  constructor(source: IGameCode, name: string, optionalLegendChar?: string) {
    super(source)
    this._name = name
    this._optionalLegendChar = optionalLegendChar
  }
  getPixels(): IColor[][] {
    throw new Error('BUG: Subclasses should implement this')
  }
  _getName() {
    return this._name
  }
  _getDescendantTiles(): GameLegendTile[] {
    return []
  }
  getSprites() {
    // to match the signature of LegendTile
    return [this]
  }
  hasCollisionLayer() {
    return !!this._collisionLayer
  }
  setCollisionLayer(collisionLayer: CollisionLayer) {
    this._collisionLayer = collisionLayer
  }
  getCollisionLayerNum() {
    if (!this._collisionLayer) {
      console.error(this.__source.getLineAndColumnMessage())
      console.error('ERROR: This sprite was not in a Collision Layer')
    }
    return this._collisionLayer.__astId
  }
  isInvalid() {
    if (!this._collisionLayer) {
      return 'This object does not have an entry in the COLLISIONLAYERS section.'
    }
    return null
  }
  matchesCell(cell: Cell): any {
    return cell.getSpritesAsSet().has(this)
  }
}

class GameSpriteSingleColor extends GameSprite {
  _color: HexColor

  constructor(source: IGameCode, name: string, optionalLegendChar: string, colors: HexColor[]) {
    super(source, name, optionalLegendChar)
    this._color = colors[0] // Ignore if the user added multiple colors (like `transparent yellow`)
  }
  getPixels() {
    // When there are no pixels then it means "color the whole thing in the same color"
    const rows: HexColor[][] = []
    for (let row = 0; row < 5; row++) {
      rows.push([])
      for (let col = 0; col < 5; col++) {
        rows[row].push(this._color)
      }
    }
    return rows
  }
}

export class GameSpritePixels extends GameSprite {
  _colors: IColor[]
  _pixels: IColor[][]

  constructor(source: IGameCode, name: string, optionalLegendChar: string, colors: HexColor[], pixels: ('.' | number)[][]) {
    super(source, name, optionalLegendChar)
    this._colors = colors
    this._pixels = pixels.map(row => {
      return row.map(col => {
        if (col === '.') {
          return new TransparentColor(this.__source)
        } else {
          return this._colors[col]
        }
      })
    }) // Pixel colors are 0-indexed.
  }
  isInvalid() {
    if (super.isInvalid()) {
      return super.isInvalid()
    }
    let isInvalid = null
    const colorLen = this._colors.length
    const rowLen = this._pixels[0].length
    this._pixels.forEach((row: any[]) => {
      if (row.length !== rowLen) {
        isInvalid = `Row lengths do not match. Expected ${rowLen} but got ${row.length}. Row: ${row}`
      }
      // Check that only '.' or a digit that is less than the number of colors is present
      row.forEach((pixel) => {
        if (pixel !== '.') {
          if (pixel >= colorLen) {
            isInvalid = `Pixel number is too high (${pixel}). There are only ${colorLen} colors defined`
          }
        }
      })
    })
    return isInvalid
  }
  getSprites() {
    // to match the signature of LegendTile
    return [this]
  }
  getPixels() {
    return this._pixels
  }
}

export class GameLegendTile extends BaseForLines implements IGameTile {
  _spritesCache: GameSprite[]
  _collisionLayer: CollisionLayer
  _spriteNameOrLevelChar: string
  _tiles: IGameTile[]

  constructor(source: IGameCode, spriteNameOrLevelChar: string, tiles: IGameTile[]) {
    super(source)
    this._spriteNameOrLevelChar = spriteNameOrLevelChar
    this._tiles = tiles
  }
  isInvalid() {
    if (!this.hasCollisionLayer()) {
      return 'Missing collision layer'
    }
    return null
  }
  matchesCell(cell: Cell) {
    if (!!true) {
      throw new Error('BUG: This is an abstract method')
    }
    return false
  }
  _getDescendantTiles(): IGameTile[] {
    // recursively pull all the tiles out
    return this._tiles.concat(_.flatten(this._tiles.map(tile => tile._getDescendantTiles())))
  }
  getSprites() {
    // Use a cache because all the collision layers have not been loaded in time
    if (!this._spritesCache) {
      // 2 levels of indirection should be safe
      // Sort by collisionLayer so that the most-important sprite is first
      this._spritesCache = _.flatten(
        this._tiles.map(tile => {
          return tile.getSprites()
        })
      ).sort((a, b) => {
        return a.getCollisionLayerNum() - b.getCollisionLayerNum()
      }).reverse()
    }
    return this._spritesCache
  }
  hasCollisionLayer() {
    return !!this._collisionLayer
  }
  setCollisionLayer(collisionLayer: CollisionLayer) {
    this._collisionLayer = collisionLayer
  }
  getCollisionLayerNum() {
    return this._collisionLayer.__astId
  }

}

export class GameLegendTileSimple extends GameLegendTile {
  constructor(source: IGameCode, spriteNameOrLevelChar: string, tile: GameSprite) {
    super(source, spriteNameOrLevelChar, [tile])
  }
  matchesCell(cell: Cell) {
    // Check that the cell contains all of the tiles (ANDED)
    // Since this is a Simple Tile it should only contain 1 tile so anding is the right way to go.
    for (const tile of this.getSprites()) {
      if (!cell.getSpritesAsSet().has(tile)) {
        return false
      }
    }
    return true
  }
}

export class GameLegendTileAnd extends GameLegendTile {
  matchesCell(cell: Cell) {
    // Check that the cell contains any of the tiles (OR)
    for (const tile of this._tiles) {
      if (!tile.matchesCell(cell)) {
        return false
      }
    }
    return true
  }
}

export class GameLegendTileOr extends GameLegendTile {
  matchesCell(cell: Cell) {
    // Check that the cell contains any of the tiles (OR)
    for (const tile of this._tiles) {
      if (tile.matchesCell(cell)) {
        return true
      }
    }
    return false
  }
}

// TODO: Use the Objects rather than just the names
export class CollisionLayer extends BaseForLines {
  _sprites: GameSprite[]

  constructor(source: IGameCode, sprites: GameSprite[]) {
    super(source)
    this._sprites = sprites
  }
  isInvalid(): string {
    return null
  }
}

// Abstract class
export class GameSound extends BaseForLines {
  _soundCode: number

  constructor(source: IGameCode, soundCode: number) {
    super(source)
    this._soundCode = soundCode
  }
}
export class GameSoundSfx extends GameSound {
  _sfxName: string

  constructor(source: IGameCode, sfxName: string, soundCode: number) {
    super(source, soundCode)
    this._sfxName = sfxName
  }
}
export class GameSoundSimpleEnum extends GameSound {
  _simpleEventName: number

  constructor(source: IGameCode, simpleEventName: number, soundCode: number) {
    super(source, soundCode)
    this._simpleEventName = simpleEventName
  }
}
// TODO: Link this up to the Object, rather than just storing the spriteName
export class GameSoundNormal extends GameSound {
  _sprite: IGameTile
  _conditionEnum: string

  constructor(source: IGameCode, sprite: IGameTile, conditionEnum: string, soundCode: number) {
    super(source, soundCode)
    this._sprite = sprite
    this._conditionEnum = conditionEnum
  }
}
export class GameSoundMoveSimple extends GameSound {
  _sprite: IGameTile

  constructor(source: IGameCode, sprite: IGameTile, soundCode: number) {
    super(source, soundCode)
    this._sprite = sprite
  }
}
export class GameSoundMoveDirection extends GameSound {
  _sprite: IGameTile
  _directionEnum: string

  constructor(source: IGameCode, sprite: IGameTile, directionEnum: string, soundCode: number) {
    super(source, soundCode)
    this._sprite = sprite
    this._directionEnum = directionEnum
  }
}

export class WinConditionSimple extends BaseForLines {
  _qualifierEnum: string
  _spriteName: string

  constructor(source: IGameCode, qualifierEnum: string, spriteName: string) {
    super(source)
    this._qualifierEnum = qualifierEnum
    this._spriteName = spriteName
  }
}
export class WinConditionOn extends WinConditionSimple {
  _onSprite: string

  constructor(source: IGameCode, qualifierEnum: string, spriteName: string, onSprite: string) {
    super(source, qualifierEnum, spriteName)
    this._onSprite = onSprite
  }
}

class LookupHelper {
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
    this._addToHelper(this._allObjects, gameObject._name.toLowerCase(), gameObject)
  }
  addToAllLegendTiles(legendTile: GameLegendTileSimple) {
    this._addToHelper(this._allLegendTiles, legendTile._spriteNameOrLevelChar.toLowerCase(), legendTile)
  }
  addObjectToAllLevelChars(levelChar: string, gameObject: GameSprite) {
    this._addToHelper(this._allLegendTiles, levelChar.toLowerCase(), gameObject)
    this._addToHelper(this._allLevelChars, levelChar.toLowerCase(), gameObject)
  }
  addLegendToAllLevelChars(legendTile: GameLegendTileSimple) {
    this._addToHelper(this._allLevelChars, legendTile._spriteNameOrLevelChar.toLowerCase(), legendTile)
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
  lookupObjectOrLegendTileOrSoundEffect(source: IGameCode, key: string) {
    key = key.toLowerCase()
    const value = this._allObjects.get(key) || this._allLegendTiles.get(key) || this._allSoundEffects.get(key)
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
}

// Helper for setting a config field
function getConfigField(key: ohm.Node, value: ohm.Node) {
  return [key.parse(), value.parse()]
}

let _GRAMMAR: ohm.Grammar = null

enum ValidationLevel {
  ERROR,
  WARNING,
  INFO
}

class ValidationMessage {
  gameNode: IGameNode
  level: ValidationLevel
  message: string

  constructor(gameNode: IGameNode, level: ValidationLevel, message: string) {
    this.gameNode = gameNode
    this.level = level
    this.message = message
  }
}

class Parser {
  getGrammar() {
    _GRAMMAR = _GRAMMAR || ohm.grammar(PUZZLESCRIPT_GRAMMAR)
    return _GRAMMAR
  }

  parseGrammar(code: string) {
    // 8645c163ff321d2fd1bad3fcaf48c107 has a typo so we .replace()
    // 0c2625672bf47fcf728fe787a2630df6 has a typo se we .replace()
    // another couple of games do not have a trailing newline at the end of the file so we add that
    code = code.replace('][ ->', '] ->').replace('[[spring]', '[spring][') + '\n' // Not all games have a trailing newline. this makes it easier on the parser

    const g = this.getGrammar()
    return { match: g.match(code) }
  }

  parse(code: string) {
    const g = this.getGrammar()
    const { match: m } = this.parseGrammar(code)
    const validationMessages: ValidationMessage[] = []

    function addValidationMessage(source: IGameNode, level: ValidationLevel, message: string) {
      validationMessages.push(new ValidationMessage(source, level, message))
    }

    if (m.succeeded()) {
      const lookup = new LookupHelper()
      const s = g.createSemantics()

      let currentColorPalette = 'arnecolors' // default

      s.addOperation('parse', {
        GameData: function (_whitespace1, title, _whitespace2, settingsFields, _whitespace3, objects, legends, sounds, collisionLayers, rules, winConditions, levels) {
          const settings = new GameSettings()
          settingsFields.parse().forEach((setting) => {
            if (Array.isArray(setting)) {
              settings._setValue(setting[0], setting[1])
            } else {
              settings._setValue(setting, true)
            }
          })
          return new GameData(
            title.parse(),
            settings,
            objects.parse()[0] || [],
            legends.parse()[0] || [],
            sounds.parse()[0] || [],
            collisionLayers.parse()[0] || [],
            rules.parse()[0] || [],
            winConditions.parse()[0] || [],
            levels.parse()[0] || []
          )
        },
        Title: function (_1, value) {
          return value.parse()
        },
        Author: getConfigField,
        Homepage: getConfigField,
        KeyRepeatInterval: getConfigField,
        AgainInterval: getConfigField,
        BackgroundColor: getConfigField,
        TextColor: getConfigField,
        RunRulesOnLevelStart: getConfigField,
        RealtimeInterval: getConfigField,
        Youtube: getConfigField,
        Zoomscreen: getConfigField,
        Flickscreen: getConfigField,
        ColorPalette: function (_1, colorPaletteName) {
          // Set the color palette so we only need to use hex color codes
          currentColorPalette = colorPaletteName.parse()
          return getConfigField(_1, colorPaletteName)
        },
        RequirePlayerMovement: getConfigField,

        Section: function (_threeDashes1, _lineTerminator1, _sectionName, _lineTerminator2, _threeDashes2, _8, _9, _10, _11) {
          return _10.parse()
        },
        Sprite: function (_1) {
          const gameObject: GameSprite = _1.parse()
          lookup.addToAllObjects(gameObject)
          if (gameObject._optionalLegendChar) {
            // addObjectToAllLegendTiles(gameObject)
            lookup.addObjectToAllLevelChars(gameObject._optionalLegendChar, gameObject)
          } else if (gameObject._name.length === 1) {
            lookup.addObjectToAllLevelChars(gameObject._name, gameObject)
          }
          return gameObject
        },
        SpritePixels: function (name, optionalLegendChar, _3, colors, _5, pixels, _7) {
          return new GameSpritePixels(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse(), pixels.parse())
        },
        SpriteNoPixels: function (name, optionalLegendChar, _3, colors, _5) {
          return new GameSpriteSingleColor(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse())
        },
        PixelRows: function (row1, row2, row3, row4, row5) {
          // Exactly 5 rows. We do this because some games contain vertical whitespace after, but not all
          return [
            row1.parse(),
            row2.parse(),
            row3.parse(),
            row4.parse(),
            row5.parse()
          ]
        },
        LookupLegendVarName: function (tile) {
          // Replace all the Sprite Names with the actual objects
          return lookup.lookupObjectOrLegendTile(this.source, tile.parse())
        },
        LegendTile: function (_1) {
          const legendTile: GameLegendTileSimple = _1.parse()
          lookup.addToAllLegendTiles(legendTile)
          if (legendTile._spriteNameOrLevelChar.length === 1) {
            lookup.addLegendToAllLevelChars(legendTile)
          }
          return legendTile
        },
        LegendTileSimple: function (spriteNameOrLevelChar, _equals, tile, _whitespace) {
          // TODO: Do the lookup and adding to sets here rather than rewiring in LegendTile
          return new GameLegendTileSimple(this.source, spriteNameOrLevelChar.parse(), tile.parse())
        },
        LegendTileAnd: function (spriteNameOrLevelChar, _equals, tiles, _whitespace) {
          return new GameLegendTileAnd(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        },
        LegendTileOr: function (spriteNameOrLevelChar, _equals, tiles, _whitespace) {
          return new GameLegendTileOr(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        },
        SoundItem: function (_1, _whitespace) {
          return _1.parse()
        },
        SoundItemEnum: function (simpleEnum, soundCode) {
          return new GameSoundSimpleEnum(this.source, simpleEnum.parse(), soundCode.parse())
        },
        SoundItemSfx: function (sfxName, soundCode) {
          const soundEffect = sfxName.parse()
          const sound = new GameSoundSfx(this.source, soundEffect, soundCode.parse())
          lookup.addSoundEffect(soundEffect, sound)
          return sound
        },
        SoundItemMoveSimple: function (spriteName, _2, soundCode) {
          return new GameSoundMoveSimple(this.source, lookup.lookupObjectOrLegendTile(this.source, spriteName.parse()), soundCode.parse())
        },
        SoundItemMoveDirection: function (spriteName, _move, directionEnum, soundCode) {
          return new GameSoundMoveDirection(this.source, lookup.lookupObjectOrLegendTile(this.source, spriteName.parse()), directionEnum.parse(), soundCode.parse())
        },
        SoundItemNormal: function (spriteName, eventEnum, soundCode) {
          return new GameSoundNormal(this.source, lookup.lookupObjectOrLegendTile(this.source, spriteName.parse()), eventEnum.parse(), soundCode.parse())
        },
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
        },
        RuleItem: function (_1) {
          return _1.parse()
        },
        RuleLoop: function (_startloop, _whitespace1, rules, _endloop, _whitespace2) {
          return new GameRuleLoop(this.source, rules.parse())
        },
        RuleGroup: function (firstRule, _plusses, followingRules) {
          return new GameRuleGroup(this.source, [firstRule.parse()].concat(followingRules.parse()))
        },
        Rule: function (modifiers, conditions, _arrow, _unusuedModifer, actions, commands, optionalMessageCommand, _whitespace) {
          return new GameRule(this.source, new Set(_.flatten(modifiers.parse())), conditions.parse(), actions.parse(), commands.parse().concat(optionalMessageCommand.parse()))
        },
        RuleBracket: function (_openBracket, neighbors, hackAgain, _closeBracket) {
          return new RuleBracket(this.source, neighbors.parse(), hackAgain.parse())
        },
        RuleBracketNeighbor: function (_1) {
          return _1.parse()
        },
        RuleBracketEllipsisNeighbor: function (_1) {
          const tileWithModifier = new TileWithModifier(this.source, "...", null)
          return new RuleBracketNeighbor(this.source, [tileWithModifier], true)
        },
        RuleBracketNoEllipsisNeighbor: function (tileWithModifier) {
          return new RuleBracketNeighbor(this.source, tileWithModifier.parse(), false)
        },
        TileWithModifier: function (optionalModifier, tile) {
          return new TileWithModifier(this.source, optionalModifier.parse()[0], tile.parse())
        },
        tileModifier: function (_whitespace1, tileModifiers, _whitespace2) {
          return tileModifiers.parse()
        },
        MessageCommand: function (_message, message) {
          return new GameMessage(this.source, message.parse())
        },
        WinConditionItemSimple: function (qualifierEnum, spriteName, _whitespace) {
          return new WinConditionSimple(this.source, qualifierEnum.parse(), spriteName.parse())
        },
        WinConditionItemOn: function (qualifierEnum, spriteName, _on, targetObjectName, _whitespace) {
          return new WinConditionOn(this.source, qualifierEnum.parse(), spriteName.parse(), targetObjectName.parse())
        },
        GameMessage: function (_1, optionalMessage) {
          // TODO: Maybe discard empty messages?
          return new GameMessage(this.source, optionalMessage.parse()[0] /* Since the message is optional */)
        },
        LevelItem: function (_1, _2) {
          return _1.parse()
        },
        LevelMap: function (rows) {
          const levelRows = rows.parse().map((row: string[]) => {
            return row.map((levelChar: string) => {
              return lookup.lookupByLevelChar(levelChar)
            })
          })
          return new LevelMap(this.source, levelRows)
        },
        levelMapRow: function (row, _2) {
          return row.parse()
        },
        HackTileNameIsSFX1: function (sfx) {
          return new HackNode(this.source, sfx.parse())
        },
        HackTileNameIsSFX2: function (tile, sfx) {
          return new HackNode(this.source, { tile: tile.parse(), sfx: sfx.parse() })
        },
        widthAndHeight: function (_1, _2, _3) {
          return {
            __type: 'widthAndHeight',
            width: _1.parse(),
            height: _3.parse()
          }
        },
        pixelRow: function (_1, _2) {
          return _1.parse()
        },
        colorHex3: function (_1, _2, _3, _4) {
          return new HexColor(this.source, this.sourceString)
        },
        colorHex6: function (_1, _2, _3, _4, _5, _6, _7) {
          return new HexColor(this.source, this.sourceString)
        },
        colorName: function (_1) {
          const colorName = this.sourceString.toLowerCase()
          const hex = lookupColorPalette(currentColorPalette, colorName)
          if (hex) {
            return new HexColor(this.source, hex)
          } else {
            const transparent = new TransparentColor(this.source)
            addValidationMessage(transparent, ValidationLevel.WARNING, `Invalid color name. "${colorName}" is not a valid color. Using "transparent" instead`)
            return transparent
          }
        },
        colorTransparent: function (_1) {
          return new TransparentColor(this.source)
        },
        NonemptyListOf: function (_1, _2, _3) {
          return [_1.parse()].concat(_3.parse())
        },
        nonemptyListOf: function (_1, _2, _3) {
          // Do this special because LegendTile contains things like `X = A or B or C` and we need to know if they are `and` or `or`
          return {
            __type: 'nonemptyListOf',
            values: [_1.parse()].concat(_3.parse()),
            separators: [_2.parse()]
          }
        },
        integer: function (_1) {
          return parseInt(this.sourceString)
        },
        decimalWithLeadingNumber: function (_1, _2, _3) {
          return parseFloat(this.sourceString)
        },
        decimalWithLeadingPeriod: function (_1, _2) {
          return parseFloat(this.sourceString)
        },
        lookupRuleVariableName: function (_1) {
          return lookup.lookupObjectOrLegendTile(this.source, _1.parse())
        },
        ruleVariableName: function (_1) {
          return this.sourceString
        },
        words: function (_1) {
          return this.sourceString
        },
        _terminal: function () { return this.primitiveValue },
        lineTerminator: (_1, _2, _3, _4) => { },
        digit: (x) => {
          return x.primitiveValue.charCodeAt(0) - '0'.charCodeAt(0)
        }
        // _default: function (exp1) {
        //   debugger
        //   return this.sourceString
        // },

      })
      const game: GameData = s(m).parse()
      // console.log(game)

      // Validate that the game objects are rectangular
      game.objects.forEach((sprite) => {
        // if (!sprite.hasCollisionLayer()) {
        //   addValidationMessage(sprite, ValidationLevel.WARNING, `Game object is not in a Collision Layer. All objects must be in exactly one collision layer`)
        // }
        if (sprite.isInvalid()) {
          addValidationMessage(sprite, ValidationLevel.WARNING, `Game Object is Invalid. Reason: ${sprite.isInvalid()}`)
        }
      })

      // Validate that the level maps are rectangular
      game.levels.forEach((level) => {
        if (level.isInvalid()) {
          addValidationMessage(level, ValidationLevel.WARNING, `Level is Invalid. Reason: ${level.isInvalid()}`)
        }
      })

      return { data: game, validationMessages }
    } else {
      const trace = g.trace(code)
      return { error: m, trace: trace }
    }
  }
}

export default new Parser()
