import * as ohm from 'ohm-js'
import { IGameTile } from '../models/tile'
import { WIN_QUALIFIER, WinConditionOn, WinConditionSimple } from '../models/winCondition'
import { IParseable } from './gameGrammar'

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
        WinConditionItemSimple(this: ohm.Node, qualifier: IParseable<WIN_QUALIFIER>, spriteName: IParseable<IGameTile>, _whitespace: IParseable<string>) {
            return new WinConditionSimple(this.source, qualifier.parse(), spriteName.parse())
        },
        WinConditionItemOn(this: ohm.Node, qualifier: IParseable<WIN_QUALIFIER>, sprite: IParseable<IGameTile>,
                           _on: IParseable<string>, onSprite: IParseable<IGameTile>, _whitespace: IParseable<string>) {

            return new WinConditionOn(this.source, qualifier.parse(), sprite.parse(), onSprite.parse())
        },
        winConditionItemPrefix(this: ohm.Node, qualifier: IParseable<string>) {
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
