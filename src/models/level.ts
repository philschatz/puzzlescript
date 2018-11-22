import { BaseForLines, IGameCode } from './BaseForLines'
import { IGameTile } from './tile'

export interface ILevel {
    isMap: () => boolean
    getRows: () => IGameTile[][]
    getMessage: () => string
    __incrementCoverage: () => void
    getWidth(): number
    getHeight(): number
}

export class LevelMap extends BaseForLines implements ILevel {
    private rows: IGameTile[][]

    constructor(source: IGameCode, rows: IGameTile[][]) {
        super(source)
        this.rows = rows
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
    public isMap() {
        return false
    }
    public getRows(): IGameTile[][] {
        throw new Error(`BUG: Should have checked isMap first`)
    }
    public getMessage() {
        return this.message
    }
    public getWidth(): number {
        throw new Error(`BUG: Should have checked isMap first`)
    }
    public getHeight(): number {
        throw new Error(`BUG: Should have checked isMap first`)
    }
}
