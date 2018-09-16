@{%

const debugBlackList = new Set([])
const debugWhiteList = new Set(['word', '', 'Section'])

const toDebug = (name, fn) => {
    if (process.env.NODE_ENV == 'debug' || debugWhiteList.has(name)) {
        // Skip debug mode for any items on the blacklist
        if (debugBlackList.has(name)) {
            return null
        }
        // return either the custom function provided, or the default one for debugging
        return fn || function (args) {
            return {type: name, args: args}
        }
    } else {
        return null // use the non-debug function
    }
}

const nuller = (a) => null
const debugRule = (msg) => (a) => { debugger; console.log(msg, a); return a }
const concatChars = ([a]) => a.join('')
const extractFirst = (ary) => ary.map(subArray => {
    if (subArray.length !== 1) {
        throw new Error(`BUG: Expected items to only have one element (usually used in listOf[...])`)
    } else {
        return subArray[0]
    }
})
const extractSecond = (ary) => ary.map(subArray => {
    if (subArray.length < 2) {
        throw new Error(`BUG: Expected items to have at least 2 elements (usually used in listOf[...])`)
    } else {
        return subArray[1]
    }
})
const extractThird = (ary) => ary.map(subArray => {
    if (subArray.length < 3) {
        throw new Error(`BUG: Expected items to have at least 3 elements (usually used in listOf[...])`)
    } else {
        return subArray[2]
    }
})

const TILE_MODIFIERS = new Set([
    '...', // This one isn't a modifier but we do not allow it so that we match ellipsis rules in a different rule
    'AGAIN', // This is another hack. Some people write `[]->[AGAIN]` rather than `[]->[]AGAIN`
    'DEBUGGER', // Another hack. Ensure that this is not accidentally used as a tile name
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

NonemptyListOf[Child, Separator] -> $Child (_ $Separator _ $Child):*  {% toDebug('NonemptyListOf') || function ([first, rest]) { return [first].concat(rest.map(([whitespace1, separator, whitespace2, child]) => child)) } %}
AtLeast2ListOf[Child, Separator] -> $Child (_ $Separator _ $Child):+  {% toDebug('AtLeast2ListOf') || function ([first, rest]) { return [first].concat(rest.map(([whitespace1, separator, whitespace2, child]) => child)) } %}
atLeast2ListOf[Child, Separator] -> $Child ($Separator $Child):+      {% toDebug('atLeast2ListOf') || function ([first, rest]) { return [first].concat(rest.map(([separator, child]) => child ) ) } %}
nonemptyListOf[Child, Separator] -> $Child ($Separator $Child):*      {% toDebug('nonemptyListOf') || function ([first, rest]) { return [first].concat(rest.map(([separator, child]) => child ) ) } %}

ListOf[Child, Separator] -> NonemptyListOf[$Child, $Separator]:?
listOf[Child, Separator] -> nonemptyListOf[$Child, $Separator]:?

# ================
# SECTION_NAME
# ================
Section[Name, ItemExpr] ->
    _ "=":+ lineTerminator
    _ $Name lineTerminator
    _ "=":+ lineTerminator:+
    ($ItemExpr):*           {% toDebug('Section', function ([_0, _1, _2, _3, name, _5, _6, _7, _8, items]) { return {type: 'SECTION', name: name, items: extractFirst(extractFirst(items)) } }) %}

# Levels start with multiple linebreaks to handle end-of-file case when we don't have 2 linefeeds
# So we need to remove linefeeds from the section to remove ambiguity
SectionSingleTerminator[Name, ItemExpr] ->
    _ "=":+ lineTerminator
    _ $Name lineTerminator
    _ "=":+ lineTerminator
    ($ItemExpr):*           {% toDebug('Section', function ([_0, _1, _2, _3, name, _5, _6, _7, _8, items]) { return {type: 'SECTION', name: name, items: extractFirst(extractFirst(items)) } }) %}


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


_ -> ( whitespaceChar | multiLineComment ):* {% toDebug('whitespace') || nuller %}
__ -> ( whitespaceChar | multiLineComment ):+ {% toDebug('whitespace') || nuller %}

multiLineComment -> "(" textOrComment:* ")" {% toDebug('multiLineComment') || nuller %}
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

words -> nonemptyListOf[word, whitespaceChar:+] {% toDebug('WORDS') || function ([a]) { return extractFirst(a).join(' ') } %}

lineTerminator -> _ newline {% toDebug('lineTerminator') || nuller %}
sourceCharacter -> [^\n ]

nonVarChar -> whitespaceChar | newline | "[" | "]" | "(" | ")" | "|" | "."



decimal ->
    decimalWithLeadingNumber
    | decimalWithLeadingPeriod
decimalWithLeadingNumber -> digit:+ ("." digit:+):?
decimalWithLeadingPeriod -> "." digit:+

colorHex6 -> "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit  {% (a) => { return {type:'HEX6', value: a.join('')} } %}
colorHex3 -> "#" hexDigit hexDigit hexDigit                             {% (a) => { return {type:'HEX3', value: a.join('')} } %}
colorNameOrHex ->
      colorHex6 {% id %}
    | colorHex3 {% id %}
    | colorName {% id %}
# Exclude `#` to ensure it does not conflict with the hex colors
# Exclude 0-9 because those are pixel colors
colorName -> [^\n #\(0-9\.] word {% toDebug('COLOR_NAME') || function ([first, rest]) { return {type:'COLOR_NAME', value: [first].concat(rest).join('')} } %}


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
lookupCollisionVariableName -> collisionVariableName {% id %}


# special flag that can appear before rules so the debugger pauses before the rule is evaluated
t_DEBUGGER ->
      t_DEBUGGER_ADD {% id %}
    | t_DEBUGGER_REMOVE {% id %}
    | t_DEBUGGER_DEFAULT {% id %}
t_DEBUGGER_DEFAULT -> "DEBUGGER"i {% id %}
t_DEBUGGER_ADD -> "DEBUGGER_ADD"i {% id %}
t_DEBUGGER_REMOVE -> "DEBUGGER_REMOVE"i {% id %}


# Section titles
t_OBJECTS -> "OBJECTS"i {% id %}
t_LEGEND -> "LEGEND"i {% id %}
t_SOUNDS -> "SOUNDS"i {% id %}
t_COLLISIONLAYERS -> "COLLISIONLAYERS"i {% id %}
t_RULES -> "RULES"i {% id %}
t_WINCONDITIONS -> "WINCONDITIONS"i {% id %}
t_LEVELS -> "LEVELS"i {% id %}

# Modifier tokens
t_RIGID -> "RIGID"i {% id %}
t_LATE -> "LATE"i {% id %}
t_RANDOM -> "RANDOM"i {% id %}
t_RANDOMDIR -> "RANDOMDIR"i {% id %}
t_ACTION -> "ACTION"i {% id %}
t_STARTLOOP -> "STARTLOOP"i {% id %}
t_ENDLOOP -> "ENDLOOP"i {% id %}

# Movement tokens
t_UP -> "UP"i {% id %}
t_DOWN -> "DOWN"i {% id %}
t_LEFT -> "LEFT"i {% id %}
t_RIGHT -> "RIGHT"i {% id %}
t_ARROW_UP -> "^"i {% id %}
t_ARROW_DOWN -> "V"i {% id %}
t_ARROW_LEFT -> "<"i {% id %}
t_ARROW_RIGHT -> ">"i {% id %}
t_MOVING -> "MOVING"i {% id %}
t_ORTHOGONAL -> "ORTHOGONAL"i {% id %}
t_PERPENDICULAR -> "PERPENDICULAR"i {% id %}
t_PARALLEL -> "PARALLEL"i {% id %}
t_STATIONARY -> "STATIONARY"i {% id %}
t_HORIZONTAL -> "HORIZONTAL"i {% id %}
t_VERTICAL -> "VERTICAL"i {% id %}

t_ARROW_ANY -> t_ARROW_UP {% id %}
    | t_ARROW_DOWN {% id %} # Because of this, "v" can never be an Object or Legend variable. TODO: Ensure "v" is never an Object or Legend variable
    | t_ARROW_LEFT {% id %}
    | t_ARROW_RIGHT {% id %}

# Command tokens
t_AGAIN -> "AGAIN"i {% id %}
t_CANCEL -> "CANCEL"i {% id %}
t_CHECKPOINT -> "CHECKPOINT"i {% id %}
t_RESTART -> "RESTART"i {% id %}
t_UNDO -> "UNDO"i {% id %}
t_WIN -> "WIN"i {% id %}
t_MESSAGE -> "MESSAGE"i {% id %}

t_ELLIPSIS -> "..."i {% id %}

# LEGEND tokens
t_AND -> "AND"i {% id %}
t_OR -> "OR"i {% id %}

# SOUND tokens
t_SFX0 -> "SFX0"i {% id %}
t_SFX1 -> "SFX1"i {% id %}
t_SFX2 -> "SFX2"i {% id %}
t_SFX3 -> "SFX3"i {% id %}
t_SFX4 -> "SFX4"i {% id %}
t_SFX5 -> "SFX5"i {% id %}
t_SFX6 -> "SFX6"i {% id %}
t_SFX7 -> "SFX7"i {% id %}
t_SFX8 -> "SFX8"i {% id %}
t_SFX9 -> "SFX9"i {% id %}
t_SFX10 -> "SFX10"i {% id %}
t_SFX ->
      t_SFX10 {% id %} # needs to go 1st because of t_SFX1
    | t_SFX0 {% id %}
    | t_SFX1 {% id %}
    | t_SFX2 {% id %}
    | t_SFX3 {% id %}
    | t_SFX4 {% id %}
    | t_SFX5 {% id %}
    | t_SFX6 {% id %}
    | t_SFX7 {% id %}
    | t_SFX8 {% id %}
    | t_SFX9 {% id %}

# METADATA Tokens
t_TITLE -> "TITLE"i {% id %}
t_AUTHOR -> "AUTHOR"i {% id %}
t_HOMEPAGE -> "HOMEPAGE"i {% id %}
t_YOUTUBE -> "YOUTUBE"i {% id %}
t_ZOOMSCREEN -> "ZOOMSCREEN"i {% id %}
t_FLICKSCREEN -> "FLICKSCREEN"i {% id %}
t_REQUIRE_PLAYER_MOVEMENT -> "REQUIRE_PLAYER_MOVEMENT"i {% id %}
t_RUN_RULES_ON_LEVEL_START -> "RUN_RULES_ON_LEVEL_START"i {% id %}
t_COLOR_PALETTE -> "COLOR_PALETTE"i {% id %}
t_BACKGROUND_COLOR -> "BACKGROUND_COLOR"i {% id %}
t_TEXT_COLOR -> "TEXT_COLOR"i {% id %}
t_REALTIME_INTERVAL -> "REALTIME_INTERVAL"i {% id %}
t_KEY_REPEAT_INTERVAL -> "KEY_REPEAT_INTERVAL"i {% id %}
t_AGAIN_INTERVAL -> "AGAIN_INTERVAL"i {% id %}

# These settings do not have a value so they need to be parsed slightly differently
t_NOACTION -> "NOACTION"i {% id %}
t_NOUNDO -> "NOUNDO"i {% id %}
t_NORESTART -> "NORESTART"i {% id %}
t_THROTTLE_MOVEMENT -> "THROTTLE_MOVEMENT"i {% id %}
t_NOREPEAT_ACTION -> "NOREPEAT_ACTION"i {% id %}
t_VERBOSE_LOGGING -> "VERBOSE_LOGGING"i {% id %}


t_TRANSPARENT -> "TRANSPARENT"i {% id %}

t_MOVE -> "MOVE"i {% id %}
t_DESTROY -> "DESTROY"i {% id %}
t_CREATE -> "CREATE"i {% id %}
t_CANTMOVE -> "CANTMOVE"i {% id %}

t_TITLESCREEN -> "TITLESCREEN"i {% id %}
t_STARTGAME -> "STARTGAME"i {% id %}
t_STARTLEVEL -> "STARTLEVEL"i {% id %}
t_ENDLEVEL -> "ENDLEVEL"i {% id %}
t_ENDGAME -> "ENDGAME"i {% id %}
t_SHOWMESSAGE -> "SHOWMESSAGE"i {% id %}
t_CLOSEMESSAGE -> "CLOSEMESSAGE"i {% id %}

t_GROUP_RULE_PLUS -> "+"i {% id %}

# WINCONDITIONS tokens
t_ON -> "ON"i {% id %}
t_NO -> "NO"i {% id %}
t_ALL -> "ALL"i {% id %}
t_ANY -> "ANY"i {% id %}
t_SOME -> "SOME"i {% id %}


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
Homepage -> t_HOMEPAGE __ word  {% ([_1, _2, words]) => { return {type:'HOMEPAGE', value: words} } %}
Youtube -> t_YOUTUBE __ word
Zoomscreen -> t_ZOOMSCREEN __ widthAndHeight
Flickscreen -> t_FLICKSCREEN __ widthAndHeight
RequirePlayerMovement -> t_REQUIRE_PLAYER_MOVEMENT (__ "off"):?
RunRulesOnLevelStart -> t_RUN_RULES_ON_LEVEL_START (__ "true"):?
ColorPalette -> t_COLOR_PALETTE __ word
BackgroundColor -> t_BACKGROUND_COLOR __ colorNameOrHex
TextColor -> t_TEXT_COLOR __ colorNameOrHex
RealtimeInterval -> t_REALTIME_INTERVAL __ decimal
KeyRepeatInterval -> t_KEY_REPEAT_INTERVAL __ decimal
AgainInterval -> t_AGAIN_INTERVAL __ decimal

widthAndHeight -> integer "x" integer


Sprite ->
      SpritePixels      {% id %}
    | SpriteNoPixels    {% id %}

SpriteNoPixels ->
    _ spriteName (__ legendShortcutChar):? lineTerminator:+ # Some sprites have their colors commented out so we need more than one newline
    _ colorDefinitions lineTerminator:+ {% toDebug('SpriteNoPixels') || function ([_0, name, mapCharOpt, _2, _3, colors, _5]) { return {type: 'SPRITE_NO_PIXELS', name: name, mapChar: mapCharOpt ? mapCharOpt[1] : null, colors: colors} } %}

SpritePixels ->
    _ spriteName (__ legendShortcutChar):? lineTerminator:+ # Some sprites have their colors commented out so we need more than one newline
    _ colorDefinitions lineTerminator:+
    PixelRows
    lineTerminator:*                     {% toDebug('SpritePixels') || function ([_0, name, mapCharOpt, _2, _3, colors, _5, pixels, _7]) { return {type: 'SPRITE_WITH_PIXELS', name: name, mapChar: mapCharOpt ? mapCharOpt[1] : null, colors: colors, pixels: pixels} } %}

colorDefinitions ->
      nonemptyListOf[colorNameOrHex, __] {% ([a]) => extractFirst(a) %}
    # Some games just have `#123456#789abc #def012` (no space before the next hex number)
    | nonemptyListOf[colorHex6, __] nonemptyListOf[colorHex6, __]  {% ([a, b]) => extractFirst(a.concat(b)) %}


spriteName -> ruleVariableName              {% id %}
pixelRow -> _ pixelDigit:+ lineTerminator   {% toDebug('pixelRow', function ([_0, entries, _2]) { return {type: 'PIXEL_ROW', entries: entries} }) || function ([_0, entries, _2]) { return entries } %}
pixelDigit ->
      digit {% id %}
    | "."   {% id %}
legendShortcutChar -> [^\n ] {% id %}

# Support at least 5x5 sprites (so we can disambiguate from single-color definitions)
PixelRows -> pixelRow pixelRow pixelRow pixelRow pixelRow:+


LegendTile ->
      LegendTileSimple {% id %}
    | LegendTileAnd    {% id %}
    | LegendTileOr     {% id %}

LegendTileSimple -> _ LegendVarNameDefn _ "=" _ LookupLegendVarName lineTerminator:+                                {% toDebug('LegendTileSimple') || function([_0, name, _2, _3, _4, value, _6, _7]) { return {type: 'LEGEND_ITEM_SIMPLE', name: name, value: value} } %}
# Ensure there are spaces around AND or OR so we do not accidentally match CleANDishes
LegendTileAnd ->    _ LegendVarNameDefn _ "=" _ atLeast2ListOf[LookupLegendVarName, __ t_AND __] lineTerminator:+   {% toDebug('LegendTileAnd') || function([_0, name, _2, _3, _4, values, _6, _7]) { return {type: 'LEGEND_ITEM_AND', name: name, values: extractFirst(values)} } %}
LegendTileOr ->     _ LegendVarNameDefn _ "=" _ atLeast2ListOf[LookupLegendVarName, __ t_OR __] lineTerminator:+    {% toDebug('LegendTileOr')  || function([_0, name, _2, _3, _4, values, _6, _7]) { return {type: 'LEGEND_ITEM_OR', name: name, values: extractFirst(values)} } %}

LegendVarNameDefn -> word {% toDebug('LegendVarNameDefn') || id %}
    # # If it is multiple characters then it needs to be a valid ruleVariableName. If it is one character then it needs to be a valid legendVariableChar
    #   (ruleVariableChar ruleVariableName) {% debugRule('aksjhdakjshdasd') %}
    # | legendVariableChar                  {% debugRule('OIUOIUOIU') %}

LookupLegendVarName -> LegendVarNameDefn {% toDebug('LookupLegendVarName') || id %}


# TODO: Handle tokens like sfx0 and explicit args instead of just varName (like "Player CantMove up")
# all of them are at https:#www.puzzlescript.net/Documentation/sounds.html
SoundItem -> _ SoundItemInner lineTerminator:+

SoundItemInner ->
      SoundItemEnum
    | SoundItemSfx
    | SoundItemMoveDirection
    | SoundItemMoveSimple
    | SoundItemNormal

soundItemSimpleOptions ->
      t_RESTART
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

SoundItemAction ->
      t_CREATE
    | t_DESTROY
    | t_CANTMOVE

soundItemActionMoveArg ->
      t_UP
    | t_DOWN
    | t_LEFT
    | t_RIGHT
    | t_HORIZONTAL
    | t_VERTICAL

# collision layers are separated by a space or a comma (and some games and with a comma)
CollisionLayerItem -> _ nonemptyListOf[lookupCollisionVariableName, (_ "," _ | __)] ",":? lineTerminator:+      {% toDebug('CollisionLayerItem') || function ([_0, spriteNames, _2]) { return extractFirst(spriteNames) } %}


RuleItem ->
      RuleLoop  {% id %}
    | RuleGroup {% id %}

Rule ->
      RuleWithoutMessage    {% id %}
    | RuleWithMessage       {% id %}

RuleWithoutMessage -> _ nonemptyListOf[ConditionBracket, _] _ "->" (ActionBracket):* (_ RuleCommand):* lineTerminator:+                     {% toDebug('RuleWithoutMessage') || function([_0, conditionBrackets, _2, _3, actionBrackets, commands, _6])                 { return {type: 'RULE', conditions: extractFirst(conditionBrackets), actions: extractFirst(actionBrackets), commands: extractSecond(commands)} } %}
RuleWithMessage ->    _ nonemptyListOf[ConditionBracket, _] _ "->" (ActionBracket):* (_ RuleCommand):* _ MessageCommand lineTerminator:*    {% toDebug('RuleWithoutMessage') || function([_0, conditionBrackets, _2, _3, actionBrackets, commands, _6, message, _7])    { return {type: 'RULE', conditions: extractFirst(conditionBrackets), actions: extractFirst(actionBrackets), commands: extractSecond(commands), message} } %}

ConditionBracket ->
      LeftModifiers NormalRuleBracket    {% ([modifiers, {neighbors, againHack, debugFlag}]) => { return {type:'CONDITION_BRACKET', modifiers, neighbors, againHack, debugFlag} } %}
    | LeftModifiers EllipsisRuleBracket  {% ([modifiers, {beforeNeighbors, afterNeighbors, debugFlag}]) => { return {type:'CONDITION_ELLIPSIS_BRACKET', modifiers, beforeNeighbors, afterNeighbors, debugFlag} } %}

ActionBracket ->
      (_ RuleModifier):* _ NormalRuleBracket    {% ([modifiers, _1, {neighbors, againHack, debugFlag}]) => { return {type:'ACTION_BRACKET', modifiers: extractSecond(modifiers), neighbors, againHack, debugFlag} } %}
    | (_ RuleModifier):* _ EllipsisRuleBracket  {% ([modifiers, _1, {beforeNeighbors, afterNeighbors, debugFlag}]) => { return {type:'ACTION_ELLIPSIS_BRACKET', modifiers: extractSecond(modifiers), beforeNeighbors, afterNeighbors, debugFlag} } %}

LeftModifiers ->
      nonemptyListOf[RuleModifierLeft, __] _    {% ([a]) => extractFirst(a) %}
    | null                                      {% () => [] /* No modifiers */ %}

RuleBracket ->
      EllipsisRuleBracket {% id %}
    | NormalRuleBracket   {% id %}

# t_AGAIN is a HACK. It should be in the list of commands but it's not.
NormalRuleBracket -> "[" nonemptyListOf[RuleBracketNeighbor, "|"] (t_AGAIN _):? "]" (_ t_DEBUGGER):?                                                        {% toDebug('NormalRuleBracket') || function([_0, neighbors, againHack, _3, debugFlag]) { return {type: '_INNER_BRACKET', neighbors: extractFirst(neighbors), againHack: againHack ? true : false, debugFlag: debugFlag ? debugFlag[1] : null } } %}
EllipsisRuleBracket -> "[" nonemptyListOf[RuleBracketNeighbor, "|"] "|" _ t_ELLIPSIS _ "|" nonemptyListOf[RuleBracketNeighbor, "|"] "]" (_ t_DEBUGGER):?    {% toDebug('EllipsisRuleBracket') || function([_0, beforeNeighbors, _2, _3, _4, _5, _6, afterNeighbors, _8, debugFlag]) { return {type: '_INNER_ELLIPSIS_BRACKET', beforeNeighbors: extractFirst(beforeNeighbors), afterNeighbors: extractFirst(afterNeighbors), debugFlag: debugFlag ? debugFlag[1] : null } } %}

RuleBracketNeighbor ->
    #   HackTileNameIsSFX1 # to parse '... -> [ SFX1 ]' (they should be commands)
    # | HackTileNameIsSFX2 # to parse '... -> [ tilename SFX1 ]'
      RuleBracketNoEllipsisNeighbor {% id %}
    | RuleBracketEmptyNeighbor      {% id %}

RuleBracketNoEllipsisNeighbor ->
      _ nonemptyListOf[TileWithModifier ,__] (_ t_DEBUGGER):? _     {% toDebug('RuleBracketNoEllipsisNeighbor') || function([_0, tilesWithModifiers, debugFlag, _3]) { return {type: 'NEIGHBOR', tilesWithModifiers: extractFirst(tilesWithModifiers), debugFlag: debugFlag ? debugFlag[1] : null } } %}

# Matches `[]` as well as `[ ]`
RuleBracketEmptyNeighbor -> _       {% toDebug('RuleBracketEmptyNeighbor') || function([_0]) { return {type: 'NEIGHBOR_EMPTY'} } %}

# Force-check that there is whitespace after the cellLayerModifier so things
# like "STATIONARYZ" or "NOZ" are not parsed as a modifier
# (they are a variable that happens to begin with the same text as a modifier)
TileWithModifier -> (tileModifier __):? lookupRuleVariableName  {% toDebug('TileWithModifier') || function([modifier, tileName]) { return {type: 'TILE_WITH_MODIFIER', modifier: modifier ? modifier[0] : null, tileName} } %}

# tileModifier -> tileModifierInner {% debugRule('TILEMODIFIER') %}

tileModifier ->
      t_NO              {% id %}
    | t_LEFT            {% id %}
    | t_RIGHT           {% id %}
    | t_UP              {% id %}
    | t_DOWN            {% id %}
    | t_RANDOMDIR       {% id %}
    | t_RANDOM          {% id %}
    | t_STATIONARY      {% id %}
    | t_MOVING          {% id %}
    | t_ACTION          {% id %}
    | t_VERTICAL        {% id %}
    | t_HORIZONTAL      {% id %}
    | t_PERPENDICULAR   {% id %}
    | t_PARALLEL        {% id %}
    | t_ORTHOGONAL      {% id %}
    | t_ARROW_ANY       {% id %} # NOTE: This can be a "v"

RuleModifier ->
      t_RANDOM      {% id %}
    | t_UP          {% id %}
    | t_DOWN        {% id %}
    | t_LEFT        {% id %}
    | t_RIGHT       {% id %}
    | t_VERTICAL    {% id %}
    | t_HORIZONTAL  {% id %}
    | t_ORTHOGONAL  {% id %}

RuleModifierLeft ->
      RuleModifier  {% id %} # Sometimes people write "RIGHT LATE [..." instead of "LATE RIGHT [..."
    | t_LATE        {% id %}
    | t_RIGID       {% id %}

RuleCommand ->
      t_AGAIN       {% () => { return {type: 'RULE_COMMAND_AGAIN'} } %}
    | t_CANCEL      {% () => { return {type: 'RULE_COMMAND_CANCEL'} } %}
    | t_CHECKPOINT  {% () => { return {type: 'RULE_COMMAND_CHECKPOINT'} } %}
    | t_RESTART     {% () => { return {type: 'RULE_COMMAND_RESTART'} } %}
    | t_WIN         {% () => { return {type: 'RULE_COMMAND_WIN'} } %}
    | t_SFX         {% ([a]) => { return {type: 'RULE_COMMAND_SFX', value: a[0][0]} } %}

MessageCommand -> t_MESSAGE messageLine {% ([_1, message]) => { return {type:'MESSAGE_COMAMND', message} } %}

RuleLoop ->
    _
    t_DEBUGGER:?
    t_STARTLOOP lineTerminator:+
    (RuleItem):+
    t_ENDLOOP lineTerminator:+

RuleGroup ->
    Rule
    (_ t_GROUP_RULE_PLUS Rule):* {% ([firstRule, otherRules]) => { return {type:'RULE_GROUP', rules: [firstRule].concat(extractThird(otherRules))} } %}

# HackTileNameIsSFX1 -> t_SFX __ t_DEBUGGER:?
# HackTileNameIsSFX2 -> lookupRuleVariableName __ t_SFX __ t_DEBUGGER:?


WinConditionItem
    -> WinConditionItemSimple
    | WinConditionItemOn

WinConditionItemSimple -> _ winConditionItemPrefix __ lookupRuleVariableName lineTerminator:+
WinConditionItemOn -> _ winConditionItemPrefix __ lookupRuleVariableName __ t_ON __ lookupRuleVariableName lineTerminator:+

winConditionItemPrefix ->
      t_NO
    | t_ALL
    | t_ANY
    | t_SOME


LevelItem ->
      GameMessageLevel {% id %}
    | levelMapRow {% id %}
    | SeparatorLine {% id %}


# Ensure we collect characters up to the last non-whitespace
GameMessageLevel -> _ t_MESSAGE messageLine {% ([_0, _1, message]) => { return {type: 'LEVEL_MESSAGE', message } } %}
# This does not use a lineTerminator because it needs to consume parentheses
messageLine -> [^\n]:* [\n] {% toDebug('messageLine') || function([message, _2]) { return message.join('').trim() } %}
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
