import * as ohm from 'ohm-js'
import {
    GameSound,
    GameSoundSfx,
    GameSoundSimpleEnum,
    GameSoundNormal,
    GameSoundMoveSimple,
    GameSoundMoveDirection
} from '../models/sound'
import { LookupHelper } from './lookup'
import { Parseable } from './gameGrammar';
import { IGameTile } from '../models/tile';

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
        SoundItem: function (this: ohm.Node, _1: Parseable<GameSound>, _whitespace: Parseable<string>) {
            return _1.parse()
        },
        SoundItemEnum: function (this: ohm.Node, simpleEnum: Parseable<number>, soundCode: Parseable<number>) {
            return new GameSoundSimpleEnum(this.source, simpleEnum.parse(), soundCode.parse())
        },
        SoundItemSfx: function (this: ohm.Node, sfxName: Parseable<string>, soundCode: Parseable<number>) {
            const soundEffect = sfxName.parse()
            const sound = new GameSoundSfx(this.source, soundEffect, soundCode.parse())
            lookup.addSoundEffect(soundEffect, sound)
            return sound
        },
        SoundItemMoveSimple: function (this: ohm.Node, sprite: Parseable<IGameTile>, _2: Parseable<string>, soundCode: Parseable<number>) {
            return new GameSoundMoveSimple(this.source, sprite.parse(), soundCode.parse())
        },
        SoundItemMoveDirection: function (this: ohm.Node, sprite: Parseable<IGameTile>, _move: Parseable<string>, directionEnum: Parseable<string>, soundCode: Parseable<number>) {
            return new GameSoundMoveDirection(this.source, sprite.parse(), directionEnum.parse(), soundCode.parse())
        },
        SoundItemNormal: function (this: ohm.Node, sprite: Parseable<IGameTile>, eventEnum: Parseable<string>, soundCode: Parseable<number>) {
            return new GameSoundNormal(this.source, sprite.parse(), eventEnum.parse(), soundCode.parse())
        }
    }
}