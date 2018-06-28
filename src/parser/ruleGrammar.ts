import * as _ from 'lodash'
import { AbstractCommand, COMMAND_TYPE, MessageCommand, AgainCommand, CancelCommand, CheckpointCommand, RestartCommand, WinCommand, SoundCommand } from '../models/command';
import { LookupHelper } from './lookup';
import { ASTTileWithModifier, ASTRuleBracketNeighbor, ASTRuleBracket, ASTGameRuleLoop, ASTGameRuleGroup, ASTGameRule, ASTHackNode, AST_RULE_MODIFIER } from './rule';

export const RULE_GRAMMAR = `
    RuleItem
        = RuleLoop
        | RuleGroup // Do this before Rule because we need to look for a "+" on the following Rule
        | Rule

    Rule = t_DEBUGGER? (RuleModifierLeft* RuleBracket)+ "->" (RuleModifier? RuleBracket)* RuleCommand* MessageCommand? lineTerminator+

    RuleBracket = "[" NonemptyListOf<RuleBracketNeighbor, "|"> t_AGAIN? "]" t_DEBUGGER? // t_AGAIN is a HACK. It should be in the list of commands but it's not.
    RuleBracketNeighbor
        = HackTileNameIsSFX1 // to parse '... -> [ SFX1 ]' (they should be commands)
        | HackTileNameIsSFX2 // to parse '... -> [ tilename SFX1 ]'
        | RuleBracketEllipsisNeighbor
        | RuleBracketNoEllipsisNeighbor

    RuleBracketEllipsisNeighbor = t_ELLIPSIS t_DEBUGGER?
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
    const cacheBrackets: Map<string, ASTRuleBracket> = new Map()
    return {
        RuleItem: function (_1) {
            return _1.parse()
        },
        RuleLoop: function (debugFlag, _startloop, _whitespace1, rules, _endloop, _whitespace2) {
            return new ASTGameRuleLoop(this.source, rules.parse(), debugFlag.parse()[0])
        },
        RuleGroup: function (debugFlag, firstRule, _plusses, followingRules) {
            return new ASTGameRuleGroup(this.source, [firstRule.parse()].concat(followingRules.parse()), debugFlag.parse()[0])
        },
        Rule: function (debugFlag, modifiers, conditions, _arrow, _unusuedModifer, actions, commands, optionalMessageCommand, _whitespace) {
            const modifiers2: AST_RULE_MODIFIER[] = _.flatten(modifiers.parse())
            const commands2: AbstractCommand[] = commands.parse().filter(c => !!c) // remove nulls (like an invalid sound effect... e.g. "Fish Friend")
            const optionalMessageCommand2: MessageCommand = optionalMessageCommand.parse()[0]

            if (optionalMessageCommand2) {
                commands2.push(optionalMessageCommand2)
            }
            return new ASTGameRule(this.source, modifiers2, conditions.parse(), actions.parse(), commands2, debugFlag.parse()[0])
        },
        RuleBracket: function (_openBracket, neighbors, hackAgain, _closeBracket, debugFlag) {
            const b = new ASTRuleBracket(this.source, neighbors.parse(), hackAgain.parse(), debugFlag.parse()[0])
            const key = b.toKey()
            if (!cacheBrackets.has(key)) {
                cacheBrackets.set(key, b)
            } else {
                // console.log(`Prevented creating a duplicate bracket: ${key}`)
            }
            return cacheBrackets.get(key)
        },
        RuleBracketNeighbor: function (_1) {
            return _1.parse()
        },
        RuleBracketEllipsisNeighbor: function (_1, debugFlag) {
            const tileWithModifier = new ASTTileWithModifier(this.source, "...", null, debugFlag.parse()[0])
            return new ASTRuleBracketNeighbor(this.source, [tileWithModifier], true, debugFlag.parse()[0])
        },
        RuleBracketNoEllipsisNeighbor: function (tileWithModifier, debugFlag) {
            const n = new ASTRuleBracketNeighbor(this.source, tileWithModifier.parse(), false, debugFlag.parse()[0])
            const key = n.toKey()
            if (!cacheNeighbors.has(key)) {
                cacheNeighbors.set(key, n)
            } else {
                // console.log('Prevented creating a duplicate neighbor')
            }
            return cacheNeighbors.get(key)
        },
        TileWithModifier: function (debugFlag, optionalModifier, tile) {
            const t = new ASTTileWithModifier(this.source, optionalModifier.parse()[0], tile.parse(), debugFlag.parse()[0])
            const key = t.toKey()
            if (!cacheTilesWithModifiers.has(key)) {
                cacheTilesWithModifiers.set(key, t)
            } else {
                // console.log('Prevented creating a duplicate tile')
            }
            return cacheTilesWithModifiers.get(key)
        },
        tileModifier: function (_whitespace1, tileModifier, _whitespace2) {
            return tileModifier.parse()
        },
        MessageCommand: function (_message, message) {
            return new MessageCommand(this.source, message.parse())
        },
        RuleCommand: function (type) {
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
        HackTileNameIsSFX1: function (sfx, debugFlag) {
            return new ASTHackNode(this.source, sfx.parse(), debugFlag.parse()[0])
        },
        HackTileNameIsSFX2: function (tile, sfx, debugFlag) {
            return new ASTHackNode(this.source, { tile: tile.parse(), sfx: sfx.parse() }, debugFlag.parse()[0])
        },
    }
}