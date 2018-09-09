import { Optional } from '../util'
import { BaseForLines, IGameCode } from './BaseForLines'
import { IGameTile } from './tile'

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
    public isInvalid(): Optional<string> {
        const firstRowLength = this.rows[0].length
        let isInvalid = null
        this.rows.forEach((row, index) => {
            if (firstRowLength !== row.length) {
                isInvalid = `Row ${index + 1} does not have the same column count as the first row. Expected ${firstRowLength} columns but found ${row.length}.`
            }
        })
        return isInvalid
    }
    public isMap() {
        return true
    }
    public getRows() {
        return this.rows
    }
    public getWidth() {
        return this.rows[0].length
    }
    public getHeight() {
        return this.rows.length
    }
    public getMessage(): string {
        throw new Error(`BUG: Check .isMap() before calling this`)
    }
}

export class MessageLevel extends BaseForLines implements ILevel {
    private message: string
    constructor(source: IGameCode, message: string) {
        super(source)
        this.message = message
    }
    public isInvalid(): Optional<string> { return null }
    public isMap() {
        return false
    }
    public getRows(): IGameTile[][] {
        throw new Error(`BUG: Should have checked isMap first`)
    }
    public getMessage() {
        return this.message
    }
}
