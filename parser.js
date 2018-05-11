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
    | ColorPalette
    | BackgroundColor
    | TextColor
    | RealtimeInterval
    | KeyRepeatInterval
    | AgainInterval
    | t_NOACTION
    | t_NOUNDO
    | t_RUN_RULES_ON_LEVEL_START
    | t_NOREPEAT_ACTION
    | t_THROTTLE_MOVEMENT
    | t_NORESTART
    | t_VERBOSE_LOGGING

  Title = "title" words
  Author = "author" words
  Homepage = "homepage" words
  Youtube = "youtube" words
  Zoomscreen = "zoomscreen" digit+ "x" digit+
  Flickscreen = "flickscreen" digit+ "x" digit+
  RequirePlayerMovement = t_REQUIRE_PLAYER_MOVEMENT "off"?
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


  words = (~lineTerminator any)+
  decimal =
      decimalWithLeadingNumber
    | decimalWithLeadingPeriod
  decimalWithLeadingNumber = digit+ ("." digit+)?
  decimalWithLeadingPeriod = "." digit+



  ObjectsItem =
  	objectName legendShortcutChar? lineTerminator
    nonemptyListOf<colorNameOrHex, spaces> lineTerminator+
    (pixelRow+)?
    lineTerminator*

  objectName = varName
  colorTransparent = "transparent"
  colorHex6 = "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit
  colorHex3 = "#" hexDigit hexDigit hexDigit
  colorNameOrHex = colorTransparent | colorHex6 | colorHex3 | letter+
  pixelRow = pixelDigit+ lineTerminator
  pixelDigit = (digit | ".")+
  legendShortcutChar = (~lineTerminator any)





  legendItem = legendVarName spaces "=" spaces nonemptyListOf<legendVarName, andOr> lineTerminator+ // TODO: Remove the 'spaces' in favor of an upper-case non-lexer rule
  andOr = spaces (t_AND | t_OR) spaces
  legendChar = any // a single character that is allowed to be in a puzzle level
  legendVarName = varName | legendChar




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

  RuleItemReal = t_GROUP_RULE_PLUS? t_RIGID? RuleConditionWithLeftArgs+ "->" RuleCondition* ruleCommand*

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

  ruleCommand =
      ruleCommandMessage
    | t_AGAIN
    | t_CANCEL
    | t_CHECKPOINT
    | t_RESTART
    | t_WIN
    | t_SFX

  ruleCommandMessage = t_MESSAGE (" " (~lineTerminator any)+)? // Some games just have a blank message

  RuleCondition = ruleDirection2* RuleConditionBracket

  RuleConditionWithLeftArgs = (ruleDirection2 | t_LATE | t_RANDOM)* RuleConditionBracket // because of Bubble Butler... it has "right late [..."

  RuleConditionBracket = "[" ListOf<RuleConditionEntry?, "|"> "]"

  RuleConditionEntry =
      RuleConditionEntryFull
    | RuleConditionBracket
    | t_ELLIPSIS

  RuleConditionEntryFull = (ruleDirection3? varName)+

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



  LevelItem =
      levelMessage
    | LevelMap

  levelMessage = t_MESSAGE restOfLine lineTerminator*
  LevelMap = levelMapRow+ lineTerminator*

  levelMapRow = (~lineTerminator any)+ lineTerminator


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
  restOfLine = (~lineTerminator sourceCharacter)* lineTerminator
  lineTerminator = space* "\\n" space*
  sourceCharacter = any

  // redefine what a space is so we can ignore comments
  space := " " | "\\u0009" /*tab*/ | multiLineComment

  multiLineComment = "(" textOrComment+ ")"
  textOrComment =
      multiLineComment
    | (~("(" | ")") sourceCharacter)+

  integer = digit+

}
`// readFileSync('./grammar.ohm', 'utf-8')




glob('./gists/*/script.txt', (err, files) => {
// glob('./test-game.txt', (err, files) => {

  console.log(`Looping over ${files.length} games...`);

  files.forEach((filename, index) => {

    // 8645c163ff321d2fd1bad3fcaf48c107 has a typo so we .replace()
    const code = readFileSync(filename, 'utf-8').replace('][ ->', '] ->') + '\n' // Not all games have a trailing newline. this makes it easier on the parser

    const g = ohm.grammar(grammar)
    const m = g.match(code)

    if (m.succeeded()) {
      debugger
      console.log(`hooray! ${index}`);
    } else {
      console.log(g.trace(code).toString())
      console.log(m.message)
      console.log(`Failed on game ${index}`)
      throw new Error(filename)
    }

  })

})
