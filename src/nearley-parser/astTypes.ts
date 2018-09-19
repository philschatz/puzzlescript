import { Optional } from '..'
import { WIN_QUALIFIER } from '../models/winCondition'
import { AST_RULE_MODIFIER } from '../parser/astRule'
import { DEBUG_FLAG } from '../util'

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
    ARROW_ANY = 'ARROW_ANY'
}

// export enum RULE_MODIFIER {
//     RANDOM = 'RANDOM',
//     UP = 'UP',
//     DOWN = 'DOWN',
//     LEFT = 'LEFT',
//     RIGHT = 'RIGHT',
//     VERTICAL = 'VERTICAL',
//     HORIZONTAL = 'HORIZONTAL',
//     ORTHOGONAL = 'ORTHOGONAL',

//     LATE = 'LATE',
//     RIGID = 'RIGID',
// }

export enum SOUND_WHEN {
    RESTART = 'RESTART',
    UNDO = 'UNDO',
    TITLESCREEN = 'TITLESCREEN',
    STARTGAME = 'STARTGAME',
    STARTLEVEL = 'STARTLEVEL',
    ENDLEVEL = 'ENDLEVEL',
    ENDGAME = 'ENDGAME',
    SHOWMESSAGE = 'SHOWMESSAGE',
    CLOSEMESSAGE = 'CLOSEMESSAGE'
}

export enum SOUND_SPRITE_DIRECTION {
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    HORIZONTAL = 'HORIZONTAL',
    VERTICAL = 'VERTICAL'
}

export enum SOUND_SPRITE_EVENT {
    CREATE = 'CREATE',
    DESTROY = 'DESTROY',
    CANTMOVE = 'CANTMOVE'
}

export interface IASTNode {
    type: string
    sourceOffset: number
}
export type IColor = IASTNode & {
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

export type AbstractSprite = IASTNode & {
    name: string
    mapChar: Optional<string>
    colors: IColor[]
    // Subclass values
    pixels: Optional<Array<Array<number | '.'>>>
}
export type SpriteNoPixels = AbstractSprite & {
    type: 'SPRITE_NO_PIXELS'
}

export type SpriteWithPixels = AbstractSprite & {
    type: 'SPRITE_WITH_PIXELS'
    pixels: Array<Array<number | '.'>>
}

export type AbstractLegendItem<TileRef> = IASTNode & {
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

export type AbstractSound<TileRef> = IASTNode & {
    soundCode: number
    // Subclass values
    when: Optional<SOUND_WHEN>
    sfx: Optional<string>
    sprite: Optional<TileRef>
    spriteDirection: Optional<SOUND_SPRITE_DIRECTION>
    spriteEvent: Optional<SOUND_SPRITE_EVENT>
}

export type SoundWhen<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_WHEN'
    when: SOUND_WHEN
}

export type SoundSfx<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_SFX'
    sfx: string
}

export type SoundSpriteMoveDirection<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_SPRITE_DIRECTION'
    sprite: TileRef
    spriteDirection: SOUND_SPRITE_DIRECTION
}

export type SoundSpriteMove<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_SPRITE_MOVE'
    sprite: TileRef
}

export type SoundSpriteEvent<TileRef> = AbstractSound<TileRef> & {
    type: 'SOUND_SPRITE_EVENT'
    sprite: TileRef
    spriteEvent: SOUND_SPRITE_EVENT
}

export type CollisionLayer<TileRef> = IASTNode & {
    type: 'COLLISION_LAYER'
    tiles: TileRef[]
}

// Rules have an optional debugFlag
export type Debuggable = IASTNode & {
    debugFlag: Optional<DEBUG_FLAG>
}

export type AbstractRule<TileRef> = Debuggable & {
    // Subclass values
    rules: Optional<Array<AbstractRule<TileRef>>>
    conditions: Optional<Array<AbstractBracket<TileRef>>>
    actions: Optional<Array<AbstractBracket<TileRef>>>
    commands: Optional<AbstractCommand[]>
    message: Optional<MessageCommand>
}

export type RuleGroup<TileRef> = AbstractRule<TileRef> & {
    type: 'RULE_GROUP'
    rules: Array<Rule<TileRef>>
}

export type RuleLoop<TileRef> = AbstractRule<TileRef> & {
    type: 'RULE_LOOP'
    rules: Array<RuleGroup<TileRef>>
}

export type Rule<TileRef> = AbstractRule<TileRef> & {
    type: 'RULE'
    modifiers: AST_RULE_MODIFIER[]
    conditions: Array<AbstractBracket<TileRef>>
    actions: Array<AbstractBracket<TileRef>>
    commands: AbstractCommand[]
    message: Optional<MessageCommand>
}

export type AbstractBracket<TileRef> = Debuggable & {
    // Subclass values
    neighbors: Optional<Array<Neighbor<TileRef>>>
    beforeNeighbors: Optional<Array<Neighbor<TileRef>>>
    afterNeighbors: Optional<Array<Neighbor<TileRef>>>
}

export type SimpleBracket<TileRef> = AbstractBracket<TileRef> & {
    type: 'BRACKET'
    neighbors: Array<Neighbor<TileRef>>
}

export type EllipsisBracket<TileRef> = AbstractBracket<TileRef> & {
    type: 'ELLIPSIS_BRACKET'
    beforeNeighbors: Array<Neighbor<TileRef>>
    afterNeighbors: Array<Neighbor<TileRef>>
}

export type Neighbor<TileRef> = Debuggable & {
    type: 'NEIGHBOR'
    tilesWithModifier: Array<TileWithModifier<TileRef>>
}

export type TileWithModifier<TileRef> = Debuggable & {
    type: 'TILE_WITH_MODIFIER'
    modifier: Optional<TILE_MODIFIER>
    tile: TileRef
}

export type AbstractCommand = IASTNode & {
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

export type AbstractWinCondition<TileRef> = IASTNode & {
    qualifier: WIN_QUALIFIER
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

export type AbstractLevel<TileRef> = IASTNode & {
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

export interface IDimension {
    type: 'WIDTH_AND_HEIGHT'
    width: number
    height: number
}

export interface IASTGame<TileRef> {
    title: string
    metadata: Array<{type: string, value: string | boolean | IDimension | ColorName | ColorHex3 | ColorHex6}>
    sprites: AbstractSprite[]
    legendItems: Array<AbstractLegendItem<TileRef>>
    collisionLayers: Array<CollisionLayer<TileRef>>
    sounds: Array<AbstractSound<TileRef>>
    rules: Array<AbstractRule<TileRef>>
    winConditions: Array<AbstractWinCondition<TileRef>>
    levels: Array<AbstractLevel<TileRef>>
}
