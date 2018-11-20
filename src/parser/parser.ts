import * as nearley from 'nearley'
import { lookupColorPalette } from '../colors'
import { Optional } from '../index-browser'
import { CollisionLayer } from '../models/collisionLayer'
import { HexColor, TransparentColor } from '../models/colors'
import { AgainCommand, CancelCommand, CheckpointCommand, MessageCommand, RestartCommand, SoundCommand, WinCommand } from '../models/command'
import { GameData } from '../models/game'
import { LevelMap, MessageLevel } from '../models/level'
import { Dimension, GameMetadata } from '../models/metadata'
import { GameSound, GameSoundMoveDirection, GameSoundMoveSimple, GameSoundNormal, GameSoundSimpleEnum } from '../models/sound'
import { GameLegendTileAnd, GameLegendTileOr, GameLegendTileSimple, GameSprite, GameSpritePixels, GameSpriteSingleColor, IGameTile } from '../models/tile'
import { WinConditionOn, WinConditionSimple } from '../models/winCondition'
import { AbstractRuleish, ASTRule, ASTRuleBracket, ASTRuleBracketEllipsis, ASTRuleBracketNeighbor, ASTRuleGroup, ASTRuleLoop, ASTTileWithModifier } from './astRule'
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

export enum ValidationLevel {
    ERROR,
    WARNING,
    INFO
}

class AstBuilder {
    private readonly code: string
    private readonly tileCache: Map<string, IGameTile>
    private readonly soundCache: Map<string, GameSound>
    constructor(code: string) {
        this.code = code
        this.tileCache = new Map()
        this.soundCache = new Map()
    }
    public build(root: ast.IASTGame<string, string, number | '.'>) {
        const source = this.toSource({ _sourceOffset: 0 })

        const metadata = new GameMetadata()
        root.metadata.forEach((pair) => {
            let value
            if (typeof pair.value === 'object' && pair.value.type) {
                switch (pair.value.type) {
                    case ast.COLOR_TYPE.HEX3:
                    case ast.COLOR_TYPE.HEX6:
                    case ast.COLOR_TYPE.NAME:
                        {
                            const v = pair.value
                            value = this.buildColor(v, metadata.colorPalette)
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

        // assign an index to each GameSprite
        sprites.forEach((sprite, index) => {
            sprite.allSpritesBitSetIndex = index
        })

        // Simplify the rules by de-duplicating them
        const ruleCache = new Map()
        const bracketCache = new Map()
        const neighborCache = new Map()
        const tileCache = new Map()
        const simpleRules = rules.map((rule) => rule.simplify(ruleCache, bracketCache, neighborCache, tileCache))

        const gameData = new GameData(source, root.title, metadata, sprites, legendItems, sounds, collisionLayers, simpleRules, winConditions, levels)
        return { gameData }
    }

    public buildSprite(node: ast.Sprite<number | '.'>, colorPalette: Optional<string>) {
        let ret: GameSprite
        if (node.type === ast.SPRITE_TYPE.WITH_PIXELS) {
            const source = this.toSource(node)
            const colors = node.colors.map((n) => this.buildColor(n, colorPalette))
            const pixels = node.pixels.map((row) => {
                return row.map((col) => {
                    if (col === '.') {
                        return new TransparentColor(source)
                    } else {
                        return colors[col] || new TransparentColor(source)
                    }
                })
            }) // Pixel colors are 0-indexed.

            ret = new GameSpritePixels(source, node.name, node.mapChar, pixels)
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
            case ast.COLOR_TYPE.HEX6:
            case ast.COLOR_TYPE.HEX3:
                return new HexColor(source, node.value)
            case ast.COLOR_TYPE.NAME:
                if (node.value.toUpperCase() === 'TRANSPARENT') {
                    return new TransparentColor(source)
                } else {
                    // Look up the color
                    const hex = lookupColorPalette(currentColorPalette, node.value)
                    if (hex) {
                        return new HexColor(source, hex)
                    } else {
                        return new TransparentColor(source)
                    }
                }
            default:
                throw new Error(`Unsupported type ${node}`)
        }
    }

    public buildLegendItem(node: ast.LegendItem<string>) {
        const source = this.toSource(node)
        switch (node.type) {
            case ast.TILE_TYPE.SIMPLE:
                if (!node.tile) { throw new Error(`BUG!!!!!!`) }
                {
                    const ret = new GameLegendTileSimple(source, node.name, this.cacheGet(node.tile) as GameSprite)
                    this.cacheAdd(node.name, ret)
                    return ret
                }
            case ast.TILE_TYPE.AND:
                if (!node.tiles) { throw new Error(`BUG!!!!!!`) }
                {
                    const ret = new GameLegendTileAnd(source, node.name, node.tiles.map((n) => this.cacheGet(n)))
                    this.cacheAdd(node.name, ret)
                    return ret
                }
            case ast.TILE_TYPE.OR:
                if (!node.tiles) { throw new Error(`BUG!!!!!!`) }
                {
                    const ret = new GameLegendTileOr(source, node.name, node.tiles.map((n) => this.cacheGet(n)))
                    this.cacheAdd(node.name, ret)
                    return ret
                }
            default:
                throw new Error(`Unsupported type ${node}`)
        }
    }

    public buildCollisionLayer(node: ast.CollisionLayer<string>) {
        const source = this.toSource(node)
        return new CollisionLayer(source, node.tiles.map((n) => this.cacheGet(n)))
    }

    public buildSound(node: ast.SoundItem<string>) {
        const source = this.toSource(node)

        switch (node.type) {
            case 'SOUND_SFX':
                const ret = new GameSound(source, node.soundCode)
                this.soundCacheAdd(node.soundEffect, ret)
                return ret
            case 'SOUND_WHEN':
                return new GameSoundSimpleEnum(source, node.when, node.soundCode)
            case 'SOUND_SPRITE_MOVE':
                return new GameSoundMoveSimple(source, this.cacheGet(node.sprite), node.soundCode)
            case 'SOUND_SPRITE_DIRECTION':
                return new GameSoundMoveDirection(source, this.cacheGet(node.sprite), node.spriteDirection, node.soundCode)
            case 'SOUND_SPRITE_EVENT':
                return new GameSoundNormal(source, this.cacheGet(node.sprite), node.spriteEvent, node.soundCode)
            default:
                throw new Error(`Unsupported type ${node}`)
        }
    }

    public buildRuleCollection(node: ast.Rule<
        ast.RuleGroup<
            ast.SimpleRule<
                ast.Bracket<ast.Neighbor<ast.TileWithModifier<string>>>,
                ast.Command<string>
            >
        >,
        ast.SimpleRule<
            ast.Bracket<ast.Neighbor<ast.TileWithModifier<string>>>,
            ast.Command<string>>,
        ast.Bracket<ast.Neighbor<ast.TileWithModifier<string>>>, ast.Command<string>>): AbstractRuleish {

        const source = this.toSource(node)
        switch (node.type) {
            case ast.RULE_TYPE.LOOP:
                return new ASTRuleLoop(source, node.rules.map((n) => this.buildRuleCollection(n)), node.debugFlag)
            case ast.RULE_TYPE.GROUP:
                // Extra checks to make TypeScript happy
                if (node.rules[0]) {
                    const firstRule = node.rules[0]
                    const isRandom = firstRule.isRandom
                    return new ASTRuleGroup(source, !!isRandom, node.rules.map((n) => this.buildRuleCollection(n)), node.debugFlag)
                }
                throw new Error(`BUG!!!!!!`)
            case ast.RULE_TYPE.SIMPLE:
                const commands = [...node.commands]

                return new ASTRule(source, node.directions, !!node.isRandom, node.isLate, node.isRigid,
                    node.conditions.map((n) => this.buildBracket(n)),
                    node.actions.map((n) => this.buildBracket(n)),
                    removeNulls(commands.map((n) => this.buildCommand(n))), node.debugFlag)
            default:
                throw new Error(`Unsupported type ${node}`)
        }
    }

    public buildBracket(node: ast.Bracket<ast.Neighbor<ast.TileWithModifier<string>>>) {
        const source = this.toSource(node)
        switch (node.type) {
            case ast.BRACKET_TYPE.SIMPLE:
                return new ASTRuleBracket(source, node.neighbors.map((n) => this.buildNeighbor(n)), null, node.debugFlag)
            case ast.BRACKET_TYPE.ELLIPSIS:
                return new ASTRuleBracketEllipsis(source, node.beforeNeighbors.map((n) => this.buildNeighbor(n)), node.afterNeighbors.map((n) => this.buildNeighbor(n)), node.debugFlag)
            default:
                throw new Error(`Unsupported type ${node}`)
        }
    }

    public buildNeighbor(node: ast.Neighbor<ast.TileWithModifier<string>>) {
        const source = this.toSource(node)
        return new ASTRuleBracketNeighbor(source, removeNulls(node.tileWithModifiers.map((n) => this.buildTileWithModifier(n))), node.debugFlag)
    }

    public buildTileWithModifier(node: ast.TileWithModifier<string>) {
        const source = this.toSource(node)
        if (!this.cacheHas(node.tile)) {
            return null
        }
        return new ASTTileWithModifier(source, node.direction, node.isNegated, node.isRandom, this.cacheGet(node.tile), node.debugFlag)
    }

    public buildCommand(node: ast.Command<string>) {
        const source = this.toSource(node)
        switch (node.type) {
            case ast.COMMAND_TYPE.MESSAGE:
                return new MessageCommand(source, node.message)
            case ast.COMMAND_TYPE.SFX:
                if (!this.soundCacheHas(node.sound)) {
                    return null
                }
                return new SoundCommand(source, this.soundCacheGet(node.sound))
            case ast.COMMAND_TYPE.CANCEL:
                return new CancelCommand(source)
            case ast.COMMAND_TYPE.AGAIN:
                return new AgainCommand(source)
            case ast.COMMAND_TYPE.WIN:
                return new WinCommand(source)
            case ast.COMMAND_TYPE.RESTART:
                return new RestartCommand(source)
            case ast.COMMAND_TYPE.CHECKPOINT:
                return new CheckpointCommand(source)
            default:
                throw new Error(`Unsupported type ${node}`)
        }
    }

    public buildWinConditon(node: ast.WinCondition<string>) {
        const source = this.toSource(node)
        switch (node.type) {
            case ast.WIN_CONDITION_TYPE.ON:
                return new WinConditionOn(source, node.qualifier, this.cacheGet(node.tile), this.cacheGet(node.onTile))
            case ast.WIN_CONDITION_TYPE.SIMPLE:
                return new WinConditionSimple(source, node.qualifier, this.cacheGet(node.tile))
            default:
                throw new Error(`Unsupported type ${node}`)
        }
    }

    public buildLevel(node: ast.Level<string>) {
        const source = this.toSource(node)
        switch (node.type) {
            case ast.LEVEL_TYPE.MESSAGE:
                return new MessageLevel(source, node.message)
            case ast.LEVEL_TYPE.MAP:
                return new LevelMap(source, node.cells.map((row) => row.map((cell) => this.cacheGet(cell))))
            default:
                throw new Error(`Unsupported type ${node}`)
        }
    }

    private toSource(node: ast.IASTNode) {
        return {
            code: this.code,
            sourceOffset: node._sourceOffset
        }
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
        const results = parser.results as Array<ast.IASTGame<string, string, number | '.'>>
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
        const { gameData } = builder.build(node)

        return { data: gameData }
    }
}

export default new Parser()
