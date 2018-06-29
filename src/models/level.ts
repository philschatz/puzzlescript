import { BaseForLines, IGameCode } from './game'
import { IGameTile } from './tile'

export interface ILevel {
    isInvalid: () => string
    isMap: () => boolean
    getRows: () => IGameTile[][]
    getMessage: () => string
}

export class LevelMap extends BaseForLines implements ILevel {
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
    getWidth() {
        return this._rows[0].length
    }
    getHeight() {
        return this._rows.length
    }
    getMessage(): string {
        throw new Error(`BUG: Check .isMap() before calling this`)
    }
}

export class MessageLevel extends BaseForLines implements ILevel {
    _message: string
    constructor(source: IGameCode, message: string) {
        super(source)
        this._message = message
    }
    isInvalid(): string { return null }
    isMap() {
        return false
    }
    getRows(): IGameTile[][] {
        throw new Error(`BUG: Should have checked isMap first`)
    }
    getMessage() {
        return this._message
    }
}