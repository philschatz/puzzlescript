import * as _ from 'lodash'
import {
    GameRuleLoop,
    GameRuleGroup,
    GameRule,
    HackNode,
    RuleBracket,
    RuleBracketNeighbor,
    TileWithModifier
} from '../models/rule'
import { AbstractCommand, COMMAND_TYPE, MessageCommand, AgainCommand, CancelCommand, CheckpointCommand, RestartCommand, WinCommand, SoundCommand } from '../models/command';
import { RULE_MODIFIER } from '../util';
import { LookupHelper } from './lookup';

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
    const cacheTilesWithModifiers: Map<string, TileWithModifier> = new Map()
    const cacheNeighbors: Map<string, RuleBracketNeighbor> = new Map()
    const cacheBrackets: Map<string, RuleBracket> = new Map()
    return {
        RuleItem: function (_1) {
            return _1.parse()
        },
        RuleLoop: function (debugFlag, _startloop, _whitespace1, rules, _endloop, _whitespace2) {
            return new GameRuleLoop(this.source, rules.parse(), debugFlag.parse()[0])
        },
        RuleGroup: function (debugFlag, firstRule, _plusses, followingRules) {
            return new GameRuleGroup(this.source, [firstRule.parse()].concat(followingRules.parse()), debugFlag.parse()[0])
        },
        Rule: function (debugFlag, modifiers, conditions, _arrow, _unusuedModifer, actions, commands, optionalMessageCommand, _whitespace) {
            const modifiers2: RULE_MODIFIER[] = _.flatten(modifiers.parse())
            const commands2: AbstractCommand[] = commands.parse()
            const optionalMessageCommand2: MessageCommand = optionalMessageCommand.parse()

            const isAgain = !!commands2.filter(c => c.getType() === COMMAND_TYPE.AGAIN)[0]
            const commands3 = commands2.filter(c => c.getType() !== COMMAND_TYPE.AGAIN)
            if (optionalMessageCommand2) {
                commands2.push(optionalMessageCommand2)
            }
            return new GameRule(this.source, modifiers2, conditions.parse(), actions.parse(), commands3, isAgain, debugFlag.parse()[0])
        },
        RuleBracket: function (_openBracket, neighbors, hackAgain, _closeBracket, debugFlag) {
            const b = new RuleBracket(this.source, neighbors.parse(), hackAgain.parse(), debugFlag.parse()[0])
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
            const tileWithModifier = new TileWithModifier(this.source, "...", null, debugFlag.parse()[0])
            return new RuleBracketNeighbor(this.source, [tileWithModifier], true, debugFlag.parse()[0])
        },
        RuleBracketNoEllipsisNeighbor: function (tileWithModifier, debugFlag) {
            const n = new RuleBracketNeighbor(this.source, tileWithModifier.parse(), false, debugFlag.parse()[0])
            const key = n.toKey()
            if (!cacheNeighbors.has(key)) {
                cacheNeighbors.set(key, n)
            } else {
                // console.log('Prevented creating a duplicate neighbor')
            }
            return cacheNeighbors.get(key)
        },
        TileWithModifier: function (debugFlag, optionalModifier, tile) {
            const t = new TileWithModifier(this.source, optionalModifier.parse()[0], tile.parse(), debugFlag.parse()[0])
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
                    return new SoundCommand(this.source, lookup.lookupSoundEffect(type2))
                default:
                    throw new Error(`BUG: Fallthrough. Did not match "${type2}"`)
            }
        },
        HackTileNameIsSFX1: function (sfx, debugFlag) {
            return new HackNode(this.source, sfx.parse(), debugFlag.parse()[0])
        },
        HackTileNameIsSFX2: function (tile, sfx, debugFlag) {
            return new HackNode(this.source, { tile: tile.parse(), sfx: sfx.parse() }, debugFlag.parse()[0])
        },
    }
}