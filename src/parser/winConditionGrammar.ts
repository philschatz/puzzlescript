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
        WinConditionItemSimple: function (qualifierEnum, spriteName, _whitespace) {
            return new WinConditionSimple(this.source, qualifierEnum.parse(), spriteName.parse())
        },
        WinConditionItemOn: function (qualifierEnum, spriteName, _on, targetObjectName, _whitespace) {
            return new WinConditionOn(this.source, qualifierEnum.parse(), spriteName.parse(), targetObjectName.parse())
        }
    }
}