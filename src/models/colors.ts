import { BaseForLines, IGameCode, IGameNode } from './game'

export interface IColor extends IGameNode {
    isTransparent: () => boolean
    toRgb: () => RGB
}

export class HexColor extends BaseForLines implements IColor {
    _color: RGB
    _colorName: string // only for unit tests & debugging

    constructor(source: IGameCode, color: string) {
        super(source)
        this._color = hexToRgb(color)
        this._colorName = color
    }

    isTransparent() { return false }
    toRgb() {
        return this._color
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
    r: number
    g: number
    b: number

    constructor(r: number, g: number, b: number) {
        this.r = r
        this.g = g
        this.b = b
    }
}