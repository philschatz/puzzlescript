import * as ohm from 'ohm-js'
import { LevelMap } from '../models/level'
import { LookupHelper } from './lookup'

export const LEVEL_GRAMMAR = `
    LevelItem = (GameMessage | LevelMap) lineTerminator*
    LevelMap = levelMapRow+

    levelMapRow = (~lineTerminator ~t_MESSAGE ~"(" any)+ lineTerminator
`

export function getLevelSemantics(lookup: LookupHelper) {
    return {
        LevelItem: function (_1: ohm.Node, _2: ohm.Node) {
            return _1.parse()
        },
        LevelMap: function (rows: ohm.Node) {
            const levelRows = rows.parse().map((row: string[]) => {
                return row.map((levelChar: string) => {
                    return lookup.lookupByLevelChar(levelChar)
                })
            })
            return new LevelMap(this.source, levelRows)
        },
        levelMapRow: function (row: ohm.Node, _2: ohm.Node) {
            return row.parse()
        }
    }
}