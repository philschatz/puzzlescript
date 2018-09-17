import { Optional } from "..";
import { DEBUG_FLAG } from "../util";

export enum TILE_MODIFIER {
    NO = 'NO',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    UP = 'UP',
    DOWN = 'DOWN',
    RANDOMDIR = 'RANDOMDIR',
    RANDOM = 'RANDOM',
    STATIONARY = 'STATIONARY',
    MOVING = 'MOVING',
    ACTION = 'ACTION',
    VERTICAL = 'VERTICAL',
    HORIZONTAL = 'HORIZONTAL',
    PERPENDICULAR = 'PERPENDICULAR',
    PARALLEL = 'PARALLEL',
    ORTHOGONAL = 'ORTHOGONAL',
    ARROW_ANY = 'ARROW_ANY',
}

export enum BRACKET_MODIFIER {
    RANDOM = 'RANDOM',
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    VERTICAL = 'VERTICAL',
    HORIZONTAL = 'HORIZONTAL',
    ORTHOGONAL = 'ORTHOGONAL',

    LATE = 'LATE',
    RIGID = 'RIGID',
}

export type ASTNode = {
    type: string
    sourceOffset: number
}
export type IColor = ASTNode & {
}

export type ColorHex3 = IColor & {
    type: 'COLOR_HEX3'
    value: string
}
export type ColorHex6 = IColor & {
    type: 'COLOR_HEX6'
    value: string
}
export type ColorName = IColor & {
    type: 'COLOR_NAME'
    value: string
}

export type AbstractSprite = ASTNode & {
    name: string
    mapChar: Optional<string>
    colors: IColor[]
}
export type SpriteNoPixels = AbstractSprite & {
    type: 'SPRITE_NO_PIXELS'
}

export type SpriteWithPixels = AbstractSprite & {
    type: 'SPRITE_WITH_PIXELS'
    pixels: (number | '.')[][]
}


export type AbstractLegendItem = ASTNode & {
    name: string
}

export type SimpleLegendItem = AbstractLegendItem & {
    type: 'LEGEND_ITEM_SIMPLE'
    value: string
}

export type OrLegendItem = AbstractLegendItem & {
    type: 'LEGEND_ITEM_OR'
    values: string[]
}

export type AndLegendItem = AbstractLegendItem & {
    type: 'LEGEND_ITEM_AND'
    values: string[]
}


export type AbstractSound = ASTNode & {
    soundCode: number
}

export type SoundEnum = AbstractSound & {
    type: 'SOUND_ENUM'
    enum:
      'RESTART'
    | 'UNDO'
    | 'TITLESCREEN'
    | 'STARTGAME'
    | 'STARTLEVEL'
    | 'ENDLEVEL'
    | 'ENDGAME'
    | 'SHOWMESSAGE'
    | 'CLOSEMESSAGE'
}

export type SoundSfx = AbstractSound & {
    type: 'SOUND_SFX'
    sfx: string
}

export type SoundMoveDirection = AbstractSound & {
    type: 'SOUND_MOVE_DIRECTION'
    sprite: string
    direction:
      'UP'
    | 'DOWN'
    | 'LEFT'
    | 'RIGHT'
    | 'HORIZONTAL'
    | 'VERTICAL'
}

export type SoundMoveSimple = AbstractSound & {
    type: 'SOUND_MOVE_SIMPLE'
    sprite: string
}

export type SoundSpriteEvent = AbstractSound & {
    type: 'SOUND_SPRITE_EVENT'
    sprite: string
    event:
      'CREATE'
    | 'DESTROY'
    | 'CANTMOVE'
}


export type CollisionLayer = ASTNode & {
    type: 'COLLISION_LAYER'
    tiles: string[]
}

// Rules have an optional debugFlag
export type Debuggable = ASTNode & {
    debugFlag: Optional<DEBUG_FLAG>
}

export type AbstractRule = ASTNode & { }

export type RuleGroup = AbstractRule & {
    type: 'RULE_GROUP'
    rules: SimpleRule[]
}

export type RuleLoop = AbstractRule & {
    type: 'RULE_LOOP'
    rules: RuleGroup[]
}

export type SimpleRule = Debuggable & {
    type: 'RULE'
    conditions: AbstractBracket[]
    actions: AbstractBracket[]
    commands: AbstractCommand[]
    message: Optional<MessageCommand>
}

export type AbstractBracket = Debuggable & {
    modifiers: BRACKET_MODIFIER[]
}

export type SimpleBracket = AbstractBracket & {
    type: 'SIMPLE_BRACKET'
    neighbors: Neighbor[]
}

export type EllipsisBracket = AbstractBracket & {
    type: 'ELLIPSIS_BRACKET'
    beforeNeighbors: Neighbor[]
    afterNeighbors: Neighbor[]
}

export type Neighbor = Debuggable & {
    type: 'NEIGHBOR'
    tilesWithModifier: TileWithModifier[]
}

export type TileWithModifier = Debuggable & {
    type: 'TILE_WITH_MODIFIER'
    modifier: Optional<TILE_MODIFIER>
    tile: string
}


export type AbstractCommand = ASTNode & { }

export type MessageCommand = AbstractCommand & {
    type: 'COMMAND_MESSAGE'
    message: string
}

export type AgainCommand = AbstractCommand & {
    type: 'COMMAND_AGAIN'
}

export type CancelCommand = AbstractCommand & {
    type: 'COMMAND_CANCEL'
}

export type CheckpointCommand = AbstractCommand & {
    type: 'COMMAND_CHECKPOINT'
}

export type RestartCommand = AbstractCommand & {
    type: 'COMMAND_RESTART'
}

export type WinCommand = AbstractCommand & {
    type: 'COMMAND_WIN'
}

export type SFXCommand = AbstractCommand & {
    type: 'COMMAND_SFX'
    sfx: string
}

export type AbstractWinCondition = ASTNode & {
    prefix: string
    sprite: string
}

export type WinConditionSimple = AbstractWinCondition & {
    type: 'WINCONDITION_SIMPLE'
}

export type WinConditionOn = AbstractWinCondition & {
    type: 'WINCONDITION_ON'
    onSprite: string
}

export type AbstractLevel = ASTNode & { }

export type LevelMessage = AbstractLevel & {
    type: 'LEVEL_MESSAGE'
    message: string
}

export type LevelMap = AbstractLevel & {
    type: 'LEVEL_MAP'
    rowData: string[][]
}


export type ASTGame = {
    sprites: AbstractSprite[]
    legendItems: AbstractLegendItem[]
    collisionLayers: CollisionLayer[]
    rules: AbstractRule[]
    winConditions: AbstractWinCondition[]
    levels: AbstractLevel[]
}