const ohm = require('ohm-js')
const {lookupColorPalette} = require('./colors')

const GRAMMAR_STR = `
Puzzlescript {
  Details =
    lineTerminator* // Version information
    Title lineTerminator+
    (OptionalSetting lineTerminator+)*
    Section<t_OBJECTS, Sprite>?
    Section<t_LEGEND, LegendItem>?
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

  spriteName = ruleVariableName
  colorTransparent = "transparent"
  colorHex6 = "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit
  colorHex3 = "#" hexDigit hexDigit hexDigit
  colorNameOrHex = colorTransparent | colorHex6 | colorHex3 | colorName
  colorName = letter+
  pixelRow = pixelDigit+ lineTerminator
  pixelDigit = digit | "."
  legendShortcutChar = (~lineTerminator any)

  PixelRows = pixelRow pixelRow pixelRow pixelRow pixelRow




  LegendItem
    = LegendItemSimple
    | LegendItemAnd
    | LegendItemOr

  LegendItemSimple = LegendVarNameDefn "=" LegendVarNameDefn lineTerminator+
  LegendItemAnd = LegendVarNameDefn "=" NonemptyListOf<LegendVarNameDefn, t_AND> lineTerminator+
  LegendItemOr = LegendVarNameDefn "=" NonemptyListOf<LegendVarNameDefn, t_OR> lineTerminator+

  LegendVarNameDefn = ruleVariableName | legendVariableChar




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
  = Rule
  | RuleLoop

Rule = t_GROUP_RULE_PLUS? RuleModifierLeft* CellSequenceBracket+ "->" RuleAction lineTerminator+

RuleAction
  = RuleActionBrackets
  | RuleActionCommands1
  | RuleActionCommands2

RuleActionBrackets = CellSequenceBracket+ RuleCommand* MessageCommand? // Verify the left-hand structure matches the right-hand
RuleActionCommands1 = RuleCommand+ MessageCommand?
RuleActionCommands2 = RuleCommand* MessageCommand


CellSequenceBracket = RuleModifier* CellSequenceBracketOnly

CellSequenceBracketOnly
  = EllipsisBracket
  | SimpleBracket


EllipsisBracket = "[" space* NeighboringCells t_ELLIPSIS "|" NeighboringCells "]"
SimpleBracket = "[" space* NeighboringCells "]"

NeighboringCells = NonemptyListOf<Cell, "|">

Cell
  = CellSequenceBracketHack // Uggh, some games mis-typed and have nested brackets
  | CellLayer*

CellSequenceBracketHack = SimpleBracket  // Uggh, some games mis-typed and have nested brackets. They should be unwrapped as a Cell when semantically parsed

CellLayer
  = HackCellLayer1
  | HackCellLayer2
  | SimpleCellLayer

SimpleCellLayer = (cellLayerModifier)* cellName
HackCellLayer1 = HackRuleCommand
HackCellLayer2 = cellName HackRuleCommand

HackRuleCommand = RuleCommand ~letter // HACK: These should be moved up to the Rule Action, not nested way down here


cellName = ruleVariableName

cellLayerModifier = space* cellLayerModifierInner space+ // Force-check that there is whitespace after the cellLayerModifier so things like "STATIONARYZ" or "NOZ" are not parsed as a modifier (they are a variable that happens to begin with the same text as a modifier)

cellLayerModifierInner
  = t_NO
  // The following are probably not actually cellLayerModifier's ... Check that they only exist at the beginning of a "["
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
  Rule+
  t_ENDLOOP lineTerminator+


t_ARROW_ANY
  = t_ARROW_UP
  | t_ARROW_DOWN // Because of this, "v" can never be an Object or Legend variable. TODO: Ensure "v" is never an Object or Legend variable
  | t_ARROW_LEFT
  | t_ARROW_RIGHT


RuleCommand =
    t_AGAIN
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
    "===" headingBar lineTerminator
    Name lineTerminator
    "===" headingBar lineTerminator+
    (space* ItemExpr)*
    lineTerminator*

  headingBar = "="*
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
}
`// readFileSync('./grammar.ohm', 'utf-8')

let astId = 0
class BaseForLines {
  constructor (source) {
    if (!source || !source.getLineAndColumnMessage) {
      throw new Error(`BUG: failed to provide the source when constructing this object`)
    }
    Object.defineProperty(this, '__source', {
      get: function () { return source }
    })
    this.__astId = astId++
  }
  addValidationMessage(level, message) {
    if (!this.__validationMessages) {
      this.__validationMessages = []
    }
    this.__validationMessages.push({level, message})
    if (level === 'ERROR') {
      console.error(this.toString())
      throw new Error(message)
    }
  }
  toString () {
    return `astId=${this.__astId}\n${this.__source.getLineAndColumnMessage()}`
  }
}

class LevelMap extends BaseForLines {
  constructor (source, rows) {
    super(source)
    this._rows = rows
  }
  isInvalid () {
    const cols = this._rows[0].length
    let isInvalid = false
    this._rows.forEach((row, index) => {
      if (cols !== row.length) {
        isInvalid = `Row ${index + 1} does not have the same column count as the first row. Expected ${cols} columns but found ${row.length}.`
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

class GameMessage extends BaseForLines {
  constructor (source, message) {
    super(source)
    this._message = message
  }
  isInvalid () {
    return false
  }
  isMap () {
    return false
  }
}

function hexToRgb (hex) {
  if (!hex) {
    return {a: 0}
  }
  // https://stackoverflow.com/a/5624139
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b
  })

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: 1
  } : null
}

class HexColor extends BaseForLines {
  constructor (source, color) {
    super(source)
    // if (!color) {
    //   console.error(source.getLineAndColumnMessage())
    //   throw new Error(`BUG: Missing color arg`)
    // }
    this._color = color
  }

  toRgba () {
    return hexToRgb(this._color)
  }
}

class GameSprite extends BaseForLines {
  constructor(source, name, optionalLegendChar) {
    super(source)
    this._name = name
    this._optionalLegendChar = optionalLegendChar
  }
  getSprites () {
    // to match the signature of LegendItem
    return [this]
  }
  setCollisionLayer (collisionLayer) {
    if (this._collisionLayer) {
      this.addValidationMessage('WARNING', 'An Object should not belong to more than one collision layer')
    }
    this._collisionLayer = collisionLayer
  }
  isInvalid () {
    return !this._collisionLayer // ensure that every object is on a CollisionLayer
  }
}
class GameSpriteNoPixels extends GameSprite {
  constructor (source, name, optionalLegendChar, colors) {
    super(source, name, optionalLegendChar)
    this._color = colors[0] // Ignore if the user added multiple colors (like `transparent yellow`)
  }
  isInvalid () {
    return false
  }
  getPixels () {
    // When there are no pixels then it means "color the whole thing in the same color"
    const rows = []
    for (let row = 0; row < 5; row++) {
      rows.push([])
      for (let col = 0; col < 5; col++) {
        rows[row].push(this._color)
      }
    }
    return rows
  }
}

class GameSpritePixels extends GameSprite {
  constructor (source, name, optionalLegendChar, colors, pixels) {
    super(source, name, optionalLegendChar)
    this._colors = colors
    this._pixels = pixels // Pixel colors are 0-indexed.
  }
  isInvalid () {
    let isInvalid = false
    const colorLen = this._colors.length
    const rowLen = this._pixels[0].length
    this._pixels.forEach((row) => {
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
    // to match the signature of LegendItem
    return [this]
  }
  getPixels () {
    return this._pixels.map(row => {
      return row.map(col => {
        if (col === '.') {
          return null
        } else {
          return this._colors[col]
        }
      })
    })
  }
}

// TODO: Link up the aliases to objects rather than just storing strings
// TODO: Also, maybe distinguish between legend items that may be in the LevelMap (1 character) from those that point to ObjectItems
class GameLegendItemSimple extends BaseForLines {
  constructor (source, spriteNameOrLevelChar, alias) {
    super(source)
    this._spriteNameOrLevelChar = spriteNameOrLevelChar
    this._aliases = Array.isArray(alias) ? alias : [alias]
  }
  isInvalid () {
    return false
  }
  getSprites () {
    // 2 levels of indirection should be safe
    return this._aliases.map(alias => alias.getSprites()[0])
  }
  setCollisionLayer (collisionLayer) {
    if (this._collisionLayer && this._collisionLayer !== collisionLayer) {
      this.addValidationMessage('WARNING', 'An Object should not belong to more than one collision layer')
    }
    this._collisionLayer = collisionLayer

    this._aliases.forEach((alias) => {
      alias.setCollisionLayer(collisionLayer)
    })
  }

}

class GameLegendItemAnd extends GameLegendItemSimple {
}

class GameLegendItemOr extends GameLegendItemSimple {
}

// TODO: Use the Objects rather than just the names
class CollisionLayer extends BaseForLines {
  constructor (source, sprites) {
    super(source)
    this._sprites = sprites
  }
  isInvalid () {
    return true // until we map the aliases to actual Objects rather than strings to look up later
  }
}

// Abstract class
class GameSound extends BaseForLines {
  constructor (source, soundCode) {
    super(source)
    this._soundCode = soundCode
  }
}
class GameSoundSfx extends GameSound {
  constructor (source, sfxName, soundCode) {
    super(source, soundCode)
    this._sfxName = sfxName
  }
}
class GameSoundSimpleEnum extends GameSound {
  constructor (source, simpleEventName, soundCode) {
    super(source, soundCode)
    this._simpleEventName = simpleEventName
  }
}
// TODO: Link this up to the Object, rather than just storing the spriteName
class GameSoundNormal extends GameSound {
  constructor (source, sprite, conditionEnum, soundCode) {
    super(source, soundCode)
    this._sprite = sprite
    this._conditionEnum = conditionEnum
  }
}
class GameSoundMoveSimple extends GameSound {
  constructor (source, sprite, soundCode) {
    super(source, soundCode)
    this._sprite = sprite
  }
}
class GameSoundMoveDirection extends GameSound {
  constructor (source, sprite, directionEnum, soundCode) {
    super(source, soundCode)
    this._sprite = sprite
    this._directionEnum = directionEnum
  }
}

class WinConditionSimple extends BaseForLines {
  constructor (source, qualifierEnum, spriteName) {
    super(source)
    this._qualifierEnum = qualifierEnum
    this._spriteName = spriteName
  }
}
class WinConditionOn extends BaseForLines {
  constructor (source, qualifierEnum, spriteName, onSprite) {
    super(source)
    this._qualifierEnum = qualifierEnum
    this._spriteName = spriteName
    this._onSprite = onSprite
  }
}

class GameRuleLoop extends BaseForLines {
  constructor (source, rules) {
    super(source)
    this._rules = rules
  }
  doesntMatchCell (cell) {
    return 'Loops are not supported yet'
  }
}

class GameRule extends BaseForLines {
  constructor (source, ruleModifiers, productionModifiers, cellSequenceBrackets, ruleAction) {
    super(source)
    this._ruleModifiers = ruleModifiers
    this._productionModifiers = productionModifiers
    this._cellSequenceBrackets = cellSequenceBrackets
    this._ruleAction = ruleAction

    // Validate that the structure of the left side matches the structure of the right side
    const mismatch = this._ruleAction.doesntMatchConditionStructure(this._cellSequenceBrackets)
    if (mismatch) {
      console.error(mismatch.toString())
      this.addValidationMessage('ERROR', 'structure of left side of the rule does not match right side')
    }
  }

  doesntMatchCell (cell) {
    let ret = null
    for (const sequence of this._cellSequenceBrackets) {
      ret = sequence.doesntMatchCell(cell)
      if (ret) {
        break
      }
    }
    return ret
  }
}

function checkLength(conditions, actions) {
  if (conditions.length !== actions.length) {
    return `counts mismatch. Left is ${conditions.length} while Right is ${actions.length}`
  }
}
function checkLengthAndRecurse(conditions, actions) {
    // console.log('--------- START');
    // console.log(conditions);
    // console.log(actions);
    // console.log('--------- END');

    let ret = checkLength(conditions, actions)
    if (ret) return ret
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i]
      const action = actions[i]
      ret = action.doesntMatchConditionStructure(condition)
      if (ret) break
    }
    return ret
}

class GameRuleActionBrackets extends BaseForLines {
  constructor (source, cellSequenceBrackets, ruleCommands) {
    super(source)
    this._cellSequenceBrackets = cellSequenceBrackets
    this._ruleCommands = ruleCommands
  }

  doesntMatchConditionStructure (conditionBrackets) {
    const actionBrackets = this._cellSequenceBrackets
    return checkLengthAndRecurse(conditionBrackets, actionBrackets)
  }
}

class GameRuleSequenceBracket extends BaseForLines {
  constructor (source, ruleModifiers, bracket) {
    super(source)
    this._ruleModifiers = ruleModifiers
    this._bracket = bracket
  }

  doesntMatchCell (cell) {
    return this._bracket.doesntMatchCell(cell)
  }

  doesntMatchConditionStructure (condition) {
    return this._bracket.doesntMatchConditionStructure(condition._bracket)
  }
}

class RuleEllipsisBracket extends BaseForLines {
  constructor (source, leftNeighboringCells, rightNeighboringCells) {
    super(source)
    this._leftNeighboringCells = leftNeighboringCells
    this._rightNeighboringCells = rightNeighboringCells
  }
  doesntMatchConditionStructure (condition) {
    // Only check the length because the number of cellLayers inside can be different (some are added and some are removed as part of the rule)
    let ret = checkLength(condition._leftNeighboringCells, this._leftNeighboringCells)
    if (ret) return ret
    return checkLength(condition._rightNeighboringCells, this._rightNeighboringCells)
  }
}

class GameRuleSimpleBracket extends BaseForLines {
  constructor (source, neighbors) {
    super(source)
    this._neighbors = neighbors
  }

  doesntMatchCell (cell) {
    if (this._neighbors.length > 1) { return `BUG: checking neighbors not implemented yet` }
    // Check if all the cellLayers are on the current cell
    let ret = null
    for (const layer of this._neighbors[0]) {
      ret = layer.doesntMatchCell(cell)
      if (ret) break
    }
    return ret
  }

  doesntMatchConditionStructure (conditionBracket) {
    // No need to check the number of cells inside a neighbor block because they can be added or removed so they do not have to match up
    return checkLength(conditionBracket._neighbors, this._neighbors)
  }
}

class RuleActionCommands extends BaseForLines {
  constructor (source, commands) {
    super(source)
    this._commands = commands
  }
  doesntMatchConditionStructure () {
    // The left-hand-side structure does not matter since we are executing commands
    return false
  }
}

const M_STATIONARY = 'STATIONARY'

class GameRuleCellLayer extends BaseForLines {
  constructor (source, cellModifiers, sprite) {
    super(source)
    this._cellModifiers = new Set(cellModifiers)
    this._sprite = sprite
  }
  getSprites () {
    return this._sprite.getSprites()
  }
  doesntMatchCell (cell) {
    let ret = null
    const mods = this._cellModifiers
    if (mods.size > 1 || mods.size === 1 && !mods.has(M_STATIONARY)) {
      // Not supported yet
      return this
    }
    for (const sprite of this.getSprites()) {
      if (!cell.getSpritesAsSet().has(sprite)) {
        ret = sprite
      }
    }
    return ret
  }

}

class GameRuleCellLayerHack extends BaseForLines {
  constructor (source, spriteName, hackRuleCommand) {
    super(source)
    this._spriteNameMaybeNull = spriteName
    this._hackRuleCommand = hackRuleCommand
  }
}

class LookupHelper {
  constructor () {
    this._allSoundEffects = new Map()
    this._allObjects = new Map()
    this._allLegendItems = new Map()
    this._allLevelChars = new Map()
  }

  _addToHelper (map, key, value) {
    if (map.has(key)) {
      throw new Error(`ERROR: Duplicate object is defined named "${key}". They are case-sensitive!`)
    }
    map.set(key, value)
  }
  addSoundEffect (key, soundEffect) {
    this._addToHelper(this._allSoundEffects, key.toLowerCase(), soundEffect)
  }
  addToAllObjects (gameObject) {
    this._addToHelper(this._allObjects, gameObject._name.toLowerCase(), gameObject)
  }
  addToAllLegendItems (legendItem) {
    this._addToHelper(this._allLegendItems, legendItem._spriteNameOrLevelChar.toLowerCase(), legendItem)
  }
  addObjectToAllLevelChars (levelChar, gameObject) {
    this._addToHelper(this._allLegendItems, levelChar.toLowerCase(), gameObject)
    this._addToHelper(this._allLevelChars, levelChar.toLowerCase(), gameObject)
  }
  addLegendToAllLevelChars (legendItem) {
    this._addToHelper(this._allLevelChars, legendItem._spriteNameOrLevelChar.toLowerCase(), legendItem)
  }
  lookupObjectOrLegendItem (source, key) {
    key = key.toLowerCase()
    const value = this._allObjects.get(key) || this._allLegendItems.get(key)
    if (!value) {
      console.error(source.getLineAndColumnMessage())
      throw new Error(`ERROR: Could not look up "${key}". Has it been defined in the Objects section or the Legend section?`)
    }
    return value
  }
  lookupObjectOrLegendItemOrSoundEffect (source, key) {
    key = key.toLowerCase()
    const value = this._allObjects.get(key) || this._allLegendItems.get(key) || this._allSoundEffects.get(key)
    if (!value) {
      console.error(source.getLineAndColumnMessage())
      throw new Error(`ERROR: Could not look up "${key}". Has it been defined in the Objects section or the Legend section?`)
    }
    return value
  }
  lookupByLevelChar (key) {
    const value = this._allLevelChars.get(key.toLowerCase())
    if (!value) {
      throw new Error(`ERROR: Could not look up "${key}" in the levelChars map. Has it been defined in the Objects section or the Legend section?`)
    }
    return value
  }
}

// Helper for setting a config field
function getConfigField (key, value) {
  return [key.parse(), value.parse()]
}

let _GRAMMAR = null
function getGrammar () {
  _GRAMMAR = _GRAMMAR || ohm.grammar(GRAMMAR_STR)
  return _GRAMMAR
}

function parseGrammar (code) {
  // 8645c163ff321d2fd1bad3fcaf48c107 has a typo so we .replace()
  code = code.replace('][ ->', '] ->') + '\n' // Not all games have a trailing newline. this makes it easier on the parser

  const g = getGrammar()
  return {match: g.match(code)}
}

function parse (code) {
  const g = getGrammar()
  const {match: m} = parseGrammar(code)

  if (m.succeeded()) {
    const lookup = new LookupHelper()
    const s = g.createSemantics()

    let currentColorPalette = 'mastersystem' // default

    s.addOperation('parse', {
      Details: (_whitespace1, title, _whitespace2, settingsFields, _whitespace3, objects, legends, sounds, collisionLayers, rules, winConditions, levels) => {
        const settings = {}
        settingsFields.parse().forEach((setting) => {
          if (Array.isArray(setting)) {
            settings[setting[0]] = setting[1]
          } else {
            settings[setting] = true
          }
        })
        return {
          title: title.parse(),
          settings: settings,
          // Use [0] because each of them are optional (at least because of unit tests)
          objects: objects.parse()[0] || [],
          legends: legends.parse()[0] || [],
          sounds: sounds.parse()[0] || [],
          collisionLayers: collisionLayers.parse()[0] || [],
          rules: rules.parse()[0] || [],
          winConditions: winConditions.parse()[0] || [],
          levels: levels.parse()[0] || []
        }
      },
      Title: (_1, value) => {
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

      Section: (_threeDashes1, _headingBar1, _lineTerminator1, _sectionName, _lineTerminator2, _threeDashes2, _headingBar2, _8, _9, _10, _11) => {
        return _10.parse()
      },
      Sprite: function (_1) {
        const gameObject = _1.parse()
        lookup.addToAllObjects(gameObject)
        if (gameObject._optionalLegendChar) {
          // addObjectToAllLegendItems(gameObject)
          lookup.addObjectToAllLevelChars(gameObject._optionalLegendChar, gameObject)
        } else if (gameObject._name.length === 1) {
          lookup.addObjectToAllLevelChars(gameObject._name, gameObject)
        }
        return gameObject
      },
      SpritePixels: function (name, optionalLegendChar, _3, colors, _5, pixels, _7) {
        optionalLegendChar = optionalLegendChar.parse()[0]
        return new GameSpritePixels(this.source, name.parse(), optionalLegendChar, colors.parse(), pixels.parse())
      },
      SpriteNoPixels: function (name, optionalLegendChar, _3, colors, _5) {
        optionalLegendChar = optionalLegendChar.parse()[0]
        return new GameSpriteNoPixels(this.source, name.parse(), optionalLegendChar, colors.parse())
      },
      PixelRows: function (row1, row2, row3, row4, row5) {
        // Exactly 5 rows. We do this because some games contain vertical whitespace after, but not all
        return [
          row1.parse(),
          row2.parse(),
          row3.parse(),
          row4.parse(),
          row5.parse(),
        ]
      },
      LegendItem: function (_1) {
        const legendItem = _1.parse()
        // Replace all the Object Names with the actual objects
        legendItem._aliases = legendItem._aliases.map((alias) => {
          return lookup.lookupObjectOrLegendItem(this.source, alias)
        })
        lookup.addToAllLegendItems(legendItem)
        if (legendItem._spriteNameOrLevelChar.length === 1) {
          lookup.addLegendToAllLevelChars(legendItem)
        }
        return legendItem
      },
      LegendItemSimple: function (spriteNameOrLevelChar, _equals, alias, _whitespace) {
        // TODO: Do the lookup and adding to sets here rather than rewiring in LegendItem
        return new GameLegendItemSimple(this.source, spriteNameOrLevelChar.parse(), alias.parse())
      },
      LegendItemAnd: function (spriteNameOrLevelChar, _equals, aliases, _whitespace) {
        return new GameLegendItemAnd(this.source, spriteNameOrLevelChar.parse(), aliases.parse())
      },
      LegendItemOr: function (spriteNameOrLevelChar, _equals, aliases, _whitespace) {
        return new GameLegendItemOr(this.source, spriteNameOrLevelChar.parse(), aliases.parse())
      },
      SoundItem: function (_1, _whitespace) {
        return _1.parse()
      },
      SoundItemEnum: function (simpleEnum, soundCode) {
        return new GameSoundSimpleEnum(this.source, simpleEnum.parse(), soundCode.parse())
      },
      SoundItemSfx: function (sfxName, soundCode) {
        sfxName = sfxName.parse()
        const sound = new GameSoundSfx(this.source, sfxName, soundCode.parse())
        lookup.addSoundEffect(sfxName, sound)
        return sound
      },
      SoundItemMoveSimple: function (spriteName, _2, soundCode) {
        return new GameSoundMoveSimple(this.source, lookup.lookupObjectOrLegendItem(this.source, spriteName.parse()), soundCode.parse())
      },
      SoundItemMoveDirection: function (spriteName, _move, directionEnum, soundCode) {
        return new GameSoundMoveDirection(this.source, lookup.lookupObjectOrLegendItem(this.source, spriteName.parse()), directionEnum.parse(), soundCode.parse())
      },
      SoundItemNormal: function (spriteName, eventEnum, soundCode) {
        return new GameSoundNormal(this.source, lookup.lookupObjectOrLegendItem(this.source, spriteName.parse()), eventEnum.parse(), soundCode.parse())
      },
      CollisionLayerItem: function (spriteNames, _2, _3) {
        const objects = spriteNames.parse().map((spriteName) => lookup.lookupObjectOrLegendItem(this.source, spriteName))
        const collisionLayer = new CollisionLayer(this.source, objects)
        // Map all the Objects to the layer
        objects.forEach((object) => {
          object.setCollisionLayer(collisionLayer)
        })
      },

      RuleItem: function (_1) {
        return _1.parse()
      },

      Rule: function (rulePlus, productionModifiers, cellSequenceBrackets, _arrow, ruleAction, _whitespace) {
        return new GameRule(this.source, rulePlus.parse(), productionModifiers.parse(), cellSequenceBrackets.parse(), ruleAction.parse())
      },
      RuleLoop: function (_startloop, _whitespace1, rules, _endloop, _whitespace2) {
        return new GameRuleLoop(this.source, rules.parse())
      },
      CellSequenceBracket: function (ruleModifiers, bracket) {
        return new GameRuleSequenceBracket(this.source, ruleModifiers.parse(), bracket.parse())
      },
      EllipsisBracket: function (_leftBracket, _whitespace, leftNeighboringCells, _ellipsis, _pipe, rightNeighboringCells, _rightBracket) {
        return new RuleEllipsisBracket(this.source, leftNeighboringCells.parse(), rightNeighboringCells.parse())
      },
      SimpleBracket: function (_leftBracket, _whitespace, cellLayers, _rightBracket) {
        return new GameRuleSimpleBracket(this.source, cellLayers.parse())
      },
      CellLayer: function (_1) {
        return _1.parse()
      },
      SimpleCellLayer: function (cellModifiers, cellName) {
        return new GameRuleCellLayer(this.source, cellModifiers.parse(), lookup.lookupObjectOrLegendItem(this.source, cellName.parse()))
      },
      HackCellLayer1: function (hackRuleCommand) {
        return new GameRuleCellLayerHack(this.source, null, hackRuleCommand.parse())
      },
      HackCellLayer2: function (cellName, hackRuleCommand) {
        return new GameRuleCellLayerHack(this.source, lookup.lookupObjectOrLegendItem(this.source, cellName.parse()), hackRuleCommand.parse())
      },
      cellName: function (_1) {
        return _1.parse()
      },
      cellLayerModifier: function (_whitespace1, cellLayerModifier, _whitespace2) {
        return cellLayerModifier.parse()
      },

      RuleActionBrackets: function (cellSequenceBrackets, ruleCommands, optionalMessageCommand) {
        return new GameRuleActionBrackets(this.source, cellSequenceBrackets.parse(), ruleCommands.parse().concat(optionalMessageCommand.parse()))
      },
      RuleActionCommands1: function (commands, message) {
        return new RuleActionCommands(this.source, commands.parse().concat(message.parse()))
      },
      RuleActionCommands2: function (commands, message) {
        return new RuleActionCommands(this.source, commands.parse().concat(message.parse()))
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
        rows = rows.parse().map((row) => {
          return row.map((levelChar) => {
            return lookup.lookupByLevelChar(levelChar)
          })
        })
        return new LevelMap(this.source, rows)
      },
      levelMapRow: function (row, _2) {
        return row.parse()
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
        return new HexColor(this.source, lookupColorPalette(currentColorPalette)[this.sourceString.toLowerCase()])
      },
      NonemptyListOf: function (_1, _2, _3) {
        return [_1.parse()].concat(_3.parse())
      },
      nonemptyListOf: function (_1, _2, _3) {
        // Do this special because LegendItem contains things like `X = A or B or C` and we need to know if they are `and` or `or`
        return {
          __type: 'nonemptyListOf',
          values: [_1.parse()].concat(_3.parse()),
          separators: [_2.parse()]
        }
      },
      integer: function (_1) {
        return Number.parseInt(this.sourceString)
      },
      decimalWithLeadingNumber: function (_1, _2, _3) {
        return Number.parseFloat(this.sourceString)
      },
      decimalWithLeadingPeriod: function (_1, _2) {
        return Number.parseFloat(this.sourceString)
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
    const game = s(m).parse()
    // console.log(game)

    // Validate that the game objects are rectangular
    game.objects.forEach((object) => {
      if (object.isInvalid()) {
        console.warn(`WARNING: Game Object is Invalid. Reason: ${object.isInvalid()}`)
        console.warn(object.__source.getLineAndColumnMessage())
      }
    })

    // Validate that the level maps are rectangular
    game.levels.forEach((level) => {
      if (level.isInvalid()) {
        console.warn(`WARNING: Level is Invalid. Reason: ${level.isInvalid()}`)
        console.warn(level.__source.getLineAndColumnMessage())
      }
    })

    return {data: game}
  } else {
    const trace = g.trace(code)
    return {error: m, trace: trace}
  }
}

module.exports = {
  parse,
  parseGrammar,
  getGrammar,
  BaseForLines,
  LevelMap,
  GameMessage,
  HexColor,
  GameSprite,
  GameLegendItemSimple,
  GameLegendItemAnd,
  GameLegendItemOr,
  CollisionLayer,
  GameSound,
  GameSoundSfx,
  GameSoundSimpleEnum,
  GameSoundNormal,
  GameSoundMoveSimple,
  GameSoundMoveDirection,
  WinConditionSimple,
  WinConditionOn,
  GameRuleLoop
}
