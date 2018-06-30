import * as _ from 'lodash'
import * as ohm from 'ohm-js'
import { AbstractCommand, COMMAND_TYPE, MessageCommand, AgainCommand, CancelCommand, CheckpointCommand, RestartCommand, WinCommand, SoundCommand } from '../models/command';
import { LookupHelper } from './lookup';
import { ASTTileWithModifier, ASTRuleBracketNeighbor, ASTRuleBracket, ASTGameRuleLoop, ASTGameRuleGroup, ASTGameRule, ASTHackNode, AST_RULE_MODIFIER, ASTEllipsisRuleBracket, IASTRuleBracket } from './rule';
import { DEBUG_FLAG } from '../util';
import { Parseable } from './gameGrammar';
import { IGameTile } from '../models/tile';

export const RULE_GRAMMAR = `
    RuleItem
        = RuleLoop
        | RuleGroup // Do this before Rule because we need to look for a "+" on the following Rule
        | Rule

    Rule = t_DEBUGGER? (RuleModifierLeft* RuleBracket)+ "->" (RuleModifier? RuleBracket)* RuleCommand* MessageCommand? lineTerminator+

    RuleBracket
        = EllipsisRuleBracket
        | NormalRuleBracket

    NormalRuleBracket = "[" NonemptyListOf<RuleBracketNeighbor, "|"> t_AGAIN? "]" t_DEBUGGER? // t_AGAIN is a HACK. It should be in the list of commands but it's not.
    EllipsisRuleBracket = "[" NonemptyListOf<RuleBracketNeighbor, "|"> t_ELLIPSIS "|" NonemptyListOf<RuleBracketNeighbor, "|"> "]" t_DEBUGGER?

    RuleBracketNeighbor
        = HackTileNameIsSFX1 // to parse '... -> [ SFX1 ]' (they should be commands)
        | HackTileNameIsSFX2 // to parse '... -> [ tilename SFX1 ]'
        | RuleBracketNoEllipsisNeighbor

    RuleBracketNoEllipsisNeighbor = TileWithModifier* t_DEBUGGER?

    TileWithModifier = t_DEBUGGER? tileModifier* lookupRuleVariableName

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
        t_DEBUGGER?
        t_STARTLOOP lineTerminator+
        RuleItem+
        t_ENDLOOP lineTerminator+

    RuleGroup =
        t_DEBUGGER?
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
        RuleItem: function (this: ohm.Node, _1: Parseable<ASTGameRule>) {
            return _1.parse()
        },
        RuleLoop: function (this: ohm.Node, debugFlag: Parseable<DEBUG_FLAG[]>, _startloop: Parseable<string>, _whitespace1: Parseable<string>, rules: Parseable<ASTGameRule[]>, _endloop: Parseable<string>, _whitespace2: Parseable<string>) {
            return new ASTGameRuleLoop(this.source, rules.parse(), debugFlag.parse()[0])
        },
        RuleGroup: function (this: ohm.Node, debugFlag: Parseable<DEBUG_FLAG[]>, firstRule: Parseable<ASTGameRule>, _plusses: Parseable<string>, followingRules: Parseable<ASTGameRule[]>) {
            return new ASTGameRuleGroup(this.source, [firstRule.parse()].concat(followingRules.parse()), debugFlag.parse()[0])
        },
        Rule: function (this: ohm.Node, debugFlag: Parseable<DEBUG_FLAG[]>, modifiers: Parseable<AST_RULE_MODIFIER[]>, conditions: Parseable<ASTRuleBracket[]>, _arrow: Parseable<string>, _unusuedModifer: Parseable<string>, actions: Parseable<ASTRuleBracket[]>, commands: Parseable<AbstractCommand[]>, optionalMessageCommand: Parseable<MessageCommand[]>, _whitespace: Parseable<string>) {
            const modifiers2 = _.flatten(modifiers.parse())
            const commands2 = commands.parse().filter(c => !!c) // remove nulls (like an invalid sound effect... e.g. "Fish Friend")
            const optionalMessageCommand2 = optionalMessageCommand.parse()[0]

            if (optionalMessageCommand2) {
                commands2.push(optionalMessageCommand2)
            }
            return new ASTGameRule(this.source, modifiers2, conditions.parse(), actions.parse(), commands2, debugFlag.parse()[0])
        },
        NormalRuleBracket: function (this: ohm.Node, _openBracket: Parseable<string>, neighbors: Parseable<ASTRuleBracketNeighbor[]>, hackAgain: Parseable<string>, _closeBracket: Parseable<string>, debugFlag: Parseable<DEBUG_FLAG[]>) {
            const b = new ASTRuleBracket(this.source, neighbors.parse(), hackAgain.parse(), debugFlag.parse()[0])
            const key = b.toKey()
            if (!cacheBrackets.has(key)) {
                cacheBrackets.set(key, b)
            } else {
                // console.log(`Prevented creating a duplicate bracket: ${key}`)
            }
            return cacheBrackets.get(key)
        },
        EllipsisRuleBracket: function (this: ohm.Node, _openBracket: Parseable<string>, beforeEllipsisNeighbors: Parseable<ASTRuleBracketNeighbor[]>, _ellipsis: Parseable<string>, _pipe: Parseable<string>, afterEllipsisNeighbors: Parseable<ASTRuleBracketNeighbor[]>, _closeBracket: Parseable<string>, debugFlag: Parseable<DEBUG_FLAG[]>) {
            // The before ellipsis neightbor contains an additional empty neighbor that we need to remove
            const before = beforeEllipsisNeighbors.parse()
            const extraEmptyNeighbor = before.pop()
            if (extraEmptyNeighbor && extraEmptyNeighbor.tilesWithModifier.length === 0) {
                // yep, that's the extra one we should remove
            } else {
                throw new Error(`BUG: Invariant broken`)
            }
            const b = new ASTEllipsisRuleBracket(this.source, before, afterEllipsisNeighbors.parse(), debugFlag.parse()[0])
            const key = b.toKey()
            if (!cacheBrackets.has(key)) {
                cacheBrackets.set(key, b)
            } else {
                // console.log(`Prevented creating a duplicate bracket: ${key}`)
            }
            return cacheBrackets.get(key)
        },
        RuleBracketNeighbor: function (this: ohm.Node, _1: Parseable<ASTRuleBracketNeighbor>) {
            return _1.parse()
        },
        RuleBracketNoEllipsisNeighbor: function (this: ohm.Node, tileWithModifiers: Parseable<ASTTileWithModifier[]>, debugFlag: Parseable<DEBUG_FLAG[]>) {
            const n = new ASTRuleBracketNeighbor(this.source, tileWithModifiers.parse(), debugFlag.parse()[0])
            const key = n.toKey()
            if (!cacheNeighbors.has(key)) {
                cacheNeighbors.set(key, n)
            } else {
                // console.log('Prevented creating a duplicate neighbor')
            }
            return cacheNeighbors.get(key)
        },
        TileWithModifier: function (this: ohm.Node, debugFlag: Parseable<DEBUG_FLAG[]>, optionalModifier: Parseable<string[]>, tile: Parseable<IGameTile>) {
            const t = new ASTTileWithModifier(this.source, optionalModifier.parse()[0], tile.parse(), debugFlag.parse()[0])
            const key = t.toKey()
            if (!cacheTilesWithModifiers.has(key)) {
                cacheTilesWithModifiers.set(key, t)
            } else {
                // console.log('Prevented creating a duplicate tile')
            }
            return cacheTilesWithModifiers.get(key)
        },
        tileModifier: function (this: ohm.Node, _whitespace1: Parseable<string>, tileModifier: Parseable<string>, _whitespace2: Parseable<string>) {
            return tileModifier.parse()
        },
        MessageCommand: function (this: ohm.Node, _message: Parseable<string>, message: Parseable<string>) {
            return new MessageCommand(this.source, message.parse())
        },
        RuleCommand: function (this: ohm.Node, type: Parseable<string>) {
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
                        console.warn(this.toString())
                        console.warn(`WARNING: Sound not found`)
                        return null // this will get filtered out when we create the Rule
                    }
                    return new SoundCommand(this.source, sound)
                default:
                    throw new Error(`BUG: Fallthrough. Did not match "${type2}"`)
            }
        },
        HackTileNameIsSFX1: function (this: ohm.Node, sfx: Parseable<string>, debugFlag: Parseable<DEBUG_FLAG[]>) {
            return new ASTHackNode(this.source, {sfx: sfx.parse()}, debugFlag.parse()[0])
        },
        HackTileNameIsSFX2: function (this: ohm.Node, tile: Parseable<string>, sfx: Parseable<string>, debugFlag: Parseable<DEBUG_FLAG[]>) {
            return new ASTHackNode(this.source, { tile: tile.parse(), sfx: sfx.parse() }, debugFlag.parse()[0])
        },
    }
}