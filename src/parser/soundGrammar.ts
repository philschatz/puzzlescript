import {
    GameSound,
    GameSoundSfx,
    GameSoundSimpleEnum,
    GameSoundNormal,
    GameSoundMoveSimple,
    GameSoundMoveDirection
} from '../models/sound'
import { LookupHelper } from './lookup'

export const SOUND_GRAMMAR = `
    // TODO: Handle tokens like sfx0 and explicit args instead of just varName (like "Player CantMove up")
    // all of them are at https://www.puzzlescript.net/Documentation/sounds.html
    SoundItem = SoundItemInner lineTerminator+

    SoundItemInner
        = SoundItemEnum
        | SoundItemSfx
        | SoundItemMoveDirection
        | SoundItemMoveSimple
        | SoundItemNormal

    soundItemSimpleOptions
        = t_RESTART
        | t_UNDO
        | t_TITLESCREEN
        | t_STARTGAME
        | t_STARTLEVEL
        | t_ENDLEVEL
        | t_ENDGAME
        | t_SHOWMESSAGE
        | t_CLOSEMESSAGE

    SoundItemEnum = soundItemSimpleOptions integer
    SoundItemSfx = t_SFX integer
    SoundItemMoveDirection = ruleVariableName t_MOVE soundItemActionMoveArg integer
    SoundItemMoveSimple = ruleVariableName t_MOVE integer
    SoundItemNormal = ruleVariableName SoundItemAction integer

    SoundItemAction
        = t_CREATE
        | t_DESTROY
        | t_CANTMOVE

    soundItemActionMoveArg
        = t_UP
        | t_DOWN
        | t_LEFT
        | t_RIGHT
        | t_HORIZONTAL
        | t_VERTICAL
`

export function getSoundSemantics(lookup: LookupHelper) {
    return {
        SoundItem: function (_1, _whitespace) {
            return _1.parse()
        },
        SoundItemEnum: function (simpleEnum, soundCode) {
            return new GameSoundSimpleEnum(this.source, simpleEnum.parse(), soundCode.parse())
        },
        SoundItemSfx: function (sfxName, soundCode) {
            const soundEffect = sfxName.parse()
            const sound = new GameSoundSfx(this.source, soundEffect, soundCode.parse())
            lookup.addSoundEffect(soundEffect, sound)
            return sound
        },
        SoundItemMoveSimple: function (spriteName, _2, soundCode) {
            return new GameSoundMoveSimple(this.source, lookup.lookupObjectOrLegendTile(this.source, spriteName.parse()), soundCode.parse())
        },
        SoundItemMoveDirection: function (spriteName, _move, directionEnum, soundCode) {
            return new GameSoundMoveDirection(this.source, lookup.lookupObjectOrLegendTile(this.source, spriteName.parse()), directionEnum.parse(), soundCode.parse())
        },
        SoundItemNormal: function (spriteName, eventEnum, soundCode) {
            return new GameSoundNormal(this.source, lookup.lookupObjectOrLegendTile(this.source, spriteName.parse()), eventEnum.parse(), soundCode.parse())
        }
    }
}