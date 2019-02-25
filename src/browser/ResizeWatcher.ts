import { _debounce } from '../util'

export default class ResizeWatcher {
    private readonly table: HTMLTableElement
    private readonly handler: (width: number) => void
    private readonly boundResizeHandler: any
    private columns: number
    private rows: number

    constructor(table: HTMLTableElement, handler: (width: number) => void) {
        this.table = table
        this.handler = handler
        this.columns = 1
        this.rows = 1
        this.boundResizeHandler = _debounce(this.trigger.bind(this))

        window.addEventListener('resize', this.boundResizeHandler)
    }

    public setLevel(rows: number, columns: number) {
        this.rows = rows
        this.columns = columns
    }

    public trigger() {
        // Resize the table so that it fits.
        const levelRatio = this.columns / this.rows
        // Figure out if the width or the height is the limiting factor
        const availableWidth = window.innerWidth - this.table.offsetLeft
        const availableHeight = window.innerHeight - this.table.offsetTop
        let newWidth = 0
        if (availableWidth / levelRatio < availableHeight) {
            // Width is the limiting factor
            newWidth = availableWidth
        } else {
            // Height is the limiting factor
            newWidth = availableHeight * levelRatio
        }
        this.handler(Math.floor(newWidth))
    }

    public dispose() {
        window.removeEventListener('resize', this.boundResizeHandler)
    }
}
