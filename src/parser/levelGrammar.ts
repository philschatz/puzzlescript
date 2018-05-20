import { LevelMap } from '../models/level'
import { LookupHelper } from './lookup'

export const LEVEL_GRAMMAR = `
    GameMessage = t_MESSAGE words*

    LevelItem = (GameMessage | LevelMap) lineTerminator*
    LevelMap = levelMapRow+

    levelMapRow = (~lineTerminator ~t_MESSAGE ~"(" any)+ lineTerminator
`

export function getLevelSemantics(lookup: LookupHelper) {
    return {
        LevelItem: function (_1, _2) {
            return _1.parse()
        },
        LevelMap: function (rows) {
            const levelRows = rows.parse().map((row: string[]) => {
                return row.map((levelChar: string) => {
                    return lookup.lookupByLevelChar(levelChar)
                })
            })
            return new LevelMap(this.source, levelRows)
        },
        levelMapRow: function (row, _2) {
            return row.parse()
        }
    }
}