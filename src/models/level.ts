import { BaseForLines, IGameCode } from './game'
import { IGameTile } from './tile'

export class LevelMap extends BaseForLines {
    _rows: IGameTile[][]

    constructor(source: IGameCode, rows: any[][]) {
        super(source)
        this._rows = rows
    }
    isInvalid(): string {
        const firstRowLength = this._rows[0].length
        let isInvalid = null
        this._rows.forEach((row, index) => {
            if (firstRowLength !== row.length) {
                isInvalid = `Row ${index + 1} does not have the same column count as the first row. Expected ${firstRowLength} columns but found ${row.length}.`
            }
        })
        return isInvalid
    }
    isMap() {
        return true
    }
    getRows() {
        return this._rows
    }
}