import * as ohm from 'ohm-js'
import {
    GameSound,
    GameSoundMoveDirection,
    GameSoundMoveSimple,
    GameSoundNormal,
    GameSoundSfx,
    GameSoundSimpleEnum
} from '../models/sound'
import { IGameTile } from '../models/tile'
import { IParseable } from './gameGrammar'
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
    SoundItemMoveDirection = lookupRuleVariableName t_MOVE soundItemActionMoveArg integer
    SoundItemMoveSimple = lookupRuleVariableName t_MOVE integer
    SoundItemNormal = lookupRuleVariableName SoundItemAction integer

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
        SoundItem(this: ohm.Node, _1: IParseable<GameSound>, _whitespace: IParseable<string>) {
            return _1.parse()
        },
        SoundItemEnum(this: ohm.Node, simpleEnum: IParseable<number>, soundCode: IParseable<number>) {
            return new GameSoundSimpleEnum(this.source, simpleEnum.parse(), soundCode.parse())
        },
        SoundItemSfx(this: ohm.Node, sfxName: IParseable<string>, soundCode: IParseable<number>) {
            const soundEffect = sfxName.parse()
            const sound = new GameSoundSfx(this.source, soundEffect, soundCode.parse())
            lookup.addSoundEffect(soundEffect, sound)
            return sound
        },
        SoundItemMoveSimple(this: ohm.Node, sprite: IParseable<IGameTile>, _2: IParseable<string>, soundCode: IParseable<number>) {
            return new GameSoundMoveSimple(this.source, sprite.parse(), soundCode.parse())
        },
        SoundItemMoveDirection(this: ohm.Node, sprite: IParseable<IGameTile>, _move: IParseable<string>, directionEnum: IParseable<string>, soundCode: IParseable<number>) {
            return new GameSoundMoveDirection(this.source, sprite.parse(), directionEnum.parse(), soundCode.parse())
        },
        SoundItemNormal(this: ohm.Node, sprite: IParseable<IGameTile>, eventEnum: IParseable<string>, soundCode: IParseable<number>) {
            return new GameSoundNormal(this.source, sprite.parse(), eventEnum.parse(), soundCode.parse())
        }
    }
}
