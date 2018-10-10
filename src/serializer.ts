import { Optional } from '.'
import { RULE_DIRECTION } from './'
import { CollisionLayer } from './models/collisionLayer'
import { IColor } from './models/colors'
import { AbstractCommand, AgainCommand, CancelCommand, CheckpointCommand, MessageCommand, RestartCommand, SoundCommand, WinCommand } from './models/command'
import { GameData } from './models/game'
import { ILevel, LevelMap, MessageLevel } from './models/level'
import { Dimension } from './models/metadata'
import { IRule, ISimpleBracket, SimpleBracket, SimpleEllipsisBracket, SimpleNeighbor, SimpleRule, SimpleRuleGroup, SimpleRuleLoop, SimpleTileWithModifier } from './models/rule'
import { GameSound } from './models/sound'
import { GameLegendTileAnd, GameLegendTileOr, GameLegendTileSimple, GameSprite, IGameTile } from './models/tile'

// const EXAMPLE = {
//     metadata: { author: 'Phil' },
//     colors: {
//         123: '#cc99cc'
//     },
//     sounds: {
//         12: { /* ... */ }
//     },
//     collisionLayers: [
//         0, 1, 2
//     ],
//     commands: {
//         901: { type: 'MESSAGE', message: 'hello world'}
//     },

//     sprites: {
//         234: { name, pixels: [[123, 123]], collisionLayer: 0, sounds: {} }
//     },
//     tiles: {
//         345: { type: 'OR', sprites: [234, 234, 234], collisionLayer: 0}
//     },
//     tilesWithModifiers: {
//         456: { direction: 'UP', negation: false, tile: 345}
//     },
//     neighbors: {
//         567: { tilesWithModifiers: [456, 456]}
//     },
//     conditionBrackets: {
//         678: { type: 'NORMAL', direction: 'UP', neighbors: [567]}
// //        6789: { type: 'ELLIPSIS', direction: 'UP', beforeNeighbors: [567], afterNeighbors: [567]}
//     },
//     actionMutations: {
//         abc: {
//             bcd: {type: 'SET', wantsToMove: 'UP', tileOrSprite: 234 },
//             cde: {type: 'REMOVE', tileOrSprite: 345}
//         }
//     },
//     ellipsisBrackets: {
//         6789: { type: 'ELLIPSIS', direction: 'UP', beforeCondition: 678, afterCondition: 678}
//     },
//     bracketPairs: {
//         def: { condition: 678, actionMutations: ['abc']}
//     },
//     simpleRules: {
//         789: { type: 'SIMPLE', bracketPairs: [
//             {conditionBracket: 678, actionMutations: ['bcd']},
//             {conditionBracket: 6789, actionMutations: ['bcd', 'cde'], commands: [890]}
//         ]}
//     },
//     clusteredRules: { // maybe we should make groups and loops separate ()
//         890: { type: 'GROUP', rules: [789, 789, 789, 789]},
//         8901: { type: 'LOOP', rules: [7890, 7890, 7890]}
//     },
//     orderedRules: [
//         890, 8901
//     ],
//     levels: [
//         {type: 'MESSAGE', message: 'hello world'},
//         {type: 'MAP', mapTilesOrSprites: [[345, 234], [345, 345]]}
//     ]
// }

type ColorId = string
type SpriteId = string
type TileId = string
type CollisionId = string
type BracketId = string
type NeighborId = string
type TileWithModifierId = string
type CommandId = string
type RuleId = string
type SoundId = string
// type ActionMutationsId = string
// type BracketPairId = string

interface IGraphSprite {
    name: string,
    pixels: Array<Array<Optional<ColorId>>>,
    collisionLayer: CollisionId,
    // sounds: {}
}
interface IGraphSound { soundCode: number }
type GraphCollisionLayer = 'COLLISIONLAYERTOKENREPLACEME'
enum GraphDirection {
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
    // These only apply to Tiles
    ACTION = 'ACTION',
    STATIONARY = 'STATIONARY',
    RANDOMDIR = 'RANDOMDIR'
}
type GraphTile = {
    type: 'OR'
    sprites: SpriteId[]
    collisionLayers: CollisionId[]
} | {
    type: 'AND'
    sprites: SpriteId[]
    collisionLayers: CollisionId[]
} | {
    type: 'SIMPLE'
    sprite: SpriteId
    collisionLayers: CollisionId[]
} | {
    type: 'SPRITE'
    sprite: SpriteId
    collisionLayer: CollisionId
}
interface IGraphTileWithModifier {
    direction: Optional<GraphDirection>
    negation: boolean,
    tile: TileId
}
interface IGraphNeighbor {
    tileWithModifiers: TileWithModifierId[]
}
type GraphBracket = {
    type: 'NORMAL',
    direction: GraphDirection, // optional when only 1 neighbor
    neighbors: NeighborId[]
} | {
    type: 'ELLIPSIS',
    direction: GraphDirection,
    beforeBracket: BracketId,
    afterBracket: BracketId
}
// type BracketPair = {
//     conditionBracket: BracketId,
//     actionMutations: BracketId, // ActionMutation
//     commands: CommandId[]
// }
type GraphRule = {
    type: 'SIMPLE'
    conditionBrackets: BracketId[],
    actionBrackets: BracketId[],
    commands: CommandId[]
} | {
    type: 'GROUP'
    rules: RuleId[]
} | {
    type: 'LOOP'
    rules: RuleId[]
}
type GraphCommand = {
    type: 'MESSAGE'
    message: string
} | {
    type: 'SOUND'
    sound: SoundId
} | {
    type: 'CHECKPOINT'
} | {
    type: 'RESTART'
} | {
    type: 'CANCEL'
} | {
    type: 'AGAIN'
} | {
    type: 'WIN'
}
type GraphLevel = {
    type: 'MAP'
    cells: TileId[][]
} | {
    type: 'MESSAGE'
    message: string
}

interface IGraphGameMetadata {
    author: Optional<string>
    homepage: Optional<string>
    youtube: Optional<string>
    zoomscreen: Optional<Dimension>
    flickscreen: Optional<Dimension>
    colorPalette: Optional<string>
    backgroundColor: Optional<ColorId>
    textColor: Optional<ColorId>
    realtimeInterval: Optional<number>
    keyRepeatInterval: Optional<number>
    againInterval: Optional<number>
    noAction: boolean
    noUndo: boolean
    runRulesOnLevelStart: Optional<string>
    noRepeatAction: boolean
    throttleMovement: boolean
    noRestart: boolean
    requirePlayerMovement: boolean
    verboseLogging: boolean
}

function toGraphDirection(dir: RULE_DIRECTION): GraphDirection {
    switch (dir) {
        case RULE_DIRECTION.UP: return GraphDirection.UP
        case RULE_DIRECTION.DOWN: return GraphDirection.DOWN
        case RULE_DIRECTION.LEFT: return GraphDirection.LEFT
        case RULE_DIRECTION.RIGHT: return GraphDirection.RIGHT
        case RULE_DIRECTION.ACTION: return GraphDirection.ACTION
        case RULE_DIRECTION.STATIONARY: return GraphDirection.STATIONARY
        case RULE_DIRECTION.RANDOMDIR: return GraphDirection.RANDOMDIR
        default:
            debugger; throw new Error(`BUG: Unsupported direction "${dir}`) // tslint:disable-line:no-debugger
    }
}

class MapWithId<T, TJson> {
    private counter: number
    private prefix: string
    private idMap: Map<T, string>
    private jsonMap: Map<T, TJson>
    constructor(prefix: string) {
        this.counter = 0
        this.prefix = prefix
        this.idMap = new Map()
        this.jsonMap = new Map()
    }

    public set(key: T, value: TJson) {
        if (!this.idMap.has(key)) {
            this.idMap.set(key, this.freshId())
        }
        this.jsonMap.set(key, value)
        return this.getId(key)
    }

    public get(key: T) {
        const value = this.jsonMap.get(key)
        if (!value) {
            debugger; throw new Error(`BUG: Element has not been added to the set`) // tslint:disable-line:no-debugger
        }
        return value
    }

    public getId(key: T) {
        const value = this.idMap.get(key)
        if (!value) {
            debugger; throw new Error(`BUG: Element has not been added to the set`) // tslint:disable-line:no-debugger
        }
        return value
    }

    public toJson() {
        const ret: {[key: string]: TJson} = {}
        for (const [obj, id] of this.idMap) {
            const json = this.jsonMap.get(obj)
            if (!json) {
                debugger; throw new Error(`BUG: Could not find matching json representation for "${id}"`) // tslint:disable-line:no-debugger
            }
            ret[id] = json
        }
        return ret
    }

    private freshId() {
        return `${this.prefix}-${this.counter++}`
    }
}

export default class Serializer {
    private readonly game: GameData
    private readonly colorsMap: Map<string, ColorId>
    private readonly spritesMap: MapWithId<GameSprite, IGraphSprite>
    private readonly soundMap: MapWithId<GameSound, IGraphSound>
    private readonly collisionLayerMap: MapWithId<CollisionLayer, GraphCollisionLayer>
    private readonly conditionBracketsMap: MapWithId<ISimpleBracket, GraphBracket>
    private readonly neighborsMap: MapWithId<SimpleNeighbor, IGraphNeighbor>
    private readonly tileWithModifierMap: MapWithId<SimpleTileWithModifier, IGraphTileWithModifier>
    private readonly tileMap: MapWithId<IGameTile, GraphTile>
    private readonly ruleMap: MapWithId<IRule, GraphRule>
    private readonly commandMap: MapWithId<AbstractCommand, GraphCommand>
    private orderedRules: RuleId[]
    private levels: GraphLevel[]

    constructor(game: GameData) {
        this.game = game
        this.colorsMap = new Map()
        this.spritesMap = new MapWithId('sprite')
        this.soundMap = new MapWithId('sound')
        this.collisionLayerMap = new MapWithId('collision')
        this.conditionBracketsMap = new MapWithId('bracket')
        this.neighborsMap = new MapWithId('neighbor')
        this.tileWithModifierMap = new MapWithId('twm')
        this.tileMap = new MapWithId('tile')
        this.ruleMap = new MapWithId('rule')
        this.commandMap = new MapWithId('command')

        // Load up the colors and sprites
        this.game.collisionLayers.forEach((item) => this.buildCollisionLayer(item))
        this.game.sounds.forEach((item) => {
            this.soundMap.set(item, this.soundToJson(item))
        })
        this.game.objects.forEach((sprite) => {
            this.buildSprite(sprite)
        })
        this.orderedRules = this.game.rules.map((item) => this.recBuildRule(item))

        this.levels = this.game.levels.map((item) => this.buildLevel(item))
    }
    public buildCollisionLayer(item: CollisionLayer) {
        return this.collisionLayerMap.set(item, 'COLLISIONLAYERTOKENREPLACEME')
    }
    public metadataToJson(): IGraphGameMetadata {
        return {
            author: this.game.metadata.author,
            homepage: this.game.metadata.homepage,
            youtube: this.game.metadata.youtube,
            zoomscreen: this.game.metadata.zoomscreen,
            flickscreen: this.game.metadata.flickscreen,
            colorPalette: this.game.metadata.colorPalette,
            backgroundColor: this.game.metadata.backgroundColor ? this.buildColor(this.game.metadata.backgroundColor) : undefined,
            textColor: this.game.metadata.textColor ? this.buildColor(this.game.metadata.textColor) : undefined,
            realtimeInterval: this.game.metadata.realtimeInterval,
            keyRepeatInterval: this.game.metadata.keyRepeatInterval,
            againInterval: this.game.metadata.againInterval,
            noAction: this.game.metadata.noAction,
            noUndo: this.game.metadata.noUndo,
            runRulesOnLevelStart: this.game.metadata.runRulesOnLevelStart,
            noRepeatAction: this.game.metadata.noRepeatAction,
            throttleMovement: this.game.metadata.throttleMovement,
            noRestart: this.game.metadata.noRestart,
            requirePlayerMovement: this.game.metadata.requirePlayerMovement,
            verboseLogging: this.game.metadata.verboseLogging
        }
    }
    public toJson(): IGraphJson {
        const colors: {[key: string]: string} = {}
        for (const [key, value] of this.colorsMap) {
            colors[key] = value
        }
        return {
            version: 1,
            title: this.game.title,
            metadata: this.metadataToJson(),
            colors,
            sounds: this.soundMap.toJson(),
            collisionLayers: this.collisionLayerMap.toJson(),
            commands: this.commandMap.toJson(),
            sprites: this.spritesMap.toJson(),
            tiles: this.tileMap.toJson(),
            tilesWithModifiers: this.tileWithModifierMap.toJson(),
            neighbors: this.neighborsMap.toJson(),
            brackets: this.conditionBracketsMap.toJson(),
            ruleDefinitions: this.ruleMap.toJson(),
            rules: this.orderedRules,
            levels: this.levels
        }
    }
    private buildLevel(level: ILevel): GraphLevel {
        if (level instanceof LevelMap) {
            return {
                type: 'MAP',
                cells: level.getRows().map((row) => row.map((cell) => this.buildTile(cell)))
            }
        } else if (level instanceof MessageLevel) {
            return {
                type: 'MESSAGE',
                message: level.getMessage()
            }
        } else {
            debugger; throw new Error(`BUG: Unsupported level subtype`) // tslint:disable-line:no-debugger
        }
    }
    private recBuildRule(rule: IRule): string {
        if (rule instanceof SimpleRule) {
            return this.ruleMap.set(rule, {
                type: 'SIMPLE',
                conditionBrackets: rule.conditionBrackets.map((item) => this.buildConditionBracket(item)),
                actionBrackets: rule.actionBrackets.map((item) => this.buildConditionBracket(item)),
                commands: rule.commands.map((item) => this.buildCommand(item))
            })
        } else if (rule instanceof SimpleRuleGroup) {
            return this.ruleMap.set(rule, {
                type: 'GROUP',
                rules: rule.getChildRules().map((item) => this.recBuildRule(item))
            })
        } else if (rule instanceof SimpleRuleLoop) {
            return this.ruleMap.set(rule, {
                type: 'LOOP',
                rules: rule.getChildRules().map((item) => this.recBuildRule(item))
            })
        } else {
            debugger; throw new Error(`BUG: Unsupported rule type`) // tslint:disable-line:no-debugger
        }

    }
    private buildCommand(command: AbstractCommand) {
        if (command instanceof MessageCommand) {
            return this.commandMap.set(command, {
                type: 'MESSAGE',
                message: command.getMessage()
            })
        } else if (command instanceof SoundCommand) {
            return this.commandMap.set(command, {
                type: 'SOUND',
                sound: this.soundMap.getId(command.getSound())
            })
        } else if (command instanceof CheckpointCommand) {
            return this.commandMap.set(command, {
                type: 'CHECKPOINT'
            })
        } else if (command instanceof RestartCommand) {
            return this.commandMap.set(command, {
                type: 'RESTART'
            })
        } else if (command instanceof CancelCommand) {
            return this.commandMap.set(command, {
                type: 'CANCEL'
            })
        } else if (command instanceof AgainCommand) {
            return this.commandMap.set(command, {
                type: 'AGAIN'
            })
        } else if (command instanceof WinCommand) {
            return this.commandMap.set(command, {
                type: 'WIN'
            })
        } else {
            debugger; throw new Error(`BUG: Unsupoprted command type`) // tslint:disable-line:no-debugger
        }
    }
    private buildConditionBracket(bracket: ISimpleBracket): BracketId {
        if (bracket instanceof SimpleEllipsisBracket) {
            const b = bracket
            const before = this.buildConditionBracket(b.beforeEllipsisBracket)
            const after = this.buildConditionBracket(b.afterEllipsisBracket)
            return this.conditionBracketsMap.set(bracket, {
                type: 'ELLIPSIS',
                direction: toGraphDirection(b.direction),
                beforeBracket: before,
                afterBracket: after
            })
        } else if (bracket instanceof SimpleBracket) {
            return this.conditionBracketsMap.set(bracket, {
                type: 'NORMAL',
                direction: toGraphDirection(bracket.direction),
                neighbors: bracket.getNeighbors().map((item) => this.buildNeighbor(item))
            })
        } else {
            debugger; throw new Error(`BUG: Unsupported bracket type`) // tslint:disable-line:no-debugger
        }
    }
    private buildNeighbor(neighbor: SimpleNeighbor): NeighborId {
        return this.neighborsMap.set(neighbor, {
            tileWithModifiers: [...neighbor._tilesWithModifier].map((item) => this.buildTileWithModifier(item))
        })
    }
    private buildTileWithModifier(t: SimpleTileWithModifier): TileWithModifierId {
        return this.tileWithModifierMap.set(t, {
            direction: t._direction ? toGraphDirection(t._direction) : null,
            negation: t._isNegated,
            tile: this.buildTile(t._tile)
        })
    }
    private buildTile(tile: IGameTile): TileId {
        if (tile instanceof GameLegendTileOr) {
            return this.tileMap.set(tile, {
                type: 'OR',
                sprites: tile.getSprites().map((item) => this.buildSprite(item)),
                collisionLayers: tile.getCollisionLayers().map((item) => this.buildCollisionLayer(item))
            })
        } else if (tile instanceof GameLegendTileAnd) {
            return this.tileMap.set(tile, {
                type: 'AND',
                sprites: tile.getSprites().map((item) => this.buildSprite(item)),
                collisionLayers: tile.getCollisionLayers().map((item) => this.buildCollisionLayer(item))
            })
        } else if (tile instanceof GameLegendTileSimple) {
            return this.tileMap.set(tile, {
                type: 'SIMPLE',
                sprite: this.buildSprite(tile.getSprites()[0]),
                collisionLayers: tile.getCollisionLayers().map((item) => this.buildCollisionLayer(item))
            })
        } else if (tile instanceof GameSprite) {
            return this.tileMap.set(tile, {
                type: 'SPRITE',
                sprite: this.buildSprite(tile),
                collisionLayer: this.buildCollisionLayer(tile.getCollisionLayer())
            })
        } else {
            debugger; throw new Error(`BUG: Invalid tile type`) // tslint:disable-line:no-debugger
        }
    }
    private soundToJson(sound: GameSound): IGraphSound {
        return {
            soundCode: sound.soundCode
        }
    }
    private buildSprite(sprite: GameSprite): SpriteId {
        const { spriteHeight, spriteWidth } = this.game.getSpriteSize()
        return this.spritesMap.set(sprite, {
            name: sprite.getName(),
            collisionLayer: this.collisionLayerMap.getId(sprite.getCollisionLayer()),
            pixels: sprite.getPixels(spriteHeight, spriteWidth).map((row) => row.map((pixel) => {
                if (pixel.isTransparent()) {
                    return null
                } else {
                    return this.buildColor(pixel)
                }
            }))
        })
    }
    private buildColor(color: IColor) {
        const hex = color.toHex()
        this.colorsMap.set(hex, hex)
        return hex
    }
}

interface IGraphJson {
    version: number,
    title: string,
    metadata: IGraphGameMetadata,
    colors: {[key: string]: string},
    sounds: {[key: string]: IGraphSound},
    collisionLayers: {[key: string]: GraphCollisionLayer},
    commands: {[key: string]: GraphCommand},
    sprites: {[key: string]: IGraphSprite},
    tiles: {[key: string]: GraphTile},
    tilesWithModifiers: {[key: string]: IGraphTileWithModifier},
    neighbors: {[key: string]: IGraphNeighbor},
    brackets: {[key: string]: GraphBracket},
    ruleDefinitions: {[key: string]: GraphRule},
    rules: RuleId[],
    levels: GraphLevel[]
}
