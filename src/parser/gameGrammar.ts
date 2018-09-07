import * as ohm from 'ohm-js'
import { GameData } from '../models/game'
import { GameMetadata, Dimension } from '../models/metadata'
import { HexColor, TransparentColor, IColor } from '../models/colors'
import { lookupColorPalette } from '../colors'
import { LookupHelper } from './lookup'
import { ValidationLevel, AddValidationFunc } from './parser'
import { LevelMap } from '../models/level';
import { WinConditionSimple } from '../models/winCondition';
import { ASTRule } from './astRule';
import { CollisionLayer } from '../models/collisionLayer';
import { GameSound } from '../models/sound';
import { GameLegendTileSimple, GameSprite } from '../models/tile';

export type Parseable<T> = {
    parse: () => T
    primitiveValue: string
}

export const COMMON_GRAMMAR = `
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
    space := (whitespace | multiLineComment) ")"* // redefine what a space is so we can ignore comments

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
    // "=" because it can occur inside a legend Variable
    ruleVariableChar = (~space ~newline ~"=" ~"[" ~"]" ~"|" ~t_ELLIPSIS any)

    ruleVariableName = ruleVariableChar+
    lookupRuleVariableName = ~t_AGAIN ruleVariableName // added t_AGAIN to parse '... -> [ tilename AGAIN ]' (it should be a command)

    // Disallow:
    // space [ ] | t_ELLIPSIS   because it can occur inside a Rule
    // "," because it can occur inside a CollisionLayer
    // "=" because it can occur inside a legend Variable
    collisionVariableChar = (~space ~newline ~"=" ~"[" ~"]" ~"|" ~"," ~t_ELLIPSIS any)
    collisionVariableName = collisionVariableChar+
    lookupCollisionVariableName = collisionVariableName
`

export const STRINGTOKEN_GRAMMAR = `
    // special flag that can appear before rules so the debugger pauses before the rule is evaluated
    t_DEBUGGER
        = t_DEBUGGER_ADD
        | t_DEBUGGER_REMOVE
        | t_DEBUGGER_DEFAULT
    t_DEBUGGER_DEFAULT = caseInsensitive<"DEBUGGER">
    t_DEBUGGER_ADD = caseInsensitive<"DEBUGGER_ADD">
    t_DEBUGGER_REMOVE = caseInsensitive<"DEBUGGER_REMOVE">


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
    t_PARALLEL = caseInsensitive<"PARALLEL">
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
    t_TITLE = caseInsensitive<"TITLE">
    t_AUTHOR = caseInsensitive<"AUTHOR">
    t_HOMEPAGE = caseInsensitive<"HOMEPAGE">
    t_YOUTUBE = caseInsensitive<"YOUTUBE">
    t_ZOOMSCREEN = caseInsensitive<"ZOOMSCREEN">
    t_FLICKSCREEN = caseInsensitive<"FLICKSCREEN">
    t_REQUIRE_PLAYER_MOVEMENT = caseInsensitive<"REQUIRE_PLAYER_MOVEMENT">
    t_RUN_RULES_ON_LEVEL_START = caseInsensitive<"RUN_RULES_ON_LEVEL_START">
    t_COLOR_PALETTE = caseInsensitive<"COLOR_PALETTE">
    t_BACKGROUND_COLOR = caseInsensitive<"BACKGROUND_COLOR">
    t_TEXT_COLOR = caseInsensitive<"TEXT_COLOR">
    t_REALTIME_INTERVAL = caseInsensitive<"REALTIME_INTERVAL">
    t_KEY_REPEAT_INTERVAL = caseInsensitive<"KEY_REPEAT_INTERVAL">
    t_AGAIN_INTERVAL = caseInsensitive<"AGAIN_INTERVAL">

    // These settings do not have a value so they need to be parsed slightly differently
    t_NOACTION = caseInsensitive<"NOACTION">
    t_NOUNDO = caseInsensitive<"NOUNDO">
    t_NORESTART = caseInsensitive<"NORESTART">
    t_THROTTLE_MOVEMENT = caseInsensitive<"THROTTLE_MOVEMENT">
    t_NOREPEAT_ACTION = caseInsensitive<"NOREPEAT_ACTION">
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

export const METADATA_GRAMMAR = `
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

    Title = t_TITLE words
    Author = t_AUTHOR words
    Homepage = t_HOMEPAGE words
    Youtube = t_YOUTUBE words
    Zoomscreen = t_ZOOMSCREEN widthAndHeight
    Flickscreen = t_FLICKSCREEN widthAndHeight
    RequirePlayerMovement = t_REQUIRE_PLAYER_MOVEMENT "off"?
    RunRulesOnLevelStart = t_RUN_RULES_ON_LEVEL_START "true"?
    ColorPalette = t_COLOR_PALETTE words
    BackgroundColor = t_BACKGROUND_COLOR colorNameOrHex
    TextColor = t_TEXT_COLOR colorNameOrHex
    RealtimeInterval = t_REALTIME_INTERVAL decimal
    KeyRepeatInterval = t_KEY_REPEAT_INTERVAL decimal
    AgainInterval = t_AGAIN_INTERVAL decimal

    widthAndHeight = integer "x" integer
`

export function getGameSemantics(lookup: LookupHelper, addValidationMessage: AddValidationFunc) {
    let currentColorPalette = 'arnecolors' // default
    return {
        GameData: function (this: ohm.Node, _whitespace1: Parseable<string>, title: Parseable<string>, _whitespace2: Parseable<string>, settingsFields: Parseable<{key: string, value: boolean | string | Dimension}[]>, _whitespace3: Parseable<string>, spritesSection: Parseable<GameSprite[][]>, legendsSection: Parseable<GameLegendTileSimple[][]>, soundsSection: Parseable<GameSound[][]>, collisionLayersSection: Parseable<CollisionLayer[][]>, rulesSection: Parseable<ASTRule[][]>, winConditionsSection: Parseable<WinConditionSimple[][]>, levelsSection: Parseable<LevelMap[][]>) {
            const metadata = new GameMetadata()
            for (const {key, value} of settingsFields.parse()) {
                metadata._setValue(key.toLowerCase(), value)
            }
            // The order in which these are parsed is important because they populate the lookup object
            const sprites = spritesSection.parse()[0] || []
            const legends = legendsSection.parse()[0] || []
            const sounds = soundsSection.parse()[0] || []
            const collisionLayers = collisionLayersSection.parse()[0] || []
            const rules = rulesSection.parse()[0] || []
            const winConditions = winConditionsSection.parse()[0] || []
            const levels = levelsSection.parse()[0] || []
            const levelsWithoutNullMessages = levels.filter(l => !!l)

            return new GameData(
                title.parse(),
                metadata,
                sprites,
                legends,
                sounds,
                collisionLayers,
                rules,
                winConditions,
                levelsWithoutNullMessages
            )
        },
        Title: function (this: ohm.Node, _1: Parseable<string>, value: Parseable<string>) {
            return value.parse()
        },

        // Metadata fields
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
        t_NOACTION: getConfigFieldSimple,
        t_NOUNDO: getConfigFieldSimple,
        t_NORESTART: getConfigFieldSimple,
        t_THROTTLE_MOVEMENT: getConfigFieldSimple,
        t_NOREPEAT_ACTION: getConfigFieldSimple,
        t_VERBOSE_LOGGING: getConfigFieldSimple,

        ColorPalette: function (this: ohm.Node, _1: Parseable<string>, colorPaletteName: Parseable<string>) {
            // Set the color palette so we only need to use hex color codes
            currentColorPalette = colorPaletteName.parse()
            return getConfigField(_1, colorPaletteName)
        },
        RequirePlayerMovement: getConfigField,

        Section: function (this: ohm.Node, _threeDashes1: Parseable<string>, _lineTerminator1: Parseable<string>, _sectionName: Parseable<string>, _lineTerminator2: Parseable<string>, _threeDashes2: Parseable<string>, _8: Parseable<string>, _9: Parseable<string>, _10: Parseable<string>, _11: Parseable<string>) {
            return _10.parse()
        },
        widthAndHeight: function (this: ohm.Node, _1: Parseable<string>, _2: Parseable<string>, _3: Parseable<string>) {
            return {
                __type: 'widthAndHeight',
                width: _1.parse(),
                height: _3.parse()
            }
        },
        pixelRow: function (this: ohm.Node, _1: Parseable<string>, _2: Parseable<string>) {
            return _1.parse()
        },
        colorHex3: function (this: ohm.Node, _1: Parseable<string>, _2: Parseable<string>, _3: Parseable<string>, _4: Parseable<string>) {
            return new HexColor(this.source, this.sourceString)
        },
        colorHex6: function (this: ohm.Node, _1: Parseable<string>, _2: Parseable<string>, _3: Parseable<string>, _4: Parseable<string>, _5: Parseable<string>, _6: Parseable<string>, _7: Parseable<string>) {
            return new HexColor(this.source, this.sourceString)
        },
        colorName: function (this: ohm.Node, _1: Parseable<string>) {
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
        colorTransparent: function (this: ohm.Node, _1: Parseable<string>) {
            return new TransparentColor(this.source)
        },
        NonemptyListOf: function (this: ohm.Node, _1: Parseable<string>, _2: Parseable<string>, _3: Parseable<string>) {
            return [_1.parse()].concat(_3.parse())
        },
        integer: function (this: ohm.Node, _1: Parseable<string>) {
            return parseInt(this.sourceString)
        },
        decimalWithLeadingNumber: function (this: ohm.Node, _1: Parseable<string>, _2: Parseable<string>, _3: Parseable<string>) {
            return parseFloat(this.sourceString)
        },
        decimalWithLeadingPeriod: function (this: ohm.Node, _1: Parseable<string>, _2: Parseable<string>) {
            return parseFloat(this.sourceString)
        },
        lookupRuleVariableName: function (this: ohm.Node, _1: Parseable<string>) {
            return lookup.lookupObjectOrLegendTile(this.source, _1.parse())
        },
        lookupCollisionVariableName: function (this: ohm.Node, _1: Parseable<string>) {
            return lookup.lookupObjectOrLegendTile(this.source, _1.parse())
        },
        ruleVariableName: function (this: ohm.Node, _1: Parseable<string>) {
            return this.sourceString
        },
        collisionVariableName: function (this: ohm.Node, _1: Parseable<string>) {
            return this.sourceString
        },
        words: function (this: ohm.Node, _1: Parseable<string>) {
            return this.sourceString
        },
        _terminal: function (this: ohm.Node, ) { return this.primitiveValue },
        lineTerminator: (_1: Parseable<string>, _2: Parseable<string>, _3: Parseable<string>, _4: Parseable<string>) => { },
        digit: (x: Parseable<string>) => {
            return x.primitiveValue.charCodeAt(0) - '0'.charCodeAt(0)
        }
        // _default: function (this: ohm.Node, exp1) {
        //   return this.sourceString
        // }
    }
}

// Helper for setting a config field
function getConfigField(key: Parseable<string>, value: Parseable<boolean | string | Dimension | IColor>) {
    let v = value.parse()
    if (!v) {
        // settings that do not have a value means they are `true`
        v = true
    } else if (typeof v === 'string') {
        switch (v.toLowerCase()) {
            case 'on':
            case 'true':
                v = true
                break
            case 'off':
            case 'false':
                v = false
                break
            default:
                // leave it as-is
        }
    }
    return {key: key.parse(), value: value.parse()}
}

// This just sets the value to be true for fields that do not have a value (e.g. VERBOSE_LOGGING or NOUNDO)
function getConfigFieldSimple (key: Parseable<string>) {
    return {key: key.parse(), value: true}
}