import * as ohm from 'ohm-js'
import {
    BaseForLines,
    IGameCode,
    IGameNode,
    GameData,
    GameMessage
} from '../models/game'
import { GameMetadata, Dimension } from '../models/metadata'
import { HexColor, TransparentColor } from '../models/colors'
import { lookupColorPalette } from '../colors'
import { LookupHelper } from './lookup'
import { ValidationLevel, ValidationHelper } from './validation'
import { SpawnSyncOptionsWithStringEncoding } from 'child_process';

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

    GameMessage = t_MESSAGE words*
`

export const STRINGTOKEN_GRAMMAR = `
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

export function getGameSemantics(lookup: LookupHelper, validation: ValidationHelper) {
    let currentColorPalette = 'arnecolors' // default
    const metadata = new GameMetadata()
    return {
        GameData: function (
            _whitespace1: string,
            title: ohm.Node,
            _whitespace2: string,
            settingsFields: ohm.Node,
            _whitespace3: string,
            objects: ohm.Node,
            legends: ohm.Node,
            sounds: ohm.Node,
            collisionLayers: ohm.Node,
            rules: ohm.Node,
            winConditions: ohm.Node,
            levels: ohm.Node
        ) {
            settingsFields.parse().forEach((setting: [string, string | number | Dimension | HexColor] | string) => {
                if (Array.isArray(setting)) {
                    const key: string = setting[0]
                    const value = setting[1]
                    switch (key) {
                        case "author": metadata.author = value as string
                            break
                        case "homepage": metadata.homepage = value as string
                            break
                        case "youtube": metadata.youtube = value as string
                            break
                        case "color_palette": metadata.color_palette = value as string
                            break
                        case "run_rules_on_level_start": metadata.run_rules_on_level_start = value as string
                            break
                        case "realtime_interval": metadata.realtime_interval = value as number
                            break
                        case "key_repeat_interval": metadata.key_repeat_interval = value as number
                            break
                        case "again_interval": metadata.again_interval = value as number
                            break
                        case "zoomscreen": metadata.zoomscreen = value as Dimension
                            break
                        case "flickscreen": metadata.flickscreen = value as Dimension
                            break
                        case "background_color": metadata.background_color = value as HexColor
                            break
                        case "text_color": metadata.text_color = value as HexColor
                            break
                        case "noaction": metadata.noaction = true
                            break
                        case "noundo": metadata.noundo = true
                            break
                        case "norepeat_action": metadata.norepeat_action = true
                            break
                        case "throttle_movement": metadata.throttle_movement = true
                            break
                        case "norestart": metadata.norestart = true
                            break
                        case "require_player_movement": metadata.require_player_movement = true
                            break
                        case "verbose_logging": metadata.verbose_logging = true
                    }
                } else {
                    switch (setting) {
                        case "noaction": metadata.noaction = true
                            break
                        case "noundo": metadata.noundo = true
                            break
                        case "norepeat_action": metadata.norepeat_action = true
                            break
                        case "throttle_movement": metadata.throttle_movement = true
                            break
                        case "norestart": metadata.norestart = true
                            break
                        case "require_player_movement": metadata.require_player_movement = true
                            break
                        case "verbose_logging": metadata.verbose_logging = true
                    }
                }
            })
            return new GameData(
                title.parse(),
                metadata,
                objects.parse()[0] || [],
                legends.parse()[0] || [],
                sounds.parse()[0] || [],
                collisionLayers.parse()[0] || [],
                rules.parse()[0] || [],
                winConditions.parse()[0] || [],
                levels.parse()[0] || []
            )
        },
        Title: function (_1: ohm.Node, value: ohm.Node) {
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
        ColorPalette: function (_1: ohm.Node, colorPaletteName: ohm.Node) {
            // Set the color palette so we only need to use hex color codes
            currentColorPalette = colorPaletteName.parse()
            return getConfigField(_1, colorPaletteName)
        },
        RequirePlayerMovement: getConfigField,

        Section: function (_threeDashes1: ohm.Node, _lineTerminator1: ohm.Node, _sectionName: ohm.Node, _lineTerminator2: ohm.Node, _threeDashes2: ohm.Node, _8: ohm.Node, _9: ohm.Node, _10: ohm.Node, _11: ohm.Node) {
            return _10.parse()
        },
        MessageCommand: function (_message: ohm.Node, message: ohm.Node) {
            return new GameMessage(this.source, message.parse())
        },
        GameMessage: function (_1: ohm.Node, optionalMessage: ohm.Node) {
            // TODO: Maybe discard empty messages?
            return new GameMessage(this.source, optionalMessage.parse()[0] /* Since the message is optional */)
        },
        widthAndHeight: function (_1: ohm.Node, _2: ohm.Node, _3: ohm.Node) {
            return new Dimension(_1.parse(), _3.parse())
        },
        pixelRow: function (_1: ohm.Node, _2: ohm.Node) {
            return _1.parse()
        },
        colorHex3: function (_1: ohm.Node, _2: ohm.Node, _3: ohm.Node, _4: ohm.Node) {
            return new HexColor(this.source, this.sourceString)
        },
        colorHex6: function (_1: ohm.Node, _2: ohm.Node, _3: ohm.Node, _4: ohm.Node, _5: ohm.Node, _6: ohm.Node, _7: ohm.Node) {
            return new HexColor(this.source, this.sourceString)
        },
        colorName: function (_1: ohm.Node) {
            const colorName = this.sourceString.toLowerCase()
            const hex = lookupColorPalette(currentColorPalette, colorName)
            if (hex) {
                return new HexColor(this.source, hex)
            } else {
                const transparent = new TransparentColor(this.source)
                validation.addValidationMessage(transparent, ValidationLevel.WARNING, `Invalid color name. "${colorName}" is not a valid color. Using "transparent" instead`)
                return transparent
            }
        },
        colorTransparent: function (_1: ohm.Node) {
            return new TransparentColor(this.source)
        },
        NonemptyListOf: function (_1: ohm.Node, _2: ohm.Node, _3: ohm.Node) {
            return [_1.parse()].concat(_3.parse())
        },
        nonemptyListOf: function (_1: ohm.Node, _2: ohm.Node, _3: ohm.Node) {
            // Do this special because LegendTile contains things like `X = A or B or C` and we need to know if they are `and` or `or`
            return {
                __type: 'nonemptyListOf',
                values: [_1.parse()].concat(_3.parse()),
                separators: [_2.parse()]
            }
        },
        integer: function (_1: string) {
            return parseInt(this.sourceString)
        },
        decimalWithLeadingNumber: function (_1: string, _2: string, _3: string) {
            return parseFloat(this.sourceString)
        },
        decimalWithLeadingPeriod: function (_1: string, _2: string) {
            return parseFloat(this.sourceString)
        },
        lookupRuleVariableName: function (_1: ohm.Node) {
            return lookup.lookupObjectOrLegendTile(this.source, _1.parse())
        },
        ruleVariableName: function (_1: string) {
            return this.sourceString
        },
        words: function (_1: string) {
            return this.sourceString
        },
        _terminal: function () { return this.primitiveValue },
        lineTerminator: (_1: string, _2: string, _3: string, _4: string) => { },
        digit: (x: ohm.Node) => {
            return x.primitiveValue.charCodeAt(0) - '0'.charCodeAt(0)
        }
        // _default: function (exp1) {
        //   debugger
        //   return this.sourceString
        // }
    }
}

// Helper for setting a config field
function getConfigField(key: ohm.Node, value: ohm.Node) {
    return [key.parse(), value.parse()]
}