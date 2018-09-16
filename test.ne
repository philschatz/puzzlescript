@{%

const toDebug = (name) => {
    if (process.env.NODE_ENV == 'debug') {
        return (args) => {
            return {type: name, args: args}
        }
    } else {
        return null // use the non-debug function
    }
}

const nuller = (a) => null
const debugRule = (msg) => (a) => { debugger; console.log(msg, a); return a }
const concatChars = ([a]) => a.join('')

const TILE_MODIFIERS = new Set([
    '...', // This one isn't a modifier but we do not allow it so that we match ellipsis rules in a different rule
    'AGAIN', // This is another hack. Some people write `[]->[AGAIN]` rather than `[]->[]AGAIN`
    'NO',
    'LEFT',
    'RIGHT',
    'UP',
    'DOWN',
    'RANDOMDIR',
    'RANDOM',
    'STATIONARY',
    'MOVING',
    'ACTION',
    'VERTICAL',
    'HORIZONTAL',
    'PERPENDICULAR',
    'PARALLEL',
    'ORTHOGONAL',
    '^',
    '<',
    '>',
    'V',
])

%}

# Configure the lexer:
# @lexer lexer
# @builtin "whitespace.ne"

NonemptyListOf[Child, Separator] -> $Child (_ $Separator _ $Child):*  {% ([a, b]) => { return a.concat(b.map(([whitespace1, separator, whitespace2, child]) => child)) } %}
AtLeast2ListOf[Child, Separator] -> $Child (_ $Separator _ $Child):+  {% ([a, b]) => { return a.concat(b.map(([whitespace1, separator, whitespace2, child]) => child)) } %}
atLeast2ListOf[Child, Separator] -> $Child ($Separator $Child):+      {% ([a, b]) => { return a.concat(b.map(([separator, child]) => child)) } %}
nonemptyListOf[Child, Separator] -> $Child ($Separator $Child):*      {% ([a, b]) => { return a.concat(b.map(([separator, child]) => child)) } %}

ListOf[Child, Separator] -> NonemptyListOf[$Child, $Separator]:?
listOf[Child, Separator] -> nonemptyListOf[$Child, $Separator]:?

# ================
# SECTION_NAME
# ================
Section[Name, ItemExpr] ->
    _ "=":+ lineTerminator
    _ $Name lineTerminator
    _ "=":+ lineTerminator:+
    ($ItemExpr):*         # {% ([_0, _1, _2, name, _3, _4, _5, items]) => { return { type: 'SECTION', name: name[0][0], items: items } } %}

# Levels start with multiple linebreaks to handle end-of-file case when we don't have 2 linefeeds
# So we need to remove linefeeds from the section to remove ambiguity
SectionSingleTerminator[Name, ItemExpr] ->
    _ "=":+ lineTerminator
    _ $Name lineTerminator
    _ "=":+ lineTerminator
    ($ItemExpr):*         # {% ([_0, _1, _2, name, _4, _5, _6, items]) => { return { type: 'SECTION', name: name[0][0], items: items } } %}


main ->
    lineTerminator:* # Version information
    _ Title lineTerminator:+
    (_ OptionalMetaData lineTerminator:+):*
    Section[t_OBJECTS, Sprite]:?
    Section[t_LEGEND, LegendTile]:?
    Section[t_SOUNDS, SoundItem]:?
    Section[t_COLLISIONLAYERS, CollisionLayerItem]:?
    Section[t_RULES, RuleItem]:?
    Section[t_WINCONDITIONS, WinConditionItem]:?
    SectionSingleTerminator[t_LEVELS, LevelItem]:?


_ -> ( whitespaceChar | multiLineComment ):* {% nuller %}
__ -> ( whitespaceChar | multiLineComment ):+ {% nuller %}

multiLineComment -> "(" textOrComment:* ")" {% nuller %}
textOrComment ->
      multiLineComment
    | [^\(\)]


whitespaceChar -> " " | "\t" # tab
newline -> "\n"
digit -> [0-9]          {% id %}
hexDigit -> [0-9a-fA-F] {% id %}
letter -> [^\n \(\)]    {% id %}

integer -> digit:+      {% concatChars %}
word -> [^\n \(]:+      {% toDebug('WORD') || concatChars %}

words -> NonemptyListOf[word, whitespaceChar:+] {% toDebug('WORDS') || function ([a]) { return {type: 'WORDS', words: a} } %}

lineTerminator -> _ newline {% ([a, _2]) => { return {type: 'LINE_TERMINATOR', space: a} } %}
sourceCharacter -> [^\n ]

nonVarChar -> whitespaceChar | newline | "[" | "]" | "(" | ")" | "|" | "."



# words -> word:+
decimal ->
    decimalWithLeadingNumber
    | decimalWithLeadingPeriod
decimalWithLeadingNumber -> digit:+ ("." digit:+):?
decimalWithLeadingPeriod -> "." digit:+

# colorTransparent -> t_TRANSPARENT
colorHex6 -> "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit  {% (a) => { return {type:'HEX6', value: a.join('')} } %}
colorHex3 -> "#" hexDigit hexDigit hexDigit                             {% (a) => { return {type:'HEX3', value: a.join('')} } %}
colorNameOrHex ->
      # colorTransparent
      colorHex6
    | colorHex3
    | colorName
# Exclude `#` to ensure it does not conflict with the hex colors
# Exclude 0-9 because those are pixel colors
colorName -> [^\n #\(0-9\.] word {% (a) => { return {type:'COLOR_NAME', value: a}} %}


# ----------------
# Variable Names
# ----------------

# There are 2 classes of restrictions on variable names:
# - in a Level. object shortcut characters, legend items : These cannot contain the character "="
# - in Rules. object names, rule references, some legend items : These cannot contain characters like brackets and pipes because they can occur inside a Rule

legendVariableChar -> [^\n\ \=] # -> (~__ ~newline ~"=" %any)
# Disallow:
# __ [ ] | t_ELLIPSIS   because it can occur inside a Rule
# "=" because it can occur inside a legend Variable
ruleVariableChar -> [^(?=\.\.\.)\n \=\[\]\|] # -> (~__ ~newline ~"=" ~"[" ~"]" ~"|" ~t_ELLIPSIS %any)

ruleVariableName -> ruleVariableChar:+  {% concatChars %} # -> %ruleVariableChar:+
lookupRuleVariableName -> [^\n \=\[\]\|]:+ {% ([a], offset, reject) => {
  const str = a.join('')
  if (TILE_MODIFIERS.has(str.toUpperCase())) {
    return reject
  } else {
    return str
  }
} %} # -> ~t_AGAIN ruleVariableName # added t_AGAIN to parse '... -] [ tilename AGAIN ]' (it should be a command)

# Disallow:
# __ [ ] | t_ELLIPSIS   because it can occur inside a Rule
# "," because it can occur inside a CollisionLayer
# "=" because it can occur inside a legend Variable
collisionVariableChar -> [^(?=\.\.\.)\ \n\=\[\]\|\,] # -> (~__ ~newline ~"=" ~"[" ~"]" ~"|" ~"," ~t_ELLIPSIS %any)
collisionVariableName -> collisionVariableChar:+ {% concatChars %}
lookupCollisionVariableName -> collisionVariableName


# special flag that can appear before rules so the debugger pauses before the rule is evaluated
t_DEBUGGER
    -> t_DEBUGGER_ADD
    | t_DEBUGGER_REMOVE
    | t_DEBUGGER_DEFAULT
t_DEBUGGER_DEFAULT -> "DEBUGGER"i
t_DEBUGGER_ADD -> "DEBUGGER_ADD"i
t_DEBUGGER_REMOVE -> "DEBUGGER_REMOVE"i


# Section titles
t_OBJECTS -> "OBJECTS"i
t_LEGEND -> "LEGEND"i
t_SOUNDS -> "SOUNDS"i
t_COLLISIONLAYERS -> "COLLISIONLAYERS"i
t_RULES -> "RULES"i
t_WINCONDITIONS -> "WINCONDITIONS"i
t_LEVELS -> "LEVELS"i

# Modifier tokens
t_RIGID -> "RIGID"i
t_LATE -> "LATE"i
t_RANDOM -> "RANDOM"i
t_RANDOMDIR -> "RANDOMDIR"i
t_ACTION -> "ACTION"i
t_STARTLOOP -> "STARTLOOP"i
t_ENDLOOP -> "ENDLOOP"i

# Movement tokens
t_UP -> "UP"i
t_DOWN -> "DOWN"i
t_LEFT -> "LEFT"i
t_RIGHT -> "RIGHT"i
t_ARROW_UP -> "^"
t_ARROW_DOWN -> "V"i
t_ARROW_LEFT -> "<"
t_ARROW_RIGHT -> ">"
t_MOVING -> "MOVING"i
t_ORTHOGONAL -> "ORTHOGONAL"i
t_PERPENDICULAR -> "PERPENDICULAR"i
t_PARALLEL -> "PARALLEL"i
t_STATIONARY -> "STATIONARY"i
t_HORIZONTAL -> "HORIZONTAL"i
t_VERTICAL -> "VERTICAL"i

t_ARROW_ANY
    -> t_ARROW_UP
    | t_ARROW_DOWN # Because of this, "v" can never be an Object or Legend variable. TODO: Ensure "v" is never an Object or Legend variable
    | t_ARROW_LEFT
    | t_ARROW_RIGHT

# Command tokens
t_AGAIN -> "AGAIN"i
t_CANCEL -> "CANCEL"i
t_CHECKPOINT -> "CHECKPOINT"i
t_RESTART -> "RESTART"i
t_UNDO -> "UNDO"i
t_WIN -> "WIN"i
t_MESSAGE -> "MESSAGE"i

t_ELLIPSIS -> "..."

# LEGEND tokens
t_AND -> "AND"i
t_OR -> "OR"i

# SOUND tokens
t_SFX0 -> "SFX0"i
t_SFX1 -> "SFX1"i
t_SFX2 -> "SFX2"i
t_SFX3 -> "SFX3"i
t_SFX4 -> "SFX4"i
t_SFX5 -> "SFX5"i
t_SFX6 -> "SFX6"i
t_SFX7 -> "SFX7"i
t_SFX8 -> "SFX8"i
t_SFX9 -> "SFX9"i
t_SFX10 -> "SFX10"i
t_SFX ->
      t_SFX10 # needs to go 1st because of t_SFX1
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

# METADATA Tokens
t_TITLE -> "TITLE"i
t_AUTHOR -> "AUTHOR"i
t_HOMEPAGE -> "HOMEPAGE"i
t_YOUTUBE -> "YOUTUBE"i
t_ZOOMSCREEN -> "ZOOMSCREEN"i
t_FLICKSCREEN -> "FLICKSCREEN"i
t_REQUIRE_PLAYER_MOVEMENT -> "REQUIRE_PLAYER_MOVEMENT"i
t_RUN_RULES_ON_LEVEL_START -> "RUN_RULES_ON_LEVEL_START"i
t_COLOR_PALETTE -> "COLOR_PALETTE"i
t_BACKGROUND_COLOR -> "BACKGROUND_COLOR"i
t_TEXT_COLOR -> "TEXT_COLOR"i
t_REALTIME_INTERVAL -> "REALTIME_INTERVAL"i
t_KEY_REPEAT_INTERVAL -> "KEY_REPEAT_INTERVAL"i
t_AGAIN_INTERVAL -> "AGAIN_INTERVAL"i

# These settings do not have a value so they need to be parsed slightly differently
t_NOACTION -> "NOACTION"i
t_NOUNDO -> "NOUNDO"i
t_NORESTART -> "NORESTART"i
t_THROTTLE_MOVEMENT -> "THROTTLE_MOVEMENT"i
t_NOREPEAT_ACTION -> "NOREPEAT_ACTION"i
t_VERBOSE_LOGGING -> "VERBOSE_LOGGING"i


t_TRANSPARENT -> "TRANSPARENT"i

t_MOVE -> "MOVE"i
t_DESTROY -> "DESTROY"i
t_CREATE -> "CREATE"i
t_CANTMOVE -> "CANTMOVE"i

t_TITLESCREEN -> "TITLESCREEN"i
t_STARTGAME -> "STARTGAME"i
t_STARTLEVEL -> "STARTLEVEL"i
t_ENDLEVEL -> "ENDLEVEL"i
t_ENDGAME -> "ENDGAME"i
t_SHOWMESSAGE -> "SHOWMESSAGE"i
t_CLOSEMESSAGE -> "CLOSEMESSAGE"i

t_GROUP_RULE_PLUS -> "+"

# WINCONDITIONS tokens
t_ON -> "ON"i
t_NO -> "NO"i
t_ALL -> "ALL"i
t_ANY -> "ANY"i
t_SOME -> "SOME"i


OptionalMetaData
    -> Author
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

Title -> t_TITLE __ words       {% ([_1, _2, words]) => { return {type:'TITLE', value: words} } %}
Author -> t_AUTHOR __ words     {% ([_1, _2, words]) => { return {type:'AUTHOR', value: words} } %}
Homepage -> t_HOMEPAGE __ words {% ([_1, _2, words]) => { return {type:'HOMEPAGE', value: words} } %}
Youtube -> t_YOUTUBE __ words
Zoomscreen -> t_ZOOMSCREEN __ widthAndHeight
Flickscreen -> t_FLICKSCREEN __ widthAndHeight
RequirePlayerMovement -> t_REQUIRE_PLAYER_MOVEMENT (__ "off"):?
RunRulesOnLevelStart -> t_RUN_RULES_ON_LEVEL_START (__ "true"):?
ColorPalette -> t_COLOR_PALETTE __ words
BackgroundColor -> t_BACKGROUND_COLOR __ colorNameOrHex
TextColor -> t_TEXT_COLOR __ colorNameOrHex
RealtimeInterval -> t_REALTIME_INTERVAL __ decimal
KeyRepeatInterval -> t_KEY_REPEAT_INTERVAL __ decimal
AgainInterval -> t_AGAIN_INTERVAL __ decimal

widthAndHeight -> integer "x" integer


Sprite ->
      SpritePixels
    | SpriteNoPixels

SpriteNoPixels ->
    _ spriteName (__ legendShortcutChar):? lineTerminator:+ # Some sprites have their colors commented out so we need more than one newline
    _ colorDefinitions lineTerminator:+ {% ([name, shortcut, _2, _3, colors, _5]) => { return {type: 'SPRITE_NO_PIXELS', name: name, colors: colors} } %}

SpritePixels ->
    _ spriteName (__ legendShortcutChar):? lineTerminator:+ # Some sprites have their colors commented out so we need more than one newline
    _ colorDefinitions lineTerminator:+
    PixelRows
    lineTerminator:*                                      {% ([name, shortcut, _2, _3, colors, _5, pixels, _7]) => { return {type: 'SPRITE_WITH_PIXELS', name: name, shortcutAndSpace: shortcut, colors: colors, pixels: pixels} } %}

colorDefinitions ->
      nonemptyListOf[colorNameOrHex, __]
    | nonemptyListOf[colorHex6, __] nonemptyListOf[colorHex6, __] # Some games jsut have `#123456#789abc #def012` (no space before the next hex number)


spriteName -> ruleVariableName
pixelRow -> _ pixelDigit:+ lineTerminator
pixelDigit -> digit | "."
legendShortcutChar -> [^\n ] # -> (~lineTerminator %any)

# Support at least 5x5 sprites (so we can disambiguate from single-color definitions)
PixelRows -> pixelRow pixelRow pixelRow pixelRow pixelRow:+


LegendTile ->
      LegendTileSimple
    | LegendTileAnd
    | LegendTileOr

LegendTileSimple -> _ LegendVarNameDefn _ "=" _ LookupLegendVarName lineTerminator:+                        {% ([legendName, _1, _2, _3, varName, _4]) => { return { type: 'LEGEND_ITEM_SIMPLE', varName: varName} } %}
# Ensure there are spaces around AND or OR so we do not accidentally match CleANDishes
LegendTileAnd ->    _ LegendVarNameDefn _ "=" _ atLeast2ListOf[LookupLegendVarName, __ t_AND __] lineTerminator:+
LegendTileOr ->     _ LegendVarNameDefn _ "=" _ atLeast2ListOf[LookupLegendVarName, __ t_OR __] lineTerminator:+

LegendVarNameDefn -> word
    # # If it is multiple characters then it needs to be a valid ruleVariableName. If it is one character then it needs to be a valid legendVariableChar
    #   (ruleVariableChar ruleVariableName) {% debugRule('aksjhdakjshdasd') %}
    # | legendVariableChar                  {% debugRule('OIUOIUOIU') %}

LookupLegendVarName -> LegendVarNameDefn


# TODO: Handle tokens like sfx0 and explicit args instead of just varName (like "Player CantMove up")
# all of them are at https:#www.puzzlescript.net/Documentation/sounds.html
SoundItem -> _ SoundItemInner lineTerminator:+

SoundItemInner
    -> SoundItemEnum
    | SoundItemSfx
    | SoundItemMoveDirection
    | SoundItemMoveSimple
    | SoundItemNormal

soundItemSimpleOptions
    -> t_RESTART
    | t_UNDO
    | t_TITLESCREEN
    | t_STARTGAME
    | t_STARTLEVEL
    | t_ENDLEVEL
    | t_ENDGAME
    | t_SHOWMESSAGE
    | t_CLOSEMESSAGE

SoundItemEnum -> soundItemSimpleOptions __ integer
SoundItemSfx -> t_SFX __ integer
SoundItemMoveDirection -> lookupRuleVariableName __ t_MOVE __ soundItemActionMoveArg __ integer
SoundItemMoveSimple -> lookupRuleVariableName __ t_MOVE __ integer
SoundItemNormal -> lookupRuleVariableName __ SoundItemAction __ integer

SoundItemAction
    -> t_CREATE
    | t_DESTROY
    | t_CANTMOVE

soundItemActionMoveArg
    -> t_UP
    | t_DOWN
    | t_LEFT
    | t_RIGHT
    | t_HORIZONTAL
    | t_VERTICAL


CollisionLayerItem -> _ nonemptyListOf[lookupCollisionVariableName, (_ "," _ | __)] ",":? lineTerminator:+


RuleItem ->
      RuleLoop
    | RuleGroup # Do this before Rule because we need to look for a "+" on the following Rule
    | Rule

Rule ->
      RuleWithoutMessage
    | RuleWithMessage

RuleWithoutMessage -> _ nonemptyListOf[LeftModifiers RuleBracket, _] _ "->" ((_ RuleModifier):? _ RuleBracket):* (_ RuleCommand):* lineTerminator:+
RuleWithMessage ->   _ nonemptyListOf[LeftModifiers RuleBracket, _] _ "->" ((_ RuleModifier):? _ RuleBracket):* (_ RuleCommand):* _ MessageCommand lineTerminator:*

LeftModifiers ->
      nonemptyListOf[RuleModifierLeft, __] _
    | null

RuleBracket ->
      EllipsisRuleBracket
    | NormalRuleBracket

NormalRuleBracket -> "[" nonemptyListOf[RuleBracketNeighbor, "|"] (t_AGAIN _):? "]" (_ t_DEBUGGER):? # t_AGAIN is a HACK. It should be in the list of commands but it's not.
EllipsisRuleBracket -> "[" nonemptyListOf[RuleBracketNeighbor, "|"] "|" _ t_ELLIPSIS _ "|" nonemptyListOf[RuleBracketNeighbor, "|"] "]" (_ t_DEBUGGER):?

RuleBracketNeighbor ->
    #   HackTileNameIsSFX1 # to parse '... -] [ SFX1 ]' (they should be commands)
    # | HackTileNameIsSFX2 # to parse '... -] [ tilename SFX1 ]'
    # | RuleBracketNoEllipsisNeighbor
      RuleBracketNoEllipsisNeighbor
    | RuleBracketEmptyNeighbor

RuleBracketNoEllipsisNeighbor ->
      _ nonemptyListOf[TileWithModifierMaybe ,__] (_ t_DEBUGGER):? _

RuleBracketEmptyNeighbor -> _ # Matches `[]` as well as `[ ]`

TileWithModifierMaybe ->
      TileWithModifier
    | TileWithoutModifier
# Force-check that there is whitespace after the cellLayerModifier so things
# like "STATIONARYZ" or "NOZ" are not parsed as a modifier
# (they are a variable that happens to begin with the same text as a modifier)
TileWithModifier -> tileModifier __ lookupRuleVariableName  {% ([modifier, _2, varName]) => { return {type: 'TILE_WITH_MODIFIER', modifier: modifier, varName: varName} } %}
TileWithoutModifier -> lookupRuleVariableName               {% ([varName]) => { return {type: 'TILE_WITHOUT_MODIFIER', varName: varName} } %}

# tileModifier -> tileModifierInner {% debugRule('TILEMODIFIER') %}

tileModifier ->
      t_NO
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
    | t_PARALLEL
    | t_ORTHOGONAL
    # This can be a "v" so it needs to go at the end (behind t_VERTICAL)
    | t_ARROW_ANY

RuleModifier ->
      t_RANDOM
    | t_UP
    | t_DOWN
    | t_LEFT
    | t_RIGHT
    | t_VERTICAL
    | t_HORIZONTAL
    | t_ORTHOGONAL

RuleModifierLeft ->
      RuleModifier # Sometimes people write "RIGHT LATE [..." instead of "LATE RIGHT [..."
    | t_LATE
    | t_RIGID

RuleCommand ->
      t_AGAIN
    | t_CANCEL      {% () => { return {type: 'RULE_COMMAND_CANCEL'} } %}
    | t_CHECKPOINT
    | t_RESTART
    | t_WIN
    | t_SFX         {% ([a]) => { return {type: 'RULE_COMMAND_SFX', value: a[0][0]} } %}

MessageCommand -> t_MESSAGE messageLine {% ([_1, _2, message]) => { return {type:'MESSAGE_COMAMND_WORDS', message} } %}

RuleLoop ->
    _
    t_DEBUGGER:?
    t_STARTLOOP lineTerminator:+
    (RuleItem):+
    t_ENDLOOP lineTerminator:+

RuleGroup ->
    Rule
    (_ t_GROUP_RULE_PLUS Rule):+ {% ([_1, isRandom, firstRule, otherRules]) => { return {type:'RULE_GROUP', firstRule: firstRule, otherRules: otherRules} } %}

HackTileNameIsSFX1 -> t_SFX __ t_DEBUGGER:?
HackTileNameIsSFX2 -> lookupRuleVariableName __ t_SFX __ t_DEBUGGER:?


WinConditionItem
    -> WinConditionItemSimple
    | WinConditionItemOn

WinConditionItemSimple -> _ winConditionItemPrefix __ lookupRuleVariableName lineTerminator:+
WinConditionItemOn -> _ winConditionItemPrefix __ lookupRuleVariableName __ t_ON __ lookupRuleVariableName lineTerminator:+

winConditionItemPrefix
    -> t_NO
    | t_ALL
    | t_ANY
    | t_SOME


LevelItem ->
      GameMessageLevel
    | levelMapRow
    | SeparatorLine


# Ensure we collect characters up to the last non-whitespace
GameMessageLevel -> _ t_MESSAGE messageLine {% ([_0, messageWords]) => { return {type: 'LEVEL_MESSAGE', messageWords } } %}
messageLine -> [^\n]:* [\n]
levelMapRow -> _ [^\n \t\(]:+ lineTerminator {% ([_0, cols], offset, reject) => {
  const str = cols.join('')
  if (str.toUpperCase().startsWith('MESSAGE')) {
    return reject
  } else {
    return {type: 'LEVEL_ROW', rowData: cols.map(([char]) => char[0])}
  }
}
%}

SeparatorLine -> lineTerminator {% () => { return {type:'LEVEL_SEPARATOR'} } %}
