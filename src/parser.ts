import * as _ from 'lodash'
import * as ohm from 'ohm-js'
import { lookupColorPalette } from './colors'
import { Cell } from './engine';
import { StringifyOptions } from 'querystring';

const GRAMMAR_STR = `
Puzzlescript {
  GameData =
    lineTerminator* // Version information
    Title lineTerminator+
    (OptionalSetting lineTerminator+)*
    Section<t_OBJECTS, Sprite>?
    Section<t_LEGEND, LegendTile>?
    Section<t_SOUNDS, SoundItem>?
    Section<t_COLLISIONLAYERS, CollisionLayerItem>?
    Section<t_RULES, RuleItem>?
    Section<t_WINCONDITIONS, WinConditionItem>?
    Section<t_LEVELS, LevelItem>?

  OptionalSetting =
      Author
    | Homepage
    | Youtube
    | Zoomscreen
    | Flickscreen
    | RequirePlayerMovement
    | RunRulesOnLevelStart
    | ColorPalette
    | BackgroundColor
    | TextColor
    | RealtimeInterval
    | KeyRepeatInterval
    | AgainInterval
    | t_NOACTION
    | t_NOUNDO
    | t_NOREPEAT_ACTION
    | t_THROTTLE_MOVEMENT
    | t_NORESTART
    | t_VERBOSE_LOGGING

  Title = "title" words
  Author = "author" words
  Homepage = "homepage" words
  Youtube = "youtube" words
  Zoomscreen = "zoomscreen" widthAndHeight
  Flickscreen = "flickscreen" widthAndHeight
  RequirePlayerMovement = t_REQUIRE_PLAYER_MOVEMENT "off"?
  RunRulesOnLevelStart = t_RUN_RULES_ON_LEVEL_START "true"?
  ColorPalette = "color_palette" words
  BackgroundColor = "background_color" colorNameOrHex
  TextColor = "text_color" colorNameOrHex
  RealtimeInterval = "realtime_interval" decimal
  KeyRepeatInterval = "key_repeat_interval" decimal
  AgainInterval = "again_interval" decimal
  t_NOACTION = caseInsensitive<"NOACTION">
  t_NOUNDO = caseInsensitive<"NOUNDO">
  t_RUN_RULES_ON_LEVEL_START = caseInsensitive<"RUN_RULES_ON_LEVEL_START">
  t_NOREPEAT_ACTION = caseInsensitive<"NOREPEAT_ACTION">
  t_THROTTLE_MOVEMENT = caseInsensitive<"THROTTLE_MOVEMENT">
  t_NORESTART = caseInsensitive<"NORESTART">
  t_REQUIRE_PLAYER_MOVEMENT = caseInsensitive<"REQUIRE_PLAYER_MOVEMENT">
  t_VERBOSE_LOGGING = caseInsensitive<"VERBOSE_LOGGING">

  widthAndHeight = integer "x" integer

  word = (~lineTerminator any)+
  words = word+
  decimal =
      decimalWithLeadingNumber
    | decimalWithLeadingPeriod
  decimalWithLeadingNumber = digit+ ("." digit+)?
  decimalWithLeadingPeriod = "." digit+



  Sprite
    = SpritePixels
    | SpriteNoPixels

  SpriteNoPixels =
    spriteName legendShortcutChar? lineTerminator
    colorNameOrHex+ lineTerminator+

  SpritePixels =
    spriteName legendShortcutChar? lineTerminator
    colorNameOrHex+ lineTerminator+
    PixelRows
    lineTerminator*

  t_TRANSPARENT = caseInsensitive<"TRANSPARENT">

  spriteName = ruleVariableName
  colorTransparent = t_TRANSPARENT
  colorHex6 = "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit
  colorHex3 = "#" hexDigit hexDigit hexDigit
  colorNameOrHex = colorTransparent | colorHex6 | colorHex3 | colorName
  colorName = letter+
  pixelRow = pixelDigit+ lineTerminator
  pixelDigit = digit | "."
  legendShortcutChar = (~lineTerminator any)

  PixelRows = pixelRow pixelRow pixelRow pixelRow pixelRow




  LegendTile
    = LegendTileSimple
    | LegendTileAnd
    | LegendTileOr

  LegendTileSimple = LegendVarNameDefn "=" LookupLegendVarName lineTerminator+
  LegendTileAnd = LegendVarNameDefn "=" NonemptyListOf<LookupLegendVarName, t_AND> lineTerminator+
  LegendTileOr = LegendVarNameDefn "=" NonemptyListOf<LookupLegendVarName, t_OR> lineTerminator+

  LegendVarNameDefn = ruleVariableName | legendVariableChar
  LookupLegendVarName = LegendVarNameDefn



  // TODO: Handle tokens like sfx0 and explicit args instead of just varName (like "Player CantMove up")
  // all of them are at https://www.puzzlescript.net/Documentation/sounds.html
  SoundItem = SoundItemInner lineTerminator+

  SoundItemInner
    = SoundItemEnum
    | SoundItemSfx
    | SoundItemMoveDirection
    | SoundItemMoveSimple
    | SoundItemNormal

  soundItemSimpleOptions
    = t_RESTART
    | t_UNDO
    | t_TITLESCREEN
    | t_STARTGAME
    | t_STARTLEVEL
    | t_ENDLEVEL
    | t_ENDGAME
    | t_SHOWMESSAGE
    | t_CLOSEMESSAGE

  SoundItemEnum = soundItemSimpleOptions integer
  SoundItemSfx = t_SFX integer
  SoundItemMoveDirection = ruleVariableName t_MOVE soundItemActionMoveArg integer
  SoundItemMoveSimple = ruleVariableName t_MOVE integer
  SoundItemNormal = ruleVariableName SoundItemAction integer

  SoundItemAction
    = t_CREATE
    | t_DESTROY
    | t_CANTMOVE

  soundItemActionMoveArg
    = t_UP
    | t_DOWN
    | t_LEFT
    | t_RIGHT
    | t_HORIZONTAL
    | t_VERTICAL

  t_MOVE = caseInsensitive<"MOVE">
  t_DESTROY = caseInsensitive<"DESTROY">
  t_CREATE = caseInsensitive<"CREATE">
  t_CANTMOVE = caseInsensitive<"CANTMOVE">

  t_TITLESCREEN = caseInsensitive<"TITLESCREEN">
  t_STARTGAME = caseInsensitive<"STARTGAME">
  t_STARTLEVEL = caseInsensitive<"STARTLEVEL">
  t_ENDLEVEL = caseInsensitive<"ENDLEVEL">
  t_ENDGAME = caseInsensitive<"ENDGAME">
  t_SHOWMESSAGE = caseInsensitive<"SHOWMESSAGE">
  t_CLOSEMESSAGE = caseInsensitive<"CLOSEMESSAGE">



  CollisionLayerItem = NonemptyListOf<ruleVariableName, ","?> ","? /*support a trailing comma*/ lineTerminator+


  RuleItem
    = RuleLoop
    | RuleGroup // Do this before Rule because we need to look for a "+" on the following Rule
    | Rule

  Rule = (RuleModifierLeft* RuleBracket)+ "->" (RuleModifier? RuleBracket)* RuleCommand* MessageCommand? lineTerminator+

  RuleBracket = "[" NonemptyListOf<RuleBracketNeighbor, "|"> t_AGAIN? "]" // t_AGAIN is a HACK. It should be in the list of commands but it's not.
  RuleBracketNeighbor
    = HackTileNameIsSFX1 // to parse '... -> [ SFX1 ]' (they should be commands)
    | HackTileNameIsSFX2 // to parse '... -> [ tilename SFX1 ]'
    | RuleBracketEllipsisNeighbor
    | RuleBracketNoEllipsisNeighbor

  RuleBracketEllipsisNeighbor = t_ELLIPSIS
  RuleBracketNoEllipsisNeighbor = TileWithModifier*

  TileWithModifier = tileModifier* lookupRuleVariableName

  tileModifier = space* tileModifierInner space+ // Force-check that there is whitespace after the cellLayerModifier so things like "STATIONARYZ" or "NOZ" are not parsed as a modifier (they are a variable that happens to begin with the same text as a modifier)

  tileModifierInner
    = t_NO
    | t_LEFT
    | t_RIGHT
    | t_UP
    | t_DOWN
    | t_RANDOMDIR
    | t_RANDOM
    | t_STATIONARY
    | t_MOVING
    | t_ACTION
    | t_VERTICAL
    | t_HORIZONTAL
    | t_PERPENDICULAR
    | t_ORTHOGONAL
    | t_ARROW_ANY // This can be a "v" so it needs to go at the end (behind t_VERTICAL)

  RuleModifier
    = t_RANDOM
    | t_UP
    | t_DOWN
    | t_LEFT
    | t_RIGHT
    | t_VERTICAL
    | t_HORIZONTAL
    | t_ORTHOGONAL

  RuleModifierLeft
    = RuleModifier // Sometimes people write "RIGHT LATE [..." instead of "LATE RIGHT [..."
    | t_LATE
    | t_RIGID


  RuleLoop =
    t_STARTLOOP lineTerminator+
    RuleItem+
    t_ENDLOOP lineTerminator+

  RuleGroup =
    Rule
    (t_GROUP_RULE_PLUS Rule)+

  HackTileNameIsSFX1 = t_SFX
  HackTileNameIsSFX2 = lookupRuleVariableName t_SFX

  t_ARROW_ANY
    = t_ARROW_UP
    | t_ARROW_DOWN // Because of this, "v" can never be an Object or Legend variable. TODO: Ensure "v" is never an Object or Legend variable
    | t_ARROW_LEFT
    | t_ARROW_RIGHT


  RuleCommand
    = t_AGAIN
    | t_CANCEL
    | t_CHECKPOINT
    | t_RESTART
    | t_WIN
    | t_SFX


  MessageCommand = t_MESSAGE words*



  // Section titles
  t_OBJECTS = caseInsensitive<"OBJECTS">
  t_LEGEND = caseInsensitive<"LEGEND">
  t_SOUNDS = caseInsensitive<"SOUNDS">
  t_COLLISIONLAYERS = caseInsensitive<"COLLISIONLAYERS">
  t_RULES = caseInsensitive<"RULES">
  t_WINCONDITIONS = caseInsensitive<"WINCONDITIONS">
  t_LEVELS = caseInsensitive<"LEVELS">

  t_GROUP_RULE_PLUS = "+"
  t_ELLIPSIS = "..."
  t_AND = caseInsensitive<"AND">
  t_OR = caseInsensitive<"OR">

  t_RIGID = caseInsensitive<"RIGID">
  t_LATE = caseInsensitive<"LATE">
  t_RANDOM = caseInsensitive<"RANDOM">
  t_RANDOMDIR = caseInsensitive<"RANDOMDIR">
  t_ACTION = caseInsensitive<"ACTION">
  t_STARTLOOP = caseInsensitive<"STARTLOOP">
  t_ENDLOOP = caseInsensitive<"ENDLOOP">

  t_UP = caseInsensitive<"UP">
  t_DOWN = caseInsensitive<"DOWN">
  t_LEFT = caseInsensitive<"LEFT">
  t_RIGHT = caseInsensitive<"RIGHT">
  t_ARROW_UP = "^"
  t_ARROW_DOWN = caseInsensitive<"V">
  t_ARROW_LEFT = "<"
  t_ARROW_RIGHT = ">"
  t_MOVING = caseInsensitive<"MOVING">
  t_ORTHOGONAL = caseInsensitive<"ORTHOGONAL">
  t_PERPENDICULAR = caseInsensitive<"PERPENDICULAR">
  t_STATIONARY = caseInsensitive<"STATIONARY">
  t_HORIZONTAL = caseInsensitive<"HORIZONTAL">
  t_VERTICAL = caseInsensitive<"VERTICAL">

  t_AGAIN = caseInsensitive<"AGAIN">
  t_CANCEL = caseInsensitive<"CANCEL">
  t_CHECKPOINT = caseInsensitive<"CHECKPOINT">
  t_RESTART = caseInsensitive<"RESTART">
  t_UNDO = caseInsensitive<"UNDO">
  t_WIN = caseInsensitive<"WIN">
  t_MESSAGE = caseInsensitive<"MESSAGE">

  // WINCONDITIONS tokens
  t_ON = caseInsensitive<"ON">
  t_NO = caseInsensitive<"NO">
  t_ALL = caseInsensitive<"ALL">
  t_ANY = caseInsensitive<"ANY">
  t_SOME = caseInsensitive<"SOME">


  t_SFX0 = caseInsensitive<"SFX0">
  t_SFX1 = caseInsensitive<"SFX1">
  t_SFX2 = caseInsensitive<"SFX2">
  t_SFX3 = caseInsensitive<"SFX3">
  t_SFX4 = caseInsensitive<"SFX4">
  t_SFX5 = caseInsensitive<"SFX5">
  t_SFX6 = caseInsensitive<"SFX6">
  t_SFX7 = caseInsensitive<"SFX7">
  t_SFX8 = caseInsensitive<"SFX8">
  t_SFX9 = caseInsensitive<"SFX9">
  t_SFX10 = caseInsensitive<"SFX10">
  t_SFX =
      t_SFX10 // needs to go 1st because of t_SFX1
    | t_SFX0
    | t_SFX1
    | t_SFX2
    | t_SFX3
    | t_SFX4
    | t_SFX5
    | t_SFX6
    | t_SFX7
    | t_SFX8
    | t_SFX9



  GameMessage = t_MESSAGE words*



  WinConditionItem
    = WinConditionItemSimple
    | WinConditionItemOn

  WinConditionItemSimple = winConditionItemPrefix ruleVariableName lineTerminator+
  WinConditionItemOn = winConditionItemPrefix ruleVariableName t_ON ruleVariableName lineTerminator+

  winConditionItemPrefix =
      t_NO
    | t_ALL
    | t_ANY
    | t_SOME



  LevelItem = (GameMessage | LevelMap) lineTerminator*
  LevelMap = levelMapRow+

  levelMapRow = (~lineTerminator ~t_MESSAGE ~"(" any)+ lineTerminator


  // ================
  // SECTION_NAME
  // ================
  Section<Name, ItemExpr> =
    "="+ lineTerminator
    Name lineTerminator
    "="+ lineTerminator+
    (space* ItemExpr)*
    lineTerminator*

  lineTerminator = space* newline (space newline)*
  sourceCharacter = any

  newline = "\\n"
  whitespace = " " | "\\u0009" /*tab*/

  // redefine what a space is so we can ignore comments
  space := whitespace | multiLineComment

  nonVarChar = whitespace | newline | "[" | "]" | "(" | ")" | "|" | "."

  multiLineComment = "(" textOrComment* (")" | end) // Some games do not close their comments
  textOrComment =
      multiLineComment
    | (~("(" | ")") sourceCharacter)+

  integer = digit+

  // -----------------------
  // Variable Names
  // -----------------------

  // There are 2 classes of restrictions on variable names:
  // - in a Level. object shortcut characters, legend items : These cannot contain the character "="
  // - in Rules. object names, rule references, some legend items : These cannot contain characters like brackets and pipes because they can occur inside a Rule

  legendVariableChar = (~space ~newline ~"=" any)
  // Disallow:
  // space [ ] | t_ELLIPSIS   because it can occur inside a Rule
  // "," because it can occur inside a CollisionLayer
  // "=" because it can occur inside a legend Variable
  ruleVariableChar = (~space ~newline ~"=" ~"[" ~"]" ~"|" ~"," ~t_ELLIPSIS any)

  ruleVariableName = ruleVariableChar+
  lookupRuleVariableName = ~t_AGAIN ruleVariableName // added t_AGAIN to parse '... -> [ tilename AGAIN ]' (it should be a command)
}
`// readFileSync('./grammar.ohm', 'utf-8')

declare interface IGameCode {
  sourceString: string
  startIdx: number
  endIdx: number
  getLineAndColumnMessage: () => string
}


// Return an object with the line and column information for the given
// offset in `str`.
// From https://github.com/harc/ohm/blob/b88336faf69e7bd89e309931b60445c3dfd495ab/src/util.js#L56
function getLineAndColumn (str, offset) {
  let lineNum = 1
  let colNum = 1

  let currOffset = 0
  let lineStartOffset = 0

  let nextLine = null
  let prevLine = null
  let prevLineStartOffset = -1

  while (currOffset < offset) {
    let c = str.charAt(currOffset++)
    if (c === '\n') {
      lineNum++
      colNum = 1
      prevLineStartOffset = lineStartOffset
      lineStartOffset = currOffset
    } else if (c !== '\r') {
      colNum++
    }
  }
  // Find the end of the target line.
  let lineEndOffset = str.indexOf('\n', lineStartOffset)
  if (lineEndOffset === -1) {
    lineEndOffset = str.length
  } else {
    // Get the next line.
    let nextLineEndOffset = str.indexOf('\n', lineEndOffset + 1)
    nextLine = nextLineEndOffset === -1 ? str.slice(lineEndOffset)
                                        : str.slice(lineEndOffset, nextLineEndOffset)
    // Strip leading and trailing EOL char(s).
    nextLine = nextLine.replace(/^\r?\n/, '').replace(/\r$/, '')
  }

  // Get the previous line.
  if (prevLineStartOffset >= 0) {
    prevLine = str.slice(prevLineStartOffset, lineStartOffset)
                  .replace(/\r?\n$/, '')  // Strip trailing EOL char(s).
  }

  // Get the target line, stripping a trailing carriage return if necessary.
  let line = str.slice(lineStartOffset, lineEndOffset).replace(/\r$/, '')

  return {
    lineNum: lineNum,
    colNum: colNum,
    line: line,
    prevLine: prevLine,
    nextLine: nextLine
  }
}

let astId: number = 0
export class BaseForLines {
  __astId: number
  __source: IGameCode

  constructor (source: IGameCode) {
    if (!source || !source.getLineAndColumnMessage) {
      throw new Error(`BUG: failed to provide the source when constructing this object`)
    }
    Object.defineProperty(this, '__source', {
      get: function () { return source }
    })
    this.__astId = astId++
  }
  __getSourceLineAndColumn () {
    return getLineAndColumn(this.__source.sourceString, this.__source.startIdx)
  }
  toString () {
    return `astId=${this.__astId}\n${this.__source.getLineAndColumnMessage()}`
  }

  // This is mostly used for creating code coverage for the games. So we know which Rules (or objects) are not being matched
  __getLineAndColumnRange() {
    const start = getLineAndColumn(this.__source.sourceString, this.__source.startIdx)
    const end   = getLineAndColumn(this.__source.sourceString, this.__source.endIdx - 1) // subtract one to hopefully get the previous line
    return {
      start: { line: start.lineNum, col: start.colNum },
      end: { line: end.lineNum, col: end.colNum },
    }
  }
}

class Dimension {
  width: number
  height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
}

class GameSettings {
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

  constructor() {}

  _setValue(key: any, value: any) {
    this[key] = value
  }
}

export class GameData {
  title: string
  settings: GameSettings
  objects: GameSprite[]
  legends: GameLegendTileSimple[]
  sounds: GameSound[]
  collisionLayers: CollisionLayer[]
  rules: GameRule[]
  winConditions: WinConditionSimple[]
  levels: LevelMap[]

  constructor(
    title: string,
    settings: GameSettings,
    objects: GameSprite[],
    legends: GameLegendTileSimple[],
    sounds: GameSound[],
    collisionLayers: CollisionLayer[],
    rules: GameRule[],
    winConditions: WinConditionSimple[],
    levels: LevelMap[]
  ) {
    this.title = title
    this.settings = settings
    this.objects = objects
    this.legends = legends
    this.sounds = sounds
    this.collisionLayers = collisionLayers
    this.rules= rules
    this.winConditions = winConditions
    this.levels = levels
  }

  _getSpriteByName (name) {
    return this.objects.filter(sprite => sprite._getName().toLowerCase() === name.toLowerCase())[0]
  }
  getMagicBackgroundSprite() {
    return this._getSpriteByName('background')
  }
}

export declare interface IGameTile extends BaseForLines{
  _getDescendantTiles: () => IGameTile[]
  getSprites: () => GameSprite[]
  isInvalid: () => string
  hasCollisionLayer: () => boolean
  setCollisionLayer: (collisionLayer: CollisionLayer) => void
  getCollisionLayerNum: () => number
  matchesCell: (cell: Cell) => boolean
}

export class LevelMap extends BaseForLines {
  _rows: IGameTile[][]

  constructor (source: IGameCode, rows: any[][]) {
    super(source)
    this._rows = rows
  }
  isInvalid (): string {
    const firstRowLength = this._rows[0].length
    let isInvalid = null
    this._rows.forEach((row, index) => {
      if (firstRowLength !== row.length) {
        isInvalid = `Row ${index + 1} does not have the same column count as the first row. Expected ${firstRowLength} columns but found ${row.length}.`
      }
    })
    return isInvalid
  }
  isMap () {
    return true
  }
  getRows () {
    return this._rows
  }
}

export class GameMessage extends BaseForLines {
  _message: string

  constructor (source: IGameCode, message: string) {
    super(source)
    this._message = message
  }
  isInvalid (): string {
    return null
  }
  isMap () {
    return false
  }
}

function hexToRgb (hex: string) {
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

  constructor(r:number, g:number, b:number) {
    this.r = r
    this.g = g
    this.b = b
  }
}

export declare interface IColor {
  isTransparent: () => boolean
  toRgb: () => RGB
}

export class HexColor extends BaseForLines implements IColor {
  _color: RGB
  _colorName: string // only for unit tests & debugging

  constructor (source: IGameCode, color: string) {
    super(source)
    this._color = hexToRgb(color)
    this._colorName = color
  }

  isTransparent () { return false }
  toRgb () {
    return this._color
  }
}

class TransparentColor extends BaseForLines implements IColor {
  isTransparent () { return true }
  toRgb (): RGB {
    throw new Error('BUG: Transparent colors do not have RGB data')
  }
}

export class GameSprite extends BaseForLines implements IGameTile {
  _name: string
  _optionalLegendChar?: string
  _collisionLayer: CollisionLayer

  constructor (source: IGameCode, name: string, optionalLegendChar?: string) {
    super(source)
    this._name = name
    this._optionalLegendChar = optionalLegendChar
  }
  _getName () {
    return this._name
  }
  _getDescendantTiles () {
    return []
  }
  getSprites () {
    // to match the signature of LegendTile
    return [this]
  }
  hasCollisionLayer () {
    return !!this._collisionLayer
  }
  setCollisionLayer (collisionLayer: CollisionLayer) {
    this._collisionLayer = collisionLayer
  }
  getCollisionLayerNum () {
    if (!this._collisionLayer) {
      console.error(this.__source.getLineAndColumnMessage())
      console.error('ERROR: This sprite was not in a Collision Layer')
    }
    return this._collisionLayer.__astId
  }
  isInvalid () {
    if (!this._collisionLayer) {
      return 'This object does not have an entry in the COLLISIONLAYERS section.'
    }
    return null
  }
  matchesCell (cell: Cell): any {
    return cell.getSpritesAsSet().has(this)
  }
}

class GameSpriteSingleColor extends GameSprite {
  _color: HexColor

  constructor (source: IGameCode, name: string, optionalLegendChar: string, colors: HexColor[]) {
    super(source, name, optionalLegendChar)
    this._color = colors[0] // Ignore if the user added multiple colors (like `transparent yellow`)
  }
  getPixels () {
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

  constructor (source: IGameCode, name: string, optionalLegendChar: string, colors: HexColor[], pixels: ('.' | number)[][]) {
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
  isInvalid () {
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
  getSprites () {
    // to match the signature of LegendTile
    return [this]
  }
  getPixels () {
    return this._pixels
  }
}

// TODO: Link up the tiles to objects rather than just storing strings
// TODO: Also, maybe distinguish between legend items that may be in the LevelMap (1 character) from those that point to ObjectItems
export class GameLegendTileSimple extends BaseForLines implements IGameTile {
  _sprites: GameSprite[]
  _spriteNameOrLevelChar: string
  _tiles: IGameTile[]
  _collisionLayer: CollisionLayer

  constructor (source: IGameCode, spriteNameOrLevelChar: string, tiles: IGameTile[]) {
    super(source)
    this._spriteNameOrLevelChar = spriteNameOrLevelChar
    this._tiles = tiles
  }
  isInvalid (): string {
    return null
  }
  isAnd () {
    return true
  }
  matchesCell (cell: Cell) {
    // Check that the cell contains all of the tiles (ANDED)
    // Since this is a Simple Tile it should only contain 1 tile so anding is the right way to go.
    for (const tile of this._tiles) {
      if (!cell.getSpritesAsSet().has(tile)) {
        return false
      }
    }
    return true
  }
  _getDescendantTiles () {
    // recursively pull all the tiles out
    return this._tiles.concat(_.flatten(this._tiles.map(tile => tile._getDescendantTiles()))
  }
  getSprites () {
    // Use a cache because all the collision layers have not been loaded in time
    if (!this._sprites) {
      // 2 levels of indirection should be safe
      // Sort by collisionLayer so that the most-important sprite is first
      this._sprites = _.flatten(
        this._tiles.map(tile => {
          return tile.getSprites()
        })
      ).sort((a, b) => {
        return a.getCollisionLayerNum() - b.getCollisionLayerNum()
      }).reverse()
    }
    return this._sprites
  }
  hasCollisionLayer () {
    return !!this._collisionLayer
  }
  setCollisionLayer (collisionLayer: CollisionLayer) {
    this._collisionLayer = collisionLayer
  }
  getCollisionLayerNum () {
    return this._collisionLayer.__astId
  }
}

export class GameLegendTileAnd extends GameLegendTileSimple {
  isAnd () {
    return true
  }
}

export class GameLegendTileOr extends GameLegendTileSimple {
  isAnd () {
    return false
  }
  matchesCell (cell: Cell) {
    // Check that the cell contains any of the tiles (OR)
    for (const tile of this._tiles) {
      if (cell.getSpritesAsSet().has(tile)) {
        return true
      }
    }
    return false
  }
}

// TODO: Use the Objects rather than just the names
export class CollisionLayer extends BaseForLines {
  _sprites: GameSprite[]

  constructor (source: IGameCode, sprites: GameSprite[]) {
    super(source)
    this._sprites = sprites
  }
  isInvalid (): string {
    return null
  }
}

// Abstract class
export class GameSound extends BaseForLines {
  _soundCode: number

  constructor (source: IGameCode, soundCode: number) {
    super(source)
    this._soundCode = soundCode
  }
}
export class GameSoundSfx extends GameSound {
  _sfxName: string

  constructor (source: IGameCode, sfxName: string, soundCode: number) {
    super(source, soundCode)
    this._sfxName = sfxName
  }
}
export class GameSoundSimpleEnum extends GameSound {
  _simpleEventName: number

  constructor (source: IGameCode, simpleEventName: number, soundCode: number) {
    super(source, soundCode)
    this._simpleEventName = simpleEventName
  }
}
// TODO: Link this up to the Object, rather than just storing the spriteName
export class GameSoundNormal extends GameSound {
  _sprite: IGameTile
  _conditionEnum: string

  constructor (source: IGameCode, sprite: IGameTile, conditionEnum: string, soundCode: number) {
    super(source, soundCode)
    this._sprite = sprite
    this._conditionEnum = conditionEnum
  }
}
export class GameSoundMoveSimple extends GameSound {
  _sprite: IGameTile

  constructor (source: IGameCode, sprite: IGameTile, soundCode: number) {
    super(source, soundCode)
    this._sprite = sprite
  }
}
export class GameSoundMoveDirection extends GameSound {
  _sprite: IGameTile
  _directionEnum: string

  constructor (source: IGameCode, sprite: IGameTile, directionEnum: string, soundCode: number) {
    super(source, soundCode)
    this._sprite = sprite
    this._directionEnum = directionEnum
  }
}

export class WinConditionSimple extends BaseForLines {
  _qualifierEnum: string
  _spriteName: string

  constructor (source: IGameCode, qualifierEnum: string, spriteName: string) {
    super(source)
    this._qualifierEnum = qualifierEnum
    this._spriteName = spriteName
  }
}
export class WinConditionOn extends WinConditionSimple {
  _onSprite: string

  constructor (source: IGameCode, qualifierEnum: string, spriteName: string, onSprite: string) {
    super(source, qualifierEnum, spriteName)
    this._onSprite = onSprite
  }
}

export class GameRuleLoop extends BaseForLines {
  _rules: GameRule[]

  constructor (source: IGameCode, rules: GameRule[]) {
    super(source)
    this._rules = rules
  }

  isValidRule() {
    return false
  }
}

export enum RuleModifier {
  RANDOM = 'RANDOM',
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  VERTICAL = 'VERTICAL',
  HORIZONTAL = 'HORIZONTAL',
  ORTHOGONAL = 'ORTHOGONAL',
  LATE = 'LATE',
  RIGID = 'RIGID'
}

const SIMPLE_DIRECTIONS = new Set([
  RuleModifier.UP,
  RuleModifier.DOWN,
  RuleModifier.LEFT,
  RuleModifier.RIGHT
])

class GameRuleGroup  extends GameRuleLoop {
  // do we really need this class?
}

class GameRule extends BaseForLines {
  _modifiers: string[]
  _conditions: RuleBracket[]
  _actions: RuleBracket[]
  _commands: string[]
  _isValid: boolean

  constructor (source: IGameCode, modifiers: string[], conditions: RuleBracket[], actions: RuleBracket[], commands: string[]) {
    super(source)
    this._modifiers = modifiers
    this._conditions = conditions
    this._actions = actions
    this._commands = commands
  }

  isValidRule() {
    if (this._isValid !== undefined) return this._isValid

    if (this._conditions.length !== this._actions.length && this._actions.length !== 0) {
      this._isValid = false
      throw new Error(`Left side has "${this._conditions.length}" conditions and right side has "${this._actions.length}" actions!`)
    }

    return this._isValid = true
  }

  getMatchedMutatorsOrNull (cell: Cell) {
    if (this.isValidRule() || this._actions.length === 0) {
      return null
    }
    else {
      const matched = []
      for (let i = 0; i < this._conditions.length; i++) {
        const condition = this._conditions[i]
        const match = condition.getMatchedMutatorsOrNull(cell)

        if (match) {
          const action = this._actions[i]
          matched.push(action)
        }
      }
    }
  }
}

class RuleBracket extends BaseForLines {
  _neighbors: RuleBracketNeighbor[]

  constructor (source: IGameCode, neighbors: RuleBracketNeighbor[], hack: string) {
    super(source)
    this._neighbors = neighbors
  }

  getMatchedMutatorsOrNull (cell: Cell) {
    for (let i = 0; i < this._neighbors.length; i++) {
      const neighhbor = this._neighbors[i]
      const match = neighhbor.getMatchedMutatorsOrNull(cell)
      if (!match) return false
    }

    return true
  }
}

class RuleBracketNeighbor extends BaseForLines {
  _modifier?: string
  _tile: IGameTile
  _isEllipsis: boolean

  constructor (source: IGameCode, modifier: string, tile: IGameTile, isEllipsis: boolean) {
    super(source)
    this._modifier = modifier
    this._tile = tile
    this._isEllipsis = isEllipsis
  }

  iSEllipsis() {
    return this._isEllipsis
  }

  getMatchedMutatorsOrNull (cell: Cell) {
    return cell.getSpritesAsSet().has(this._tile)
  }
}

class HackNode extends BaseForLines {
  fields: object
  // These should be addressed as we write the interpreter
  constructor (source: IGameCode, fields: object) {
    super(source)
    this.fields = fields
  }
}

const M_STATIONARY = 'STATIONARY'
const M_NO = 'NO'
const SUPPORTED_CELL_MODIFIERS = new Set([M_STATIONARY, M_NO])

function setIntersection(setA, setB) {
  const intersection = new Set()
  for (const elem of setB) {
    if (setA.has(elem)) {
      intersection.add(elem)
    }
  }
  return intersection
}

function setDifference(setA, setB) {
    const difference = new Set(setA)
    for (const elem of setB) {
        difference.delete(elem)
    }
    return difference
}

class LookupHelper {
  _allSoundEffects: Map<string, GameSound>
  _allObjects: Map<string, GameSprite>
  _allLegendTiles: Map<string, IGameTile>
  _allLevelChars: Map<string, IGameTile>

  constructor () {
    this._allSoundEffects = new Map()
    this._allObjects = new Map()
    this._allLegendTiles = new Map()
    this._allLevelChars = new Map()
  }

  _addToHelper (map, key: string, value: any) {
    if (map.has(key)) {
      throw new Error(`ERROR: Duplicate object is defined named "${key}". They are case-sensitive!`)
    }
    map.set(key, value)
  }
  addSoundEffect (key: string, soundEffect: GameSoundSfx) {
    this._addToHelper(this._allSoundEffects, key.toLowerCase(), soundEffect)
  }
  addToAllObjects (gameObject: GameSprite) {
    this._addToHelper(this._allObjects, gameObject._name.toLowerCase(), gameObject)
  }
  addToAllLegendTiles (legendTile: GameLegendTileSimple) {
    this._addToHelper(this._allLegendTiles, legendTile._spriteNameOrLevelChar.toLowerCase(), legendTile)
  }
  addObjectToAllLevelChars (levelChar: string, gameObject: GameSprite) {
    this._addToHelper(this._allLegendTiles, levelChar.toLowerCase(), gameObject)
    this._addToHelper(this._allLevelChars, levelChar.toLowerCase(), gameObject)
  }
  addLegendToAllLevelChars (legendTile: GameLegendTileSimple) {
    this._addToHelper(this._allLevelChars, legendTile._spriteNameOrLevelChar.toLowerCase(), legendTile)
  }
  lookupObjectOrLegendTile (source: IGameCode, key: string) {
    key = key.toLowerCase()
    const value = this._allObjects.get(key) || this._allLegendTiles.get(key)
    if (!value) {
      console.error(source.getLineAndColumnMessage())
      throw new Error(`ERROR: Could not look up "${key}". Has it been defined in the Objects section or the Legend section?`)
    }
    return value
  }
  lookupObjectOrLegendTileOrSoundEffect (source: IGameCode, key: string) {
    key = key.toLowerCase()
    const value = this._allObjects.get(key) || this._allLegendTiles.get(key) || this._allSoundEffects.get(key)
    if (!value) {
      console.error(source.getLineAndColumnMessage())
      throw new Error(`ERROR: Could not look up "${key}". Has it been defined in the Objects section or the Legend section?`)
    }
    return value
  }
  lookupByLevelChar (key: string) {
    const value = this._allLevelChars.get(key.toLowerCase())
    if (!value) {
      throw new Error(`ERROR: Could not look up "${key}" in the levelChars map. Has it been defined in the Objects section or the Legend section?`)
    }
    return value
  }
}

// Helper for setting a config field
function getConfigField (key: ohm.Node, value: ohm.Node) {
  return [key.parse(), value.parse()]
}

let _GRAMMAR: ohm.Grammar = null

enum ValidationLevel {
  ERROR,
  WARNING,
  INFO
}

class ValidationMessage {
  gameNode: BaseForLines
  level: ValidationLevel
  message: string

  constructor(gameNode, level, message) {
    this.gameNode = gameNode
    this.level = level
    this.message = message
  }
}

class Parser {
  getGrammar () {
    _GRAMMAR = _GRAMMAR || ohm.grammar(GRAMMAR_STR)
    return _GRAMMAR
  }

  parseGrammar (code: string) {
    // 8645c163ff321d2fd1bad3fcaf48c107 has a typo so we .replace()
    // 0c2625672bf47fcf728fe787a2630df6 has a typo se we .replace()
    // another couple of games do not have a trailing newline at the end of the file so we add that
    code = code.replace('][ ->', '] ->').replace('[[spring]', '[spring][') + '\n' // Not all games have a trailing newline. this makes it easier on the parser

    const g = this.getGrammar()
    return {match: g.match(code)}
  }

  parse (code: string) {
    const g = this.getGrammar()
    const {match: m} = this.parseGrammar(code)
    const validationMessages = []

    function addValidationMessage(source, level, message) {
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
          const gameObject:GameSprite = _1.parse()
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
          return new GameLegendTileSimple(this.source, spriteNameOrLevelChar.parse(), [tile.parse()])
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
          const tiles = tileNames.parse().map((spriteName) => lookup.lookupObjectOrLegendTile(this.source, spriteName))
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
          return new GameRule(this.source, _.flatten(modifiers.parse()), conditions.parse(), actions.parse(), commands.parse().concat(optionalMessageCommand.parse()))
        },
        RuleBracket: function (_openBracket, neighbors, hackAgain, _closeBracket) {
          return new RuleBracket(this.source, neighbors.parse(), hackAgain.parse())
        },
        RuleBracketNeighbor: function (_1) {
          return _1.parse()
        },
        RuleBracketEllipsisNeighbor: function ({modifier, tile}) {
          return new RuleBracketNeighbor(this.source, modifier, tile, true)
        },
        RuleBracketNoEllipsisNeighbor: function ({modifier, tile}) {
          return new RuleBracketNeighbor(this.source,modifier, tile, false)
        },
        TileWithModifier: function (optionalModifier, tile) {
          return {modifier: optionalModifier.parse()[0], tile: tile.parse()}
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
          return new HackNode(this.source, {tile: tile.parse(), sfx: sfx.parse()})
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
          const hex = lookupColorPalette(currentColorPalette)[colorName]
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
        lineTerminator: (_1, _2, _3, _4) => {},
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

      return {data: game, validationMessages }
    } else {
      const trace = g.trace(code)
      return {error: m, trace: trace}
    }
  }
}

export default new Parser()
