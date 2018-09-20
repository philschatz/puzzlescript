import * as nearley from 'nearley'
import { lookupColorPalette } from '../colors'
import { Optional } from '../index-browser'
import { IGameCode } from '../models/BaseForLines'
import { CollisionLayer } from '../models/collisionLayer'
import { HexColor, TransparentColor } from '../models/colors'
import { AgainCommand, CancelCommand, CheckpointCommand, MessageCommand, RestartCommand, SoundCommand, WinCommand } from '../models/command'
import { GameData } from '../models/game'
import { LevelMap, MessageLevel } from '../models/level'
import { Dimension, GameMetadata } from '../models/metadata'
import { GameSound, GameSoundMoveDirection, GameSoundMoveSimple, GameSoundNormal, GameSoundSimpleEnum } from '../models/sound'
import { GameLegendTileAnd, GameLegendTileOr, GameLegendTileSimple, GameSprite, GameSpritePixels, GameSpriteSingleColor, IGameTile } from '../models/tile'
import { WinConditionOn, WinConditionSimple } from '../models/winCondition'
import { AbstractRuleish, AST_RULE_MODIFIER, ASTRule, ASTRuleBracket, ASTRuleBracketEllipsis, ASTRuleBracketNeighbor, ASTRuleGroup, ASTRuleLoop, ASTTileWithModifier } from './astRule'
import * as ast from './astTypes'
import * as compiledGrammar from './grammar'

function removeNulls<T>(ary: Array<T | null>) {
    // return ary.filter(a => !!a)

    // TypeScript-friendly version
    const ret = []
    for (const item of ary) {
        if (item) {
            ret.push(item)
        }
    }
    return ret
}

export class ValidationMessage {
    public readonly source: IGameCode
    public readonly level: ValidationLevel
    public readonly message: string
    constructor(source: IGameCode, level: ValidationLevel, message: string) {
        this.source = source
        this.level = level
        this.message = message
    }

    public toKey() {
        return `[${this.source.toString()}] [${this.level}] [${this.message}]`
    }
}

export type AddValidationFunc = (message: ValidationMessage) => void

export enum ValidationLevel {
    ERROR,
    WARNING,
    INFO
}

class AstBuilder {
    private validationMessages: Map<string, ValidationMessage>
    private readonly code: string
    private readonly tileCache: Map<string, IGameTile>
    private readonly soundCache: Map<string, GameSound>
    constructor(code: string) {
        this.code = code
        this.tileCache = new Map()
        this.soundCache = new Map()
        this.validationMessages = new Map()
    }
    public build(root: ast.IASTGame<string>) {
        this.validationMessages.clear() // clear because we are parsing
        const source = this.toSource({ type: 'GAME', sourceOffset: 0 })

        const metadata = new GameMetadata()
        root.metadata.forEach((pair) => {
            let value
            if (typeof pair.value === 'object' && pair.value.type) {
                switch (pair.value.type) {
                    case 'COLOR_HEX3':
                    case 'COLOR_HEX6':
                    case 'COLOR_NAME':
                        {
                            const v = pair.value
                            value = this.buildColor(v as ast.ColorName, metadata.colorPalette)
                        }
                        break
                    case 'WIDTH_AND_HEIGHT':
                        {
                            const v = pair.value
                            const v2 = v
                            value = new Dimension(v2.width, v2.height)
                        }
                        break
                    default:
                        throw new Error(`BUG: Invalid type at this point in time: ${pair.value}`)
                }
            } else {
                value = pair.value
            }
            metadata._setValue(pair.type, value)
        })

        const sprites = root.sprites.map((n) => this.buildSprite(n, metadata.colorPalette))
        // Load the legend items up (used in Rules and Levels later on)
        const legendItems = root.legendItems.map((n) => this.buildLegendItem(n))
        const sounds = root.sounds.map((n) => this.buildSound(n))

        const collisionLayers = root.collisionLayers.map((n) => this.buildCollisionLayer(n))
        const rules = root.rules.map((n) => this.buildRuleCollection(n))
        const winConditions = root.winConditions.map((n) => this.buildWinConditon(n))
        const levels = root.levels.map((n) => this.buildLevel(n))
        const gameData = new GameData(source, root.title, metadata, sprites, legendItems, sounds, collisionLayers, rules, winConditions, levels)
        const validationMessages = this.getValidationMessages()
        return { gameData, validationMessages }
    }

    public buildSprite(node: ast.AbstractSprite, colorPalette: Optional<string>) {
        let ret: GameSprite
        if (node.pixels) {
            ret = new GameSpritePixels(this.toSource(node), node.name, node.mapChar, node.colors.map((n) => this.buildColor(n, colorPalette)), node.pixels)
        } else {
            ret = new GameSpriteSingleColor(this.toSource(node), node.name, node.mapChar, node.colors.map((n) => this.buildColor(n, colorPalette)))
        }
        this.cacheAdd(node.name, ret)
        if (node.mapChar) {
            this.cacheAdd(node.mapChar, ret)
        }
        return ret
    }

    public buildColor(node: ast.IColor, colorPalette: Optional<string>) {
        const source = this.toSource(node)
        const currentColorPalette = colorPalette || 'arnecolors'
        switch (node.type) {
            case 'COLOR_HEX6':
            case 'COLOR_HEX3':
                return new HexColor(source, node.value)
            case 'COLOR_NAME':
                if (node.value.toUpperCase() === 'TRANSPARENT') {
                    return new TransparentColor(source)
                } else {
                    // Look up the color
                    const hex = lookupColorPalette(currentColorPalette, node.value)
                    if (hex) {
                        return new HexColor(source, hex)
                    } else {
                        this.addValidationMessage(source, ValidationLevel.WARNING, `ERROR: Invalid color name ${node.value}`)
                        return new TransparentColor(source)
                    }
                }
            default:
                throw new Error(`Unsupported type ${node.type}`)
        }
    }

    public buildLegendItem(node: ast.AbstractLegendItem<string>) {
        const source = this.toSource(node)
        switch (node.type) {
            case 'LEGEND_ITEM_SIMPLE':
                if (!node.value) { throw new Error(`BUG!!!!!!`) }
                {
                    const ret = new GameLegendTileSimple(source, node.name, this.cacheGet(node.value) as GameSprite)
                    this.cacheAdd(node.name, ret)
                    return ret
                }
            case 'LEGEND_ITEM_AND':
                if (!node.values) { throw new Error(`BUG!!!!!!`) }
                {
                    const ret = new GameLegendTileAnd(source, node.name, node.values.map((n) => this.cacheGet(n)))
                    this.cacheAdd(node.name, ret)
                    return ret
                }
            case 'LEGEND_ITEM_OR':
                if (!node.values) { throw new Error(`BUG!!!!!!`) }
                {
                    const ret = new GameLegendTileOr(source, node.name, node.values.map((n) => this.cacheGet(n)))
                    this.cacheAdd(node.name, ret)
                    return ret
                }
            default:
                throw new Error(`Unsupported type ${node.type}`)
        }
    }

    public buildCollisionLayer(node: ast.CollisionLayer<string>) {
        const source = this.toSource(node)
        const addValidation = (msg: ValidationMessage) => {
            this.addValidationMessage(msg.source, msg.level, msg.message)
        }
        return new CollisionLayer(source, node.tiles.map((n) => this.cacheGet(n)), addValidation)
    }

    public buildSound(node: ast.AbstractSound<string>) {
        const source = this.toSource(node)

        switch (node.type) {
            case 'SOUND_SFX':
                {
                    const n = node as ast.SoundSfx<string>
                    const ret = new GameSound(source, node.soundCode)
                    this.soundCacheAdd(n.sfx, ret)
                    return ret
                }
            case 'SOUND_WHEN':
                {
                    const n = node as ast.SoundWhen<string>
                    return new GameSoundSimpleEnum(source, n.when, node.soundCode)
                }
            case 'SOUND_SPRITE_MOVE':
                {
                    const n = node as ast.SoundSpriteMove<string>
                    return new GameSoundMoveSimple(source, this.cacheGet(n.sprite), node.soundCode)
                }
            case 'SOUND_SPRITE_DIRECTION':
                {
                    const n = node as ast.SoundSpriteMoveDirection<string>
                    return new GameSoundMoveDirection(source, this.cacheGet(n.sprite), n.spriteDirection, node.soundCode)
                }
            case 'SOUND_SPRITE_EVENT':
                {
                    const n = node as ast.SoundSpriteEvent<string>
                    return new GameSoundNormal(source, this.cacheGet(n.sprite), n.spriteEvent, node.soundCode)
                }
            default:
                throw new Error(`Unsupported type ${node.type}`)
        }
    }

    public buildRuleCollection(node: ast.AbstractRule<string>): AbstractRuleish {
        const source = this.toSource(node)
        switch (node.type) {
            case 'RULE_LOOP':
                if (!node.rules) { throw new Error(`BUG!!!!!!`) }
                return new ASTRuleLoop(source, node.rules.map((n) => this.buildRuleCollection(n)), node.debugFlag)
            case 'RULE_GROUP':
                if (!node.rules) { throw new Error(`BUG!!!!!!`) }
                // Extra checks to make TypeScript happy
                if (node.rules[0]) {
                    const firstRule = node.rules[0] as ast.Rule<string>
                    const isRandom = firstRule.modifiers.indexOf(AST_RULE_MODIFIER.RANDOM) >= 0
                    return new ASTRuleGroup(source, isRandom, node.rules.map((n) => this.buildRuleCollection(n)), node.debugFlag)
                }
                throw new Error(`BUG!!!!!!`)
            case 'RULE':
                const node2 = node as ast.Rule<string>
                const commands = [...node2.commands]
                // TODO: Maybe do this step in the parser. No need for message to be a separate field
                if (node2.message) {
                    commands.push(node2.message)
                }

                return new ASTRule(source, node2.modifiers,
                    node2.conditions.map((n) => this.buildBracket(n)),
                    node2.actions.map((n) => this.buildBracket(n)),
                    removeNulls(commands.map((n) => this.buildCommand(n))), node.debugFlag)
            default:
                throw new Error(`Unsupported type ${node.type}`)
        }
    }

    public buildBracket(node: ast.AbstractBracket<string>) {
        const source = this.toSource(node)
        switch (node.type) {
            case 'BRACKET':
                {
                    const node2 = node as ast.SimpleBracket<string>
                    return new ASTRuleBracket(source, node2.neighbors.map((n) => this.buildNeighbor(n)), null, node.debugFlag)
                }
            case 'ELLIPSIS_BRACKET':
                {
                    const node2 = node as ast.EllipsisBracket<string>
                    return new ASTRuleBracketEllipsis(source, node2.beforeNeighbors.map((n) => this.buildNeighbor(n)), node2.afterNeighbors.map((n) => this.buildNeighbor(n)), node.debugFlag)
                }
            default:
                throw new Error(`Unsupported type ${node.type}`)
        }
    }

    public buildNeighbor(node: ast.Neighbor<string>) {
        const source = this.toSource(node)
        return new ASTRuleBracketNeighbor(source, removeNulls(node.tilesWithModifier.map((n) => this.buildTileWithModifier(n))), node.debugFlag)
    }

    public buildTileWithModifier(node: ast.TileWithModifier<string>) {
        const source = this.toSource(node)
        if (!this.cacheHas(node.tile)) {
            this.addValidationMessage(source, ValidationLevel.ERROR, `Could not find tile named ${node.tile}`)
            return null
        }
        return new ASTTileWithModifier(source, node.modifier, this.cacheGet(node.tile), node.debugFlag)
    }

    public buildCommand(node: ast.AbstractCommand) {
        const source = this.toSource(node)
        switch (node.type) {
            case 'COMMAND_MESSAGE':
                {
                    const n = node as ast.MessageCommand
                    return new MessageCommand(source, n.message)
                }
            case 'COMMAND_SFX':
                {
                    const n = node as ast.SFXCommand
                    if (!this.soundCacheHas(n.sfx)) {
                        this.addValidationMessage(source, ValidationLevel.ERROR, `Could not find sound named ${n.sfx}`)
                        return null
                    }
                    return new SoundCommand(source, this.soundCacheGet(n.sfx))
                }
            case 'COMMAND_CANCEL':
                return new CancelCommand(source)
            case 'COMMAND_AGAIN':
                return new AgainCommand(source)
            case 'COMMAND_WIN':
                return new WinCommand(source)
            case 'COMMAND_RESTART':
                return new RestartCommand(source)
            case 'COMMAND_CHECKPOINT':
                return new CheckpointCommand(source)
            default:
                throw new Error(`Unsupported type ${node.type}`)
        }
    }

    public buildWinConditon(node: ast.AbstractWinCondition<string>) {
        const source = this.toSource(node)
        switch (node.type) {
            case 'WINCONDITION_ON':
                {
                    const n = node as ast.WinConditionOn<string>
                    return new WinConditionOn(source, n.qualifier, this.cacheGet(n.sprite), this.cacheGet(n.onSprite))
                }
            case 'WINCONDITION_SIMPLE':
                {
                    const n = node as ast.WinConditionSimple<string>
                    return new WinConditionSimple(source, n.qualifier, this.cacheGet(n.sprite))
                }
            default:
                throw new Error(`Unsupported type ${node.type}`)
        }
    }

    public buildLevel(node: ast.AbstractLevel<string>) {
        const source = this.toSource(node)
        switch (node.type) {
            case 'LEVEL_MESSAGE':
                {
                    const n = node as ast.LevelMessage<string>
                    return new MessageLevel(source, n.message)
                }
            case 'LEVEL_MAP':
                {
                    const n = node as ast.LevelMap<string>
                    return new LevelMap(source, n.rowData.map((row) => row.map((cell) => this.cacheGet(cell))))
                }
            default:
                throw new Error(`Unsupported type ${node.type}`)
        }
    }

    private toSource(node: ast.IASTNode) {
        return {
            code: this.code,
            sourceOffset: node.sourceOffset
        }
    }

    private addValidationMessage(source: IGameCode, level: ValidationLevel, message: string) {
        const msg = new ValidationMessage(source, level, message)
        if (!this.validationMessages.has(msg.toKey())) {
            this.validationMessages.set(msg.toKey(), msg)
        }
    }

    private getValidationMessages() {
        return [...this.validationMessages.values()]
    }

    private cacheAdd(name: string, value: IGameTile) {
        if (this.tileCache.has(name.toLowerCase())) {
            throw new Error(`BUG??? duplicate definition of ${name}`)
        }
        this.tileCache.set(name.toLowerCase(), value)
    }

    private cacheGet(name: string) {
        const value = this.tileCache.get(name.toLowerCase())
        if (value) {
            return value
        } else {
            throw new Error(`BUG: Could not find tile named ${name}`)
        }
    }

    private cacheHas(name: string) {
        return this.tileCache.has(name.toLowerCase())
    }

    private soundCacheAdd(name: string, value: GameSound) {
        if (this.soundCache.has(name.toLowerCase())) {
            throw new Error(`BUG??? duplicate definition of ${name}`)
        }
        this.soundCache.set(name.toLowerCase(), value)
    }

    private soundCacheGet(name: string) {
        const value = this.soundCache.get(name.toLowerCase())
        if (value) {
            return value
        } else {
            throw new Error(`BUG: Could not find sound named ${name}`)
        }
    }

    private soundCacheHas(name: string) {
        return this.soundCache.has(name.toLowerCase())
    }
}

class Parser {
    private grammar: nearley.Grammar
    constructor() {
        this.grammar = nearley.Grammar.fromCompiled(compiledGrammar)
    }
    public parseToAST(code: string) {
        const parser = new nearley.Parser(this.grammar)
        parser.feed(code)
        parser.feed('\n')
        parser.finish()
        const results = parser.results as Array<ast.IASTGame<string>>
        if (results.length === 1) {
            return results[0]
        } else if (results.length === 0) {
            throw new Error(`ERROR: Could not parse`)
        } else {
            throw new Error(`AMBIGUOUS: has ${results.length} results`)
        }

    }
    public parse(code: string) {
        const node = this.parseToAST(code)

        const builder = new AstBuilder(code)
        const { gameData, validationMessages } = builder.build(node)

        return { data: gameData, validationMessages }
    }
}

export default new Parser()
