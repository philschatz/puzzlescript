const ohm = require('ohm-js')
const {readFileSync} = require('fs')

const grammar = `
Puzzlescript {
  Details =
  	Title
    Author?
    Homepage?
    ColorPalette?
    RealtimeInterval?
    Noaction?
    lineTerminator*
    Section<t_OBJECTS, ObjectsItem>
    Section<t_LEGEND, legendItem>
    Section<t_SOUNDS, SoundItem>
    Section<t_COLLISIONLAYERS, CollisionLayerItem>
    Section<t_RULES, RuleItem>
    Section<t_WINCONDITIONS, WinConditionItem>

  Title = "title " restOfLine
  Author = "author " restOfLine
  Homepage = "homepage " restOfLine
  ColorPalette = "color_palette " restOfLine
  RealtimeInterval = "realtime_interval " restOfLine
  Noaction = "noaction" lineTerminator




  ObjectsItem =
  	objectName lineTerminator
    nonemptyListOf<colorNameOrHex, " "> lineTerminator
    (pixelRow+)?
    lineTerminator+

  objectName = (~lineTerminator (letter|digit))+
  colorTransparent = "transparent"
  colorHex = "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit
  colorNameOrHex = colorTransparent | colorHex | letter+
  pixelRow = pixelDigit+ lineTerminator
  pixelDigit = (digit | ".")+





  legendItem = legendVarName " = " nonemptyListOf<varName, andOr> lineTerminator+
  andOr = " and " | " or "
  legendChar = any // a single character that is allowed to be in a puzzle level
  legendVarName = varName | legendChar




  // TODO: Handle tokens like sfx0 and explicit args instead of just varName (like "Player CantMove up")
  // all of them are at https://www.puzzlescript.net/Documentation/sounds.html
  SoundItem = varName+ integer lineTerminator+




  CollisionLayerItem = NonemptyListOf<varName, ","> lineTerminator+




  RuleItem = t_RIGID_PLUS? rulePrefix? RuleCondition+ "->" RuleCondition* ruleCommand* lineTerminator+

  // Section titles
  t_OBJECTS = caseInsensitive<"OBJECTS">
  t_LEGEND = caseInsensitive<"LEGEND">
  t_SOUNDS = caseInsensitive<"SOUNDS">
  t_COLLISIONLAYERS = caseInsensitive<"COLLISIONLAYERS">
  t_RULES = caseInsensitive<"RULES">
  t_WINCONDITIONS = caseInsensitive<"WINCONDITIONS">

  t_RIGID_PLUS = "+"
  t_LATE = caseInsensitive<"LATE">
  t_RANDOM = caseInsensitive<"RANDOM">

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
      t_SFX0
    | t_SFX1
    | t_SFX2
    | t_SFX3
    | t_SFX4
    | t_SFX5
    | t_SFX6
    | t_SFX7
    | t_SFX8
    | t_SFX9
    | t_SFX10

  rulePrefix =
      t_LATE
    | t_RANDOM
    | t_UP
    | t_DOWN
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

  ruleCommandMessage = t_MESSAGE " " (~lineTerminator any)+

  RuleCondition = "[" ListOf<RuleConditionEntry?, "|"> "]"

  RuleConditionEntry = ruleDirection? varName+


  ruleDirection =
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




  WinConditionItem = winConditionItemPrefix varName (t_ON varName)?

  winConditionItemPrefix =
      t_NO
    | t_ALL
    | t_ANY
    | t_SOME



  // ================
  // SECTION_NAME
  // ================
  Section<Name, ItemExpr> =
    headingBar lineTerminator
    Name lineTerminator
    headingBar lineTerminator
    lineTerminator*
    ItemExpr+
    lineTerminator*

  varName = letter (letter | digit | "_")*
  headingBar = "="+
  restOfLine = (~lineTerminator sourceCharacter)* lineTerminator
  lineTerminator = space* "\\n"
  sourceCharacter = any

  // redefine what a space is so we can ignore comments
  space := " " | multiLineComment

  multiLineComment = "(" textOrComment+ ")"
  textOrComment =
      multiLineComment
    | (~("(" | ")") sourceCharacter)+

  integer = digit+

}
`// readFileSync('./grammar.ohm', 'utf-8')





const code = readFileSync('./test-game.txt', 'utf-8')

const g = ohm.grammar(grammar)
const m = g.match(code)

if (m.succeeded()) {
  debugger
  console.log('hooray!');
} else {
  console.log(g.trace(code).toString())
  console.log(m.message)
}
