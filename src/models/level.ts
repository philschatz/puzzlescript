import { BaseForLines, IGameCode } from './game'
import { IGameTile } from './tile'
import { Optional } from '../util';

export interface ILevel {
    isInvalid: () => Optional<string>
    isMap: () => boolean
    getRows: () => IGameTile[][]
    getMessage: () => string
}

export class LevelMap extends BaseForLines implements ILevel {
    private rows: IGameTile[][]

    constructor(source: IGameCode, rows: any[][]) {
        super(source)
        this.rows = rows
    }
    isInvalid(): Optional<string> {
        const firstRowLength = this.rows[0].length
        let isInvalid = null
        this.rows.forEach((row, index) => {
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
        return this.rows
    }
    getWidth() {
        return this.rows[0].length
    }
    getHeight() {
        return this.rows.length
    }
    getMessage(): string {
        throw new Error(`BUG: Check .isMap() before calling this`)
    }
}

export class MessageLevel extends BaseForLines implements ILevel {
    private message: string
    constructor(source: IGameCode, message: string) {
        super(source)
        this.message = message
    }
    isInvalid(): Optional<string> { return null }
    isMap() {
        return false
    }
    getRows(): IGameTile[][] {
        throw new Error(`BUG: Should have checked isMap first`)
    }
    getMessage() {
        return this.message
    }
}