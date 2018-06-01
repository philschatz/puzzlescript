import { WinConditionSimple, WinConditionOn, WIN_QUALIFIER } from '../models/winCondition'

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
        WinConditionItemSimple: function (qualifierEnum, spriteName, _whitespace) {
            const qualifier: string = qualifierEnum.parse()
            return new WinConditionSimple(this.source, WIN_QUALIFIER[qualifier], spriteName.parse())
        },
        WinConditionItemOn: function (qualifierEnum, sprite, _on, onSprite, _whitespace) {
            const qualifier: string = qualifierEnum.parse()
            return new WinConditionOn(this.source, WIN_QUALIFIER[qualifier], sprite.parse(), onSprite.parse())
        }
    }
}