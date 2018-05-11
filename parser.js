const glob = require('glob')
const ohm = require('ohm-js')
const {readFileSync} = require('fs')

const grammar = `
Puzzlescript {
  Details =
    lineTerminator* // Version information
  	Title lineTerminator+
    (OptionalSetting lineTerminator+)*
    Section<t_OBJECTS, ObjectsItem>
    Section<t_LEGEND, legendItem>
    Section<t_SOUNDS, SoundItem>
    Section<t_COLLISIONLAYERS, CollisionLayerItem>
    Section<t_RULES, RuleItem>
    Section<t_WINCONDITIONS, WinConditionItem>
    Section<t_LEVELS, LevelItem>

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



  ObjectsItem =
  	objectName legendShortcutChar? lineTerminator
    nonemptyListOf<colorNameOrHex, spaces> lineTerminator+
    pixelRow*
    lineTerminator*

  objectName = varName
  colorTransparent = "transparent"
  colorHex6 = "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit
  colorHex3 = "#" hexDigit hexDigit hexDigit
  colorNameOrHex = colorTransparent | colorHex6 | colorHex3 | colorName
  colorName = letter+
  pixelRow = pixelDigit+ lineTerminator
  pixelDigit = digit | "."
  legendShortcutChar = (~lineTerminator any)





  legendItem = legendVarNameDefn spaces "=" spaces nonemptyListOf<legendVarNameDefn, andOr> lineTerminator+ // TODO: Remove the 'spaces' in favor of an upper-case non-lexer rule
  andOr = spaces (t_AND | t_OR) spaces
  legendCharDefn = any // a single character that is allowed to be in a puzzle level
  legendVarNameDefn = varName | legendCharDefn
  // You can define "[" in the legend but you cannot use it in the rules
  legendVarNameUse = varName | (~nonVarChar any)




  // TODO: Handle tokens like sfx0 and explicit args instead of just varName (like "Player CantMove up")
  // all of them are at https://www.puzzlescript.net/Documentation/sounds.html
  SoundItem = SoundItemInner integer lineTerminator+

  SoundItemInner =
      t_RESTART
    | t_UNDO
    | t_TITLESCREEN
    | t_STARTGAME
    | t_STARTLEVEL
    | t_ENDLEVEL
    | t_ENDGAME
    | t_SHOWMESSAGE
    | t_CLOSEMESSAGE
    | soundItemSfx
    | SoundItemNormal

  soundItemSfx = t_SFX
  SoundItemNormal = varName SoundItemAction?

  SoundItemAction =
      t_CREATE
    | t_DESTROY
    | t_CANTMOVE
    | SoundItemActionMove

  SoundItemActionMove = t_MOVE soundItemActionMoveArg?
  soundItemActionMoveArg =
      t_UP
    | t_DOWN
    | t_LEFT
    | t_RIGHT
    | varName

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



  CollisionLayerItem = NonemptyListOf<varName, ","?> ","? /*support a trailing comma*/ lineTerminator+


  RuleItem = (RuleItemReal | t_STARTLOOP | t_ENDLOOP) lineTerminator+

  RuleItemReal = t_GROUP_RULE_PLUS? t_RIGID? RuleConditionWithLeftArgs+ "->" RuleCondition* RuleCommand*

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
  t_STARTLOOP = caseInsensitive<"STARTLOOP">
  t_ENDLOOP = caseInsensitive<"ENDLOOP">

  t_UP = caseInsensitive<"UP">
  t_DOWN = caseInsensitive<"DOWN">
  t_LEFT = caseInsensitive<"LEFT">
  t_RIGHT = caseInsensitive<"RIGHT">
  t_UP_ARROW = "^"
  t_DOWN_ARROW = caseInsensitive<"V">
  t_LEFT_ARROW = "<"
  t_RIGHT_ARROW = ">"
  t_MOVING = caseInsensitive<"MOVING">
  t_ORTHOGONAL = caseInsensitive<"ORTHOGONAL">
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


  ruleDirection2 =
      t_UP
    | t_DOWN
    | t_LEFT
    | t_RIGHT
    | t_HORIZONTAL
    | t_VERTICAL

  RuleCommand =
      GameMessage
    | t_AGAIN
    | t_CANCEL
    | t_CHECKPOINT
    | t_RESTART
    | t_WIN
    | t_SFX

  GameMessage = t_MESSAGE words*

  RuleCondition = ruleDirection2* RuleConditionBracket

  RuleConditionWithLeftArgs = (ruleDirection2 | t_LATE | t_RANDOM)* RuleConditionBracket // because of Bubble Butler... it has "right late [..."

  RuleConditionBracket = "[" ListOf<RuleConditionEntry?, "|"> "]"

  RuleConditionEntry =
      RuleConditionEntryFull
    | RuleConditionBracket
    | t_ELLIPSIS

  RuleConditionEntryFull = (ruleDirection3? legendVarNameUse)+

  ruleDirection3 =
      t_MOVING
    | t_ORTHOGONAL
    | t_STATIONARY
    | t_UP_ARROW
    | t_DOWN_ARROW
    | t_LEFT_ARROW
    | t_RIGHT_ARROW
    | t_UP
    | t_DOWN
    | t_LEFT
    | t_RIGHT




  WinConditionItem = winConditionItemPrefix varName (t_ON varName)? lineTerminator+

  winConditionItemPrefix =
      t_NO
    | t_ALL
    | t_ANY
    | t_SOME



  LevelItem = (GameMessage | LevelMap) lineTerminator*
  LevelMap = levelMapRow+

  levelMapRow = (~lineTerminator ~t_MESSAGE any)+ lineTerminator


  // ================
  // SECTION_NAME
  // ================
  Section<Name, ItemExpr> =
    "===" headingBar lineTerminator
    Name lineTerminator
    "===" headingBar lineTerminator+
    (space* ItemExpr)*
    lineTerminator*

  // Must contain at least 1 letter. Otherwise sound effects are confused
  varName = digit* letter (letter | digit | "_")*
  headingBar = "="*
  lineTerminator = space* newline space*
  sourceCharacter = any

  newline = "\\n"
  whitespace = " " | "\\u0009" /*tab*/

  // redefine what a space is so we can ignore comments
  space := whitespace | multiLineComment

  nonVarChar = whitespace | newline | "[" | "]" | "(" | ")"

  multiLineComment = "(" textOrComment* ")"
  textOrComment =
      multiLineComment
    | (~("(" | ")") sourceCharacter)+

  integer = digit+

}
`// readFileSync('./grammar.ohm', 'utf-8')


class LevelMap {
  constructor(rows) {
    this._rows = rows
  }
  isInvalid() {
    const cols = this._rows[0].length
    let isInvalid = false
    this._rows.forEach((row, index) => {
      if (cols !== row.length) {
        isInvalid = `Row ${index+1} does not have the same column count as the first row. Expected ${cols} columns but found ${row.length}. Row contents:\n${row.join('')}`
      }
    })
    return isInvalid
  }
}

class GameMessage {
  constructor(message) {
    this._message = message
  }
  isInvalid() {
    return false
  }
}

class HexColor {
  constructor(color) {
    this._color = color
  }
}

class NamedColor {
  constructor(name) {
    this._name = name
  }
}

class GameObject {
  constructor(name, colors, pixels) {
    this._name = name
    this._colors = colors
    this._pixels = pixels // Pixel colors are 0-indexed.
  }
  isInvalid() {
    let isInvalid = false
    const colorLen = this._colors.length
    if (this._pixels.length > 0) {
      const rowLen = this._pixels[0].length
      this._pixels.forEach((row) => {
        if (row.length !== rowLen) {
          isInvalid = `Row lengths do not match. Expected ${rowLen} but got ${row.length}. Row: ${row}`
        }
        // Check that only '.' or a digit that is less than the number of colors is present
        row.forEach((pixel) => {
          if ('.' !== pixel) {
            if (pixel >= colorLen) {
              isInvalid = `Pixel number is too high (${pixel}). There are only ${colorLen} colors defined`
            }
          }
        })
      })
    }
    return isInvalid
  }
}

// TODO: Link up the aliases to objects rather than just storing strings
// TODO: Also, maybe distinguish between legend items that may be in the LevelMap (1 character) from those that point to ObjectItems
class GameLegendItem {
  constructor(name, aliases) {
    this._name = name
    this._aliases = aliases
  }
  isInvalid() {
    return true // until we map the aliases to actual Objects rather than strings to look up later
  }
}

// TODO: Use the Objects rather than just the names
class CollisionLayer {
  constructor(objectNames) {
    this._objectNames = objectNames
  }
  isInvalid() {
    return true // until we map the aliases to actual Objects rather than strings to look up later
  }
}



glob('./gists/*/script.txt', (err, files) => {
// glob('./test-game.txt', (err, files) => {

  console.log(`Looping over ${files.length} games...`);

  files.forEach((filename, index) => {

    // 8645c163ff321d2fd1bad3fcaf48c107 has a typo so we .replace()
    const code = readFileSync(filename, 'utf-8').replace('][ ->', '] ->') + '\n' // Not all games have a trailing newline. this makes it easier on the parser

    const g = ohm.grammar(grammar)
    const m = g.match(code)

    // See https://github.com/anarchistengineering/nasty-json/blob/master/lib/parser.js


    if (m.succeeded()) {
      console.log(`hooray! ${index} ${filename}`);
      const s = g.createSemantics()

      function getConfigField(key, value) {
        return [key.parse(), value.parse()]
      }

      s.addOperation('parse', {
        Details: (_whitespace1, title, _whitespace2, settings, _whitespace3, objects, legends, sounds, collisionLayers, rules, winConditions, levels) => {
          const ret = {
            title: title.parse(),
            settings: {}, // Filled in below
            objects: objects.parse(),
            legends: legends.parse(),
            sounds: sounds.parse(),
            collisionLayers: collisionLayers.parse(),
            rules: rules.parse(),
            winConditions: winConditions.parse(),
            levels: levels.parse(),
          }
          settings.parse().forEach((setting) => {
            if (Array.isArray(setting)) {
              ret.settings[setting[0]] = setting[1]
            } else {
              ret.settings[setting] = true
            }
          })
          return ret
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
        ColorPalette: getConfigField,
        RequirePlayerMovement: getConfigField,

        Section: (_threeDashes1, _headingBar1, _lineTerminator1, _sectionName, _lineTerminator2, _threeDashes2, _headingBar2, _8, _9, _10, _11) => {
          return _10.parse()
        },
        ObjectsItem: (_1, _2, _3, _4, _5, _6, _7) => {
          return new GameObject(_1.parse(), _4.parse(), _6.parse())
        },
        legendItem: function(_1, _space1, _equalSign, _space2, _5, _6) {
          return new GameLegendItem(_1.parse(), _5.parse())
        },
        SoundItem: function(_1, _2, _3) {
          debugger
          return {
            __type: 'SoundItem',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
            _3: _3 ? _3.parse() : null,
          }
        },
        SoundItemNormal: function(_1, _2) {
          debugger
          return {
            __type: 'SoundItemNormal',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
          }
        },
        SoundItemActionMove: function(_1, _2) {
          debugger
          return {
            __type: 'SoundItemActionMove',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
          }
        },
        CollisionLayerItem: (objectNames, _2, _3) => {
          return new CollisionLayer(objectNames.parse())
        },
        RuleItem: function(_1, _2) {
          debugger
          return {
            __type: 'RuleItem',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
          }
        },
        RuleItemReal: function(_1, _2, _3, _4, _5, _6) {
          debugger
          return {
            __type: 'RuleItemReal',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
            _3: _3 ? _3.parse() : null,
            _4: _4 ? _4.parse() : null,
            _5: _5 ? _5.parse() : null,
            _6: _6 ? _6.parse() : null,
          }
        },
        RuleConditionWithLeftArgs: function(_1, _2) {
          debugger
          return {
            __type: 'RuleConditionWithLeftArgs',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
          }
        },
        RuleConditionBracket: function(_1, _2, _3) {
          debugger
          return {
            __type: 'RuleConditionBracket',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
            _3: _3 ? _3.parse() : null,
          }
        },
        RuleConditionEntryFull: function(_1, _2) {
          debugger
          return {
            __type: 'RuleConditionEntryFull',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
          }
        },
        RuleCondition: function(_1, _2) {
          debugger
          return {
            __type: 'RuleCondition',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
          }
        },

        WinConditionItem: function(_1, _2, _3, _4, _5) {
          debugger
          return {
            __type: 'WinConditionItem',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
            _3: _3 ? _3.parse() : null,
            _4: _4 ? _4.parse() : null,
            _5: _5 ? _5.parse() : null,
          }
        },
        GameMessage: function(_1, _2) {
          return new GameMessage(_2.parse())
        },
        LevelItem: function(_1, _2) {
          return _1.parse()
        },
        LevelMap: function(_1) {
          return new LevelMap(_1.parse())
        },
        levelMapRow: function(_1, _2) {
          return _1.parse()
        },
        andOr: (_1, _2, _3) => {
          return {
            __type: 'andOr',
            _1: _1 ? _1.parse() : null,
            _2: _2 ? _2.parse() : null,
            _3: _3 ? _3.parse() : null,
          }
        },
        widthAndHeight: function(_1, _2, _3) {
          return {
            __type: 'widthAndHeight',
            width: _1.parse(),
            height: _3.parse(),
          }
        },
        pixelRow: function(_1, _2) {
          return _1.parse()
        },
        colorHex3: function(_1, _2, _3, _4) {
          return new HexColor(this.sourceString)
        },
        colorHex6: function(_1, _2, _3, _4, _5, _6, _7) {
          return new HexColor(this.sourceString)
        },
        colorName: function(_1) {
          return new NamedColor(this.sourceString)
        },
        NonemptyListOf: function(_1, _2, _3) {
          return [_1.parse()].concat(_3.parse())
        },
        nonemptyListOf: function(_1, _2, _3) {
          return [_1.parse()].concat(_3.parse())
        },
        integer: function(_1) {
          return Number.parseInt(this.sourceString)
        },
        decimalWithLeadingNumber: function (_1, _2, _3) {
          return Number.parseFloat(this.sourceString)
        },
        decimalWithLeadingPeriod: function (_1, _2) {
          return Number.parseFloat(this.sourceString)
        },
        varName: function(_1, _2, _3) {
          return this.sourceString;
        },
        words: function(_1) {
          return this.sourceString
        },
        _terminal: function () { return this.primitiveValue },
        lineTerminator: (v1, v2, v3) => {},
        digit: (x) => {
          return x.primitiveValue.charCodeAt(0) - '0'.charCodeAt(0)
        },
        // _default: function (exp1) {
        //   debugger
        //   return this.sourceString
        // },

      })
      const game = s(m).parse()
      console.log(game)

      // Validate that the game objects are rectangular
      game.objects.forEach((object) => {
        if (object.isInvalid()) {
          console.warn(`WARNING: ${filename} Game Object is Invalid. Reason: ${object.isInvalid()}`)
        }
      })

      // Validate that the level maps are rectangular
      game.levels.forEach((level) => {
        if (level.isInvalid()) {
          console.warn(`WARNING: ${filename} Level is Invalid. Reason: ${level.isInvalid()}`)
        }
      })

    } else {
      console.log(g.trace(code).toString())
      console.log(m.message)
      console.log(`Failed on game ${index}`)
      throw new Error(filename)
    }

  })

})
