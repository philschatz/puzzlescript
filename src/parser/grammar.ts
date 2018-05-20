const COMMON_GRAMMAR = `
    GameData =
        lineTerminator* // Version information
        Title lineTerminator+
        (OptionalMetaData lineTerminator+)*
        Section<t_OBJECTS, Sprite>?
        Section<t_LEGEND, LegendTile>?
        Section<t_SOUNDS, SoundItem>?
        Section<t_COLLISIONLAYERS, CollisionLayerItem>?
        Section<t_RULES, RuleItem>?
        Section<t_WINCONDITIONS, WinConditionItem>?
        Section<t_LEVELS, LevelItem>?

    lineTerminator = space* newline (space newline)*
    sourceCharacter = any

    newline = "\\n"
    whitespace = " " | "\\u0009" /*tab*/
    space := whitespace | multiLineComment // redefine what a space is so we can ignore comments

    nonVarChar = whitespace | newline | "[" | "]" | "(" | ")" | "|" | "."

    multiLineComment = "(" textOrComment* (")" | end) // Some games do not close their comments
    textOrComment =
        multiLineComment
    | (~("(" | ")") sourceCharacter)+

    integer = digit+

    word = (~lineTerminator any)+
    words = word+
    decimal =
        decimalWithLeadingNumber
        | decimalWithLeadingPeriod
    decimalWithLeadingNumber = digit+ ("." digit+)?
    decimalWithLeadingPeriod = "." digit+

    colorTransparent = t_TRANSPARENT
    colorHex6 = "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit
    colorHex3 = "#" hexDigit hexDigit hexDigit
    colorNameOrHex = colorTransparent | colorHex6 | colorHex3 | colorName
    colorName = letter+

    // ================
    // SECTION_NAME
    // ================
    Section<Name, ItemExpr> =
        "="+ lineTerminator
        Name lineTerminator
        "="+ lineTerminator+
        (space* ItemExpr)*
        lineTerminator*

    // ----------------
    // Variable Names
    // ----------------

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
`

const STRINGTOKEN_GRAMMAR = `
    // Section titles
    t_OBJECTS = caseInsensitive<"OBJECTS">
    t_LEGEND = caseInsensitive<"LEGEND">
    t_SOUNDS = caseInsensitive<"SOUNDS">
    t_COLLISIONLAYERS = caseInsensitive<"COLLISIONLAYERS">
    t_RULES = caseInsensitive<"RULES">
    t_WINCONDITIONS = caseInsensitive<"WINCONDITIONS">
    t_LEVELS = caseInsensitive<"LEVELS">

    // Modifier tokens
    t_RIGID = caseInsensitive<"RIGID">
    t_LATE = caseInsensitive<"LATE">
    t_RANDOM = caseInsensitive<"RANDOM">
    t_RANDOMDIR = caseInsensitive<"RANDOMDIR">
    t_ACTION = caseInsensitive<"ACTION">
    t_STARTLOOP = caseInsensitive<"STARTLOOP">
    t_ENDLOOP = caseInsensitive<"ENDLOOP">

    // Movement tokens
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

    t_ARROW_ANY
        = t_ARROW_UP
        | t_ARROW_DOWN // Because of this, "v" can never be an Object or Legend variable. TODO: Ensure "v" is never an Object or Legend variable
        | t_ARROW_LEFT
        | t_ARROW_RIGHT

    // Command tokens
    t_AGAIN = caseInsensitive<"AGAIN">
    t_CANCEL = caseInsensitive<"CANCEL">
    t_CHECKPOINT = caseInsensitive<"CHECKPOINT">
    t_RESTART = caseInsensitive<"RESTART">
    t_UNDO = caseInsensitive<"UNDO">
    t_WIN = caseInsensitive<"WIN">
    t_MESSAGE = caseInsensitive<"MESSAGE">

    t_ELLIPSIS = "..."

    // LEGEND tokens
    t_AND = caseInsensitive<"AND">
    t_OR = caseInsensitive<"OR">

    // SOUND tokens
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

    // METADATA Tokens
    t_NOACTION = caseInsensitive<"NOACTION">
    t_NOUNDO = caseInsensitive<"NOUNDO">
    t_RUN_RULES_ON_LEVEL_START = caseInsensitive<"RUN_RULES_ON_LEVEL_START">
    t_NOREPEAT_ACTION = caseInsensitive<"NOREPEAT_ACTION">
    t_THROTTLE_MOVEMENT = caseInsensitive<"THROTTLE_MOVEMENT">
    t_NORESTART = caseInsensitive<"NORESTART">
    t_REQUIRE_PLAYER_MOVEMENT = caseInsensitive<"REQUIRE_PLAYER_MOVEMENT">
    t_VERBOSE_LOGGING = caseInsensitive<"VERBOSE_LOGGING">

    t_TRANSPARENT = caseInsensitive<"TRANSPARENT">

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

    t_GROUP_RULE_PLUS = "+"

    // WINCONDITIONS tokens
    t_ON = caseInsensitive<"ON">
    t_NO = caseInsensitive<"NO">
    t_ALL = caseInsensitive<"ALL">
    t_ANY = caseInsensitive<"ANY">
    t_SOME = caseInsensitive<"SOME">
`

const METADATA_GRAMMAR = `
    OptionalMetaData
        = Author
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

    widthAndHeight = integer "x" integer
`

const SPRITE_GRAMMAR = `
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
    pixelRow = pixelDigit+ lineTerminator
    pixelDigit = digit | "."
    legendShortcutChar = (~lineTerminator any)

    PixelRows = pixelRow pixelRow pixelRow pixelRow pixelRow
`

const LEGEND_GRAMMAR = `
    LegendTile
        = LegendTileSimple
        | LegendTileAnd
        | LegendTileOr

    LegendTileSimple = LegendVarNameDefn "=" LookupLegendVarName lineTerminator+
    LegendTileAnd = LegendVarNameDefn "=" NonemptyListOf<LookupLegendVarName, t_AND> lineTerminator+
    LegendTileOr = LegendVarNameDefn "=" NonemptyListOf<LookupLegendVarName, t_OR> lineTerminator+

    LegendVarNameDefn = ruleVariableName | legendVariableChar
    LookupLegendVarName = LegendVarNameDefn
`

const SOUND_GRAMMAR = `
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
`

const COLLISIONLAYERS_GRAMMAR = `
    CollisionLayerItem = NonemptyListOf<ruleVariableName, ","?> ","? /*support a trailing comma*/ lineTerminator+
`

const RULE_GRAMMAR = `
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

    RuleCommand
        = t_AGAIN
        | t_CANCEL
        | t_CHECKPOINT
        | t_RESTART
        | t_WIN
        | t_SFX

    MessageCommand = t_MESSAGE words*

    RuleLoop =
        t_STARTLOOP lineTerminator+
        RuleItem+
        t_ENDLOOP lineTerminator+

    RuleGroup =
        Rule
        (t_GROUP_RULE_PLUS Rule)+

    HackTileNameIsSFX1 = t_SFX
    HackTileNameIsSFX2 = lookupRuleVariableName t_SFX
`

const WINCONDITIONS_GRAMMAR = `
    WinConditionItem
        = WinConditionItemSimple
        | WinConditionItemOn

    WinConditionItemSimple = winConditionItemPrefix ruleVariableName lineTerminator+
    WinConditionItemOn = winConditionItemPrefix ruleVariableName t_ON ruleVariableName lineTerminator+

    winConditionItemPrefix
        = t_NO
        | t_ALL
        | t_ANY
        | t_SOME
`

const LEVEL_GRAMMAR = `
    GameMessage = t_MESSAGE words*

    LevelItem = (GameMessage | LevelMap) lineTerminator*
    LevelMap = levelMapRow+

    levelMapRow = (~lineTerminator ~t_MESSAGE ~"(" any)+ lineTerminator
`

export const PUZZLESCRIPT_GRAMMAR = `Puzzlescript {
    ${COMMON_GRAMMAR}
    ${STRINGTOKEN_GRAMMAR}
    ${METADATA_GRAMMAR}
    ${SPRITE_GRAMMAR}
    ${LEGEND_GRAMMAR}
    ${SOUND_GRAMMAR}
    ${COLLISIONLAYERS_GRAMMAR}
    ${RULE_GRAMMAR}
    ${WINCONDITIONS_GRAMMAR}
    ${LEVEL_GRAMMAR}
}`