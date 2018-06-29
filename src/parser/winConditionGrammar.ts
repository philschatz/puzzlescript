import { WinConditionSimple, WinConditionOn, WIN_QUALIFIER } from '../models/winCondition'
import { Parseable } from './gameGrammar';
import { IGameTile } from '../models/tile';

export const WINCONDITIONS_GRAMMAR = `
    WinConditionItem
        = WinConditionItemSimple
        | WinConditionItemOn

    WinConditionItemSimple = winConditionItemPrefix lookupRuleVariableName lineTerminator+
    WinConditionItemOn = winConditionItemPrefix lookupRuleVariableName t_ON lookupRuleVariableName lineTerminator+

    winConditionItemPrefix
        = t_NO
        | t_ALL
        | t_ANY
        | t_SOME
`

export function getWinConditionSemantics() {
    return {
        WinConditionItemSimple: function (qualifier: Parseable<WIN_QUALIFIER>, spriteName: Parseable<IGameTile>, _whitespace: Parseable<string>) {
            return new WinConditionSimple(this.source, qualifier.parse(), spriteName.parse())
        },
        WinConditionItemOn: function (qualifier: Parseable<WIN_QUALIFIER>, sprite: Parseable<IGameTile>, _on: Parseable<string>, onSprite: Parseable<IGameTile>, _whitespace: Parseable<string>) {
            return new WinConditionOn(this.source, qualifier.parse(), sprite.parse(), onSprite.parse())
        },
        winConditionItemPrefix: function (qualifier: Parseable<string>) {
            switch (qualifier.parse()) {
                case WIN_QUALIFIER.ALL:
                    return WIN_QUALIFIER.ALL
                case WIN_QUALIFIER.ANY:
                    return WIN_QUALIFIER.ANY
                case WIN_QUALIFIER.NO:
                    return WIN_QUALIFIER.NO
                case WIN_QUALIFIER.SOME:
                    return WIN_QUALIFIER.SOME
            }
        }
    }
}