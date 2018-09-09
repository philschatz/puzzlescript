import * as ohm from 'ohm-js'
import { AbstractCommand, AgainCommand, CancelCommand, CheckpointCommand, COMMAND_TYPE, MessageCommand, RestartCommand, SoundCommand, WinCommand } from '../models/command'
import { IGameTile } from '../models/tile'
import { _flatten, DEBUG_FLAG } from '../util'
import {
    AST_RULE_MODIFIER,
    ASTRule,
    ASTRuleBracket,
    ASTRuleBracketEllipsis,
    ASTRuleBracketNeighbor,
    ASTRuleBracketNeighborHack,
    ASTRuleGroup,
    ASTRuleLoop,
    ASTTileWithModifier,
    IASTRuleBracket } from './astRule'
import { IParseable } from './gameGrammar'
import { LookupHelper } from './lookup'

export const RULE_GRAMMAR = `
    RuleItem
        = RuleLoop
        | RuleGroup // Do this before Rule because we need to look for a "+" on the following Rule
        | Rule

    Rule = t_DEBUGGER? (RuleModifierLeft* RuleBracket)+ "->" (RuleModifier? RuleBracket)* RuleCommand* MessageCommand? lineTerminator+

    RuleBracket
        = EllipsisRuleBracket
        | NormalRuleBracket

    NormalRuleBracket = "[" NonemptyListOf<RuleBracketNeighbor,
    "|"> t_AGAIN? "]" t_DEBUGGER? // t_AGAIN is a HACK. It should be in the list of commands but it's not.
    EllipsisRuleBracket = "[" NonemptyListOf<RuleBracketNeighbor, "|"> t_ELLIPSIS "|" NonemptyListOf<RuleBracketNeighbor, "|"> "]" t_DEBUGGER?

    RuleBracketNeighbor
        = HackTileNameIsSFX1 // to parse '... -> [ SFX1 ]' (they should be commands)
        | HackTileNameIsSFX2 // to parse '... -> [ tilename SFX1 ]'
        | RuleBracketNoEllipsisNeighbor

    RuleBracketNoEllipsisNeighbor = TileWithModifier* t_DEBUGGER?

    TileWithModifier = t_DEBUGGER? tileModifier* lookupRuleVariableName

    // Force-check that there is whitespace after the cellLayerModifier so things
    // like "STATIONARYZ" or "NOZ" are not parsed as a modifier
    // (they are a variable that happens to begin with the same text as a modifier)
    tileModifier = space* tileModifierInner space+

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
        | t_PARALLEL
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
        t_DEBUGGER?
        t_STARTLOOP lineTerminator+
        RuleItem+
        t_ENDLOOP lineTerminator+

    RuleGroup =
        t_DEBUGGER?
        t_RANDOM?
        Rule
        (t_GROUP_RULE_PLUS Rule)+

    HackTileNameIsSFX1 = t_SFX t_DEBUGGER?
    HackTileNameIsSFX2 = lookupRuleVariableName t_SFX t_DEBUGGER?
`

export function getRuleSemantics(lookup: LookupHelper) {
    const cacheTilesWithModifiers: Map<string, ASTTileWithModifier> = new Map()
    const cacheNeighbors: Map<string, ASTRuleBracketNeighbor> = new Map()
    const cacheBrackets: Map<string, IASTRuleBracket> = new Map()
    return {
        RuleItem(this: ohm.Node, _1: IParseable<ASTRule>) {
            return _1.parse()
        },
        RuleLoop(this: ohm.Node, debugFlag: IParseable<DEBUG_FLAG[]>, _startloop: IParseable<string>,
                 _whitespace1: IParseable<string>, rules: IParseable<ASTRule[]>, _endloop: IParseable<string>,
                 _whitespace2: IParseable<string>) {

            return new ASTRuleLoop(this.source, rules.parse(), debugFlag.parse()[0])
        },
        RuleGroup(this: ohm.Node, debugFlag: IParseable<DEBUG_FLAG[]>, randomFlag: IParseable<AST_RULE_MODIFIER[]>,
                  firstRule: IParseable<ASTRule>, _plusses: IParseable<string>, followingRules: IParseable<ASTRule[]>) {

            return new ASTRuleGroup(this.source, !!randomFlag.parse()[0], [firstRule.parse()].concat(followingRules.parse()), debugFlag.parse()[0])
        },
        Rule(this: ohm.Node, debugFlag: IParseable<DEBUG_FLAG[]>, modifiers: IParseable<AST_RULE_MODIFIER[][]>,
             conditions: IParseable<ASTRuleBracket[]>, _arrow: IParseable<string>, _unusuedModifer: IParseable<string>,
             actions: IParseable<ASTRuleBracket[]>, commands: IParseable<AbstractCommand[]>,
             optionalMessageCommand: IParseable<MessageCommand[]>, _whitespace: IParseable<string>) {

            const modifiers2 = _flatten(modifiers.parse())
            const commands2 = commands.parse().filter((c) => !!c) // remove nulls (like an invalid sound effect... e.g. "Fish Friend")
            const optionalMessageCommand2 = optionalMessageCommand.parse()[0]

            if (optionalMessageCommand2) {
                commands2.push(optionalMessageCommand2)
            }
            return new ASTRule(this.source, modifiers2, conditions.parse(), actions.parse(), commands2, debugFlag.parse()[0])
        },
        NormalRuleBracket(this: ohm.Node, _openBracket: IParseable<string>,
                          neighbors: IParseable<ASTRuleBracketNeighbor[]>, hackAgain: IParseable<string>,
                          _closeBracket: IParseable<string>, debugFlag: IParseable<DEBUG_FLAG[]>) {

            const b = new ASTRuleBracket(this.source, neighbors.parse(), hackAgain.parse(), debugFlag.parse()[0])
            const key = b.toKey()
            if (!cacheBrackets.has(key)) {
                cacheBrackets.set(key, b)
            } else {
                // console.log(`Prevented creating a duplicate bracket: ${key}`)
            }
            return cacheBrackets.get(key)
        },
        EllipsisRuleBracket(this: ohm.Node, _openBracket: IParseable<string>,
                            beforeEllipsisNeighbors: IParseable<ASTRuleBracketNeighbor[]>, _ellipsis: IParseable<string>,
                            _pipe: IParseable<string>, afterEllipsisNeighbors: IParseable<ASTRuleBracketNeighbor[]>,
                            _closeBracket: IParseable<string>, debugFlag: IParseable<DEBUG_FLAG[]>) {

                // The before ellipsis neightbor contains an additional empty neighbor that we need to remove
            const before = beforeEllipsisNeighbors.parse()
            const extraEmptyNeighbor = before.pop()
            if (extraEmptyNeighbor && extraEmptyNeighbor.tilesWithModifier.length === 0) {
                // yep, that's the extra one we should remove
            } else {
                throw new Error(`BUG: Invariant broken`)
            }
            const b = new ASTRuleBracketEllipsis(this.source, before, afterEllipsisNeighbors.parse(), debugFlag.parse()[0])
            const key = b.toKey()
            if (!cacheBrackets.has(key)) {
                cacheBrackets.set(key, b)
            } else {
                // console.log(`Prevented creating a duplicate bracket: ${key}`)
            }
            return cacheBrackets.get(key)
        },
        RuleBracketNeighbor(this: ohm.Node, _1: IParseable<ASTRuleBracketNeighbor>) {
            return _1.parse()
        },
        RuleBracketNoEllipsisNeighbor(this: ohm.Node, tileWithModifiers: IParseable<ASTTileWithModifier[]>, debugFlag: IParseable<DEBUG_FLAG[]>) {
            const n = new ASTRuleBracketNeighbor(this.source, tileWithModifiers.parse(), debugFlag.parse()[0])
            const key = n.toKey()
            if (!cacheNeighbors.has(key)) {
                cacheNeighbors.set(key, n)
            } else {
                // console.log('Prevented creating a duplicate neighbor')
            }
            return cacheNeighbors.get(key)
        },
        TileWithModifier(this: ohm.Node, debugFlag: IParseable<DEBUG_FLAG[]>, optionalModifier: IParseable<string[]>, tile: IParseable<IGameTile>) {
            const t = new ASTTileWithModifier(this.source, optionalModifier.parse()[0], tile.parse(), debugFlag.parse()[0])
            const key = t.toKey()
            if (!cacheTilesWithModifiers.has(key)) {
                cacheTilesWithModifiers.set(key, t)
            } else {
                // console.log('Prevented creating a duplicate tile')
            }
            return cacheTilesWithModifiers.get(key)
        },
        tileModifier(this: ohm.Node, _whitespace1: IParseable<string>, tileModifier: IParseable<string>, _whitespace2: IParseable<string>) {
            return tileModifier.parse()
        },
        MessageCommand(this: ohm.Node, _message: IParseable<string>, message: IParseable<string[]>) {
            return new MessageCommand(this.source, message.parse()[0])
        },
        RuleCommand(this: ohm.Node, type: IParseable<string>) {
            const type2 = type.parse()
            switch (type2) {
                case COMMAND_TYPE.AGAIN:
                    return new AgainCommand(this.source)
                case COMMAND_TYPE.CANCEL:
                    return new CancelCommand(this.source)
                case COMMAND_TYPE.CHECKPOINT:
                    return new CheckpointCommand(this.source)
                case COMMAND_TYPE.RESTART:
                    return new RestartCommand(this.source)
                case COMMAND_TYPE.WIN:
                    return new WinCommand(this.source)
                case 'SFX0':
                case 'SFX1':
                case 'SFX2':
                case 'SFX3':
                case 'SFX4':
                case 'SFX5':
                case 'SFX6':
                case 'SFX7':
                case 'SFX8':
                case 'SFX9':
                case 'SFX10':
                    const sound = lookup.lookupSoundEffect(type2)
                    if (!sound) {
                        // console.warn(this.source.getLineAndColumnMessage())
                        console.warn(`Sound not found "${type2}"`) // tslint:disable-line:no-console
                        return null // this will get filtered out when we create the Rule
                    }
                    return new SoundCommand(this.source, sound)
                default:
                    throw new Error(`BUG: Fallthrough. Did not match "${type2}"`)
            }
        },
        HackTileNameIsSFX1(this: ohm.Node, sfx: IParseable<string>, debugFlag: IParseable<DEBUG_FLAG[]>) {
            return new ASTRuleBracketNeighborHack(this.source, { sfx: sfx.parse() }, debugFlag.parse()[0])
        },
        HackTileNameIsSFX2(this: ohm.Node, tile: IParseable<string>, sfx: IParseable<string>, debugFlag: IParseable<DEBUG_FLAG[]>) {
            return new ASTRuleBracketNeighborHack(this.source, { tile: tile.parse(), sfx: sfx.parse() }, debugFlag.parse()[0])
        }
    }
}
