import * as ohm from 'ohm-js'
import { LevelMap, MessageLevel } from '../models/level'
import { IParseable } from './gameGrammar'
import { LookupHelper } from './lookup'

export const LEVEL_GRAMMAR = `
    LevelItem = (GameMessageLevel | LevelMap) lineTerminator*
    LevelMap = levelMapRow+
    GameMessageLevel = t_MESSAGE words*

    levelMapRow = (~lineTerminator ~t_MESSAGE ~"(" any)+ lineTerminator
`

export function getLevelSemantics(lookup: LookupHelper) {
    return {
        LevelItem(this: ohm.Node, _1: IParseable<string>, _2: IParseable<string>) {
            return _1.parse()
        },
        GameMessageLevel(this: ohm.Node, _1: IParseable<string>, optionalMessage: IParseable<string[]>) {
            const msg = optionalMessage.parse()[0] /* Since the message is optional */
            if (msg) {
                return new MessageLevel(this.source, msg)
            }
            return null
        },
        LevelMap(this: ohm.Node, rows: IParseable<string[][]>) {
            const levelRows = rows.parse().map((row: string[]) => {
                return row.map((levelChar: string) => {
                    return lookup.lookupByLevelChar(levelChar)
                })
            })
            return new LevelMap(this.source, levelRows)
        },
        levelMapRow(this: ohm.Node, row: IParseable<string[]>, _2: IParseable<string>) {
            return row.parse()
        }
    }
}
