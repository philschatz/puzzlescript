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

export enum SOUND_WHEN {
    RESTART = 'RESTART',
    UNDO = 'UNDO',
    TITLESCREEN = 'TITLESCREEN',
    STARTGAME = 'STARTGAME',
    STARTLEVEL = 'STARTLEVEL',
    ENDLEVEL = 'ENDLEVEL',
    ENDGAME = 'ENDGAME',
    SHOWMESSAGE = 'SHOWMESSAGE',
    CLOSEMESSAGE = 'CLOSEMESSAGE',
}

export enum SOUND_SPRITE_DIRECTION {
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    HORIZONTAL = 'HORIZONTAL',
    VERTICAL = 'VERTICAL',
}

export enum SOUND_SPRITE_EVENT {
    CREATE = 'CREATE',
    DESTROY = 'DESTROY',
    CANTMOVE = 'CANTMOVE',
}

export enum WIN_CONDITION {
    ON = 'ON',
    NO = 'NO',
    ALL = 'ALL',
    ANY = 'ANY',
    SOME = 'SOME',
}


export type ASTNode = {
    type: string
    sourceOffset: number
}
export type IColor = ASTNode & {
    value: string
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
    // Subclass values
    pixels: Optional<(number | '.')[][]>
}
export type SpriteNoPixels = AbstractSprite & {
    type: 'SPRITE_NO_PIXELS'
}

export type SpriteWithPixels = AbstractSprite & {
    type: 'SPRITE_WITH_PIXELS'
    pixels: (number | '.')[][]
}


export type AbstractLegendItem<TileRef> = ASTNode & {
    name: string
    // Subclass values
    value: Optional<TileRef>
    values: Optional<TileRef[]>
}

export type SimpleLegendItem<TileRef> = AbstractLegendItem<TileRef> & {
    type: 'LEGEND_ITEM_SIMPLE'
    value: TileRef
}

export type OrLegendItem<TileRef> = AbstractLegendItem<TileRef> & {
    type: 'LEGEND_ITEM_OR'
    values: TileRef[]
}

export type AndLegendItem<TileRef> = AbstractLegendItem<TileRef> & {
    type: 'LEGEND_ITEM_AND'
    values: TileRef[]
}


export type AbstractSound<TileRef> = ASTNode & {
    soundCode: number
    // Subclass values
    when: Optional<SOUND_WHEN>
    sfx: Optional<string>
    sprite: Optional<TileRef>
    spriteDirection: Optional<SOUND_SPRITE_DIRECTION>
    spriteEvent: Optional<SOUND_SPRITE_EVENT>
}

export type SoundEnum<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_ENUM'
    when: SOUND_WHEN
}

export type SoundSfx<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_SFX'
    sfx: string
}

export type SoundMoveDirection<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_MOVE_DIRECTION'
    sprite: TileRef
    spriteDirection: SOUND_SPRITE_DIRECTION
}

export type SoundMoveSimple<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_MOVE_SIMPLE'
    sprite: TileRef
}

export type SoundSpriteEvent<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_SPRITE_EVENT'
    sprite: TileRef
    spriteEvent: SOUND_SPRITE_EVENT
}


export type CollisionLayer<TileRef> = ASTNode & {
    type: 'COLLISION_LAYER'
    tiles: TileRef[]
}

// Rules have an optional debugFlag
export type Debuggable = ASTNode & {
    debugFlag: Optional<DEBUG_FLAG>
}

export type AbstractRule<TileRef> = Debuggable & {
    // Subclass values
    rules: Optional<AbstractRule<TileRef>[]>
    conditions: Optional<AbstractBracket<TileRef>[]>
    actions: Optional<AbstractBracket<TileRef>[]>
    commands: Optional<AbstractCommand[]>
    message: Optional<MessageCommand>
}

export type RuleGroup<TileRef> = AbstractRule<TileRef> & {
    type: 'RULE_GROUP'
    rules: Rule<TileRef>[]
}

export type RuleLoop<TileRef> = AbstractRule<TileRef> & {
    type: 'RULE_LOOP'
    rules: RuleGroup<TileRef>[]
}

export type Rule<TileRef> = AbstractRule<TileRef> & {
    type: 'RULE'
    conditions: AbstractBracket<TileRef>[]
    actions: AbstractBracket<TileRef>[]
    commands: AbstractCommand[]
    message: Optional<MessageCommand>
}

export type AbstractBracket<TileRef> = Debuggable & {
    modifiers: BRACKET_MODIFIER[]
    // Subclass values
    neighbors: Optional<Neighbor<TileRef>[]>
    beforeNeighbors: Optional<Neighbor<TileRef>[]>
    afterNeighbors: Optional<Neighbor<TileRef>[]>
}

export type SimpleBracket<TileRef> = AbstractBracket<TileRef> & {
    type: 'SIMPLE_BRACKET'
    neighbors: Neighbor<TileRef>[]
}

export type EllipsisBracket<TileRef> = AbstractBracket<TileRef> & {
    type: 'ELLIPSIS_BRACKET'
    beforeNeighbors: Neighbor<TileRef>[]
    afterNeighbors: Neighbor<TileRef>[]
}

export type Neighbor<TileRef> = Debuggable & {
    type: 'NEIGHBOR'
    tilesWithModifier: TileWithModifier<TileRef>[]
}

export type TileWithModifier<TileRef> = Debuggable & {
    type: 'TILE_WITH_MODIFIER'
    modifier: Optional<TILE_MODIFIER>
    tile: TileRef
}


export type AbstractCommand = ASTNode & {
    // Subclass values
    message: Optional<string>
    sfx: Optional<string>
}

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

export type AbstractWinCondition<TileRef> = ASTNode & {
    condition: WIN_CONDITION
    sprite: TileRef
    // Subclass values
    onSprite: Optional<TileRef>
}

export type WinConditionSimple<TileRef> = AbstractWinCondition<TileRef> & {
    type: 'WINCONDITION_SIMPLE'
}

export type WinConditionOn<TileRef> = AbstractWinCondition<TileRef> & {
    type: 'WINCONDITION_ON'
    onSprite: TileRef
}

export type AbstractLevel<TileRef> = ASTNode & {
    // Subclass values
    message: Optional<string>
    rowData: TileRef[][]
}

export type LevelMessage<TileRef> = AbstractLevel<TileRef> & {
    type: 'LEVEL_MESSAGE'
    message: string
}

export type LevelMap<TileRef> = AbstractLevel<TileRef> & {
    type: 'LEVEL_MAP'
    rowData: TileRef[][]
}


export type ASTGame<TileRef> = {
    sprites: AbstractSprite[]
    legendItems: AbstractLegendItem<TileRef>[]
    collisionLayers: CollisionLayer<TileRef>[]
    sounds: AbstractSound<TileRef>[]
    rules: AbstractRule<TileRef>[]
    winConditions: AbstractWinCondition<TileRef>[]
    levels: AbstractLevel<TileRef>[]
}