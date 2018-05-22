import * as _ from 'lodash'
import * as ohm from 'ohm-js'
import {
    GameRuleLoop,
    GameRuleGroup,
    GameRule,
    HackNode,
    RuleBracket,
    RuleBracketNeighbor,
    TileWithModifier
} from '../models/rule'

export const RULE_GRAMMAR = `
    RuleItem
        = RuleLoop
        | RuleGroup // Do this before Rule because we need to look for a "+" on the following Rule
        | Rule

    Rule = (RuleModifierLeft* RuleBracket)+ "->" (RuleModifier? RuleBracket)* RuleCommand* MessageCommand? lineTerminator+

    RuleBracket = "[" NonemptyListOf<RuleBracketNeighbor, "|"> t_AGAIN? "]" // t_AGAIN is a HACK. It should be in the list of commands but it's not.
    RuleBracketNeighbor
        = HackTileNameIsSFX1 // to parse '... -> [ SFX1 ]' (they should be commands)
        | HackTileNameIsSFX2 // to parse '... -> [ tilename SFX1 ]'
        | RuleBracketEllipsisNeighbor
        | RuleBracketNoEllipsisNeighbor

    RuleBracketEllipsisNeighbor = t_ELLIPSIS
    RuleBracketNoEllipsisNeighbor = TileWithModifier*

    TileWithModifier = tileModifier* lookupRuleVariableName

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
        t_STARTLOOP lineTerminator+
        RuleItem+
        t_ENDLOOP lineTerminator+

    RuleGroup =
        Rule
        (t_GROUP_RULE_PLUS Rule)+

    HackTileNameIsSFX1 = t_SFX
    HackTileNameIsSFX2 = lookupRuleVariableName t_SFX
`

export function getRuleSemantics() {
    return {
        RuleItem: function (_1: ohm.Node) {
            return _1.parse()
        },
        RuleLoop: function (_startloop: ohm.Node, _whitespace1: ohm.Node, rules: ohm.Node, _endloop: ohm.Node, _whitespace2: ohm.Node) {
            return new GameRuleLoop(this.source, rules.parse())
        },
        RuleGroup: function (firstRule: ohm.Node, _plusses: ohm.Node, followingRules: ohm.Node) {
            return new GameRuleGroup(this.source, [firstRule.parse()].concat(followingRules.parse()))
        },
        Rule: function (modifiers: ohm.Node, conditions: ohm.Node, _arrow: ohm.Node, _unusuedModifer: ohm.Node, actions: ohm.Node, commands: ohm.Node, optionalMessageCommand: ohm.Node, _whitespace: string) {
            return new GameRule(this.source, new Set(_.flatten(modifiers.parse())), conditions.parse(), actions.parse(), commands.parse().concat(optionalMessageCommand.parse()))
        },
        RuleBracket: function (_openBracket: ohm.Node, neighbors: ohm.Node, hackAgain: ohm.Node, _closeBracket: ohm.Node) {
            return new RuleBracket(this.source, neighbors.parse(), hackAgain.parse())
        },
        RuleBracketNeighbor: function (_1: ohm.Node) {
            return _1.parse()
        },
        RuleBracketEllipsisNeighbor: function (_1: ohm.Node) {
            const tileWithModifier = new TileWithModifier(this.source, "...", null)
            return new RuleBracketNeighbor(this.source, [tileWithModifier], true)
        },
        RuleBracketNoEllipsisNeighbor: function (tileWithModifier: ohm.Node) {
            return new RuleBracketNeighbor(this.source, tileWithModifier.parse(), false)
        },
        TileWithModifier: function (optionalModifier: ohm.Node, tile: ohm.Node) {
            return new TileWithModifier(this.source, optionalModifier.parse()[0], tile.parse())
        },
        tileModifier: function (_whitespace1: ohm.Node, tileModifiers: ohm.Node, _whitespace2: ohm.Node) {
            return tileModifiers.parse()
        },
        HackTileNameIsSFX1: function (sfx: ohm.Node) {
            return new HackNode(this.source, sfx.parse())
        },
        HackTileNameIsSFX2: function (tile: ohm.Node, sfx: ohm.Node) {
            return new HackNode(this.source, { tile: tile.parse(), sfx: sfx.parse() })
        },
    }
}