import { LevelMap, MessageLevel } from '../models/level'
import { LookupHelper } from './lookup'
import { Parseable } from './gameGrammar';

export const LEVEL_GRAMMAR = `
    LevelItem = (GameMessageLevel | LevelMap) lineTerminator*
    LevelMap = levelMapRow+
    GameMessageLevel = t_MESSAGE words*

    levelMapRow = (~lineTerminator ~t_MESSAGE ~"(" any)+ lineTerminator
`

export function getLevelSemantics(lookup: LookupHelper) {
    return {
        LevelItem: function (_1: Parseable<string>, _2: Parseable<string>) {
            return _1.parse()
        },
        GameMessageLevel: function (_1: Parseable<string>, optionalMessage: Parseable<string[]>) {
            // TODO: Maybe discard empty messages?
            return new MessageLevel(this.source, optionalMessage.parse()[0] /* Since the message is optional */)
        },
        LevelMap: function (rows: Parseable<string[][]>) {
            const levelRows = rows.parse().map((row: string[]) => {
                return row.map((levelChar: string) => {
                    return lookup.lookupByLevelChar(levelChar)
                })
            })
            return new LevelMap(this.source, levelRows)
        },
        levelMapRow: function (row: Parseable<string[]>, _2: Parseable<string>) {
            return row.parse()
        }
    }
}