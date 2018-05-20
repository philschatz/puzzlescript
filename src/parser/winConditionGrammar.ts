import * as ohm from 'ohm-js'
import { WinConditionSimple, WinConditionOn } from '../models/winCondition'

export const WINCONDITIONS_GRAMMAR = `
    WinConditionItem
        = WinConditionItemSimple
        | WinConditionItemOn

    WinConditionItemSimple = winConditionItemPrefix ruleVariableName lineTerminator+
    WinConditionItemOn = winConditionItemPrefix ruleVariableName t_ON ruleVariableName lineTerminator+

    winConditionItemPrefix
        = t_NO
        | t_ALL
        | t_ANY
        | t_SOME
`

export function getWinConditionSemantics() {
    return {
        WinConditionItemSimple: function (qualifierEnum: ohm.Node, spriteName: ohm.Node, _whitespace: ohm.Node) {
            return new WinConditionSimple(this.source, qualifierEnum.parse(), spriteName.parse())
        },
        WinConditionItemOn: function (qualifierEnum: ohm.Node, spriteName: ohm.Node, _on: ohm.Node, targetObjectName: ohm.Node, _whitespace: ohm.Node) {
            return new WinConditionOn(this.source, qualifierEnum.parse(), spriteName.parse(), targetObjectName.parse())
        }
    }
}