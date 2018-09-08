import { IGameNode } from './game'
import { BaseForLines, IGameCode } from "./BaseForLines";

export interface IColor extends IGameNode {
    isTransparent: () => boolean
    toRgb: () => RGB
    toHex: () => string
}

export class HexColor extends BaseForLines implements IColor {
    private hex: string

    constructor(source: IGameCode, hex: string) {
        super(source)
        this.hex = hex
    }

    isTransparent() { return false }
    toRgb() {
        return hexToRgb(this.hex)
    }
    toHex() {
        return this.hex
    }
}

export class TransparentColor extends BaseForLines implements IColor {
    constructor(source: IGameCode) {
        super(source)
    }

    isTransparent() { return true }
    toRgb(): RGB {
        throw new Error('BUG: Transparent colors do not have RGB data')
    }
    toHex(): string {
        throw new Error('BUG: Transparent colors do not have a hex color value')
    }
}

function hexToRgb(hex: string) {
    // https://stackoverflow.com/a/5624139
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b
    })

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (result) {
        return new RGB(
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16),
        )
    } else {
        throw new Error('BUG: hex color was invalid')
    }
}

class RGB {
    readonly r: number
    readonly g: number
    readonly b: number

    constructor(r: number, g: number, b: number) {
        this.r = r
        this.g = g
        this.b = b
    }
}