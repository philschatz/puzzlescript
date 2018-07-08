import * as _ from 'lodash'
import * as ohm from 'ohm-js'
import { GameMetadata } from './metadata'
import { GameSprite, GameLegendTileSimple, IGameTile } from './tile'
import { IRule } from './rule'
import { GameSound } from './sound'
import { LevelMap } from './level'
import { CollisionLayer } from './collisionLayer'
import { WinConditionSimple } from './winCondition'
import { ASTRule } from '../parser/astRule';
import { Optional } from '../util';

export type IGameNode = {
    __getSourceLineAndColumn: () => { lineNum: number, colNum: number }
    __getLineAndColumnRange: () => { start: { line: number, col: number }, end: { line: number, col: number } }
    __coverageCount: Optional<number>
    toString: () => string
}

export type IGameCode = ohm.Interval
interface IGameCodeWithSource extends ohm.Interval {
    sourceString: string
}
// export interface IGameCode extends IGameCode {
//     sourceString: string
//     startIdx: number
//     endIdx: number
//     getLineAndColumnMessage: () => string
// }

export class BaseForLines {
    readonly __source: IGameCode
    __coverageCount: Optional<number>

    constructor(source: IGameCode) {
        if (!source || !source.getLineAndColumnMessage) {
            throw new Error(`BUG: failed to provide the source when constructing this object`)
        }
        this.__source = source
        // This is only used for code coverage
        if (process.env['NODE_ENV'] === 'development') {
            this.__coverageCount = 0
        }
    }
    __getSourceLineAndColumn() {
        const s = <IGameCodeWithSource> this.__source
        return getLineAndColumn(s.sourceString, this.__source.startIdx)
    }
    toString() {
        const s = <IGameCodeWithSource> this.__source
        return s.getLineAndColumnMessage()
    }

    // This is mostly used for creating code coverage for the games. So we know which Rules (or objects) are not being matched
    __getLineAndColumnRange() {
        const s = <IGameCodeWithSource> this.__source
        const start = getLineAndColumn(s.sourceString, this.__source.startIdx)
        const end = getLineAndColumn(s.sourceString, this.__source.endIdx - 1) // subtract one to hopefully get the previous line
        return {
            start: { line: start.lineNum, col: start.colNum },
            end: { line: end.lineNum, col: end.colNum },
        }
    }
    __incrementCoverage() {
        if (process.env['NODE_ENV'] === 'development') {
            if (!this.__coverageCount) {
                this.__coverageCount = 0
            }
            this.__coverageCount++
        }
    }
}

// Return an object with the line and column information for the given
// offset in `str`.
// From https://github.com/harc/ohm/blob/b88336faf69e7bd89e309931b60445c3dfd495ab/src/util.js#L56
function getLineAndColumn(str: string, offset: number) {
    let lineNum = 1
    let colNum = 1

    let currOffset = 0
    let lineStartOffset = 0

    let nextLine = null
    let prevLine = null
    let prevLineStartOffset = -1

    while (currOffset < offset) {
        let c = str.charAt(currOffset++)
        if (c === '\n') {
            lineNum++
            colNum = 1
            prevLineStartOffset = lineStartOffset
            lineStartOffset = currOffset
        } else if (c !== '\r') {
            colNum++
        }
    }
    // Find the end of the target line.
    let lineEndOffset = str.indexOf('\n', lineStartOffset)
    if (lineEndOffset === -1) {
        lineEndOffset = str.length
    } else {
        // Get the next line.
        let nextLineEndOffset = str.indexOf('\n', lineEndOffset + 1)
        nextLine = nextLineEndOffset === -1 ? str.slice(lineEndOffset)
            : str.slice(lineEndOffset, nextLineEndOffset)
        // Strip leading and trailing EOL char(s).
        nextLine = nextLine.replace(/^\r?\n/, '').replace(/\r$/, '')
    }

    // Get the previous line.
    if (prevLineStartOffset >= 0) {
        prevLine = str.slice(prevLineStartOffset, lineStartOffset)
            .replace(/\r?\n$/, '')  // Strip trailing EOL char(s).
    }

    // Get the target line, stripping a trailing carriage return if necessary.
    let line = str.slice(lineStartOffset, lineEndOffset).replace(/\r$/, '')

    return {
        lineNum: lineNum,
        colNum: colNum,
        line: line,
        prevLine: prevLine,
        nextLine: nextLine
    }
}

export class GameData {
    readonly title: string
    readonly metadata: GameMetadata
    readonly objects: GameSprite[]
    readonly legends: GameLegendTileSimple[]
    readonly sounds: GameSound[]
    readonly collisionLayers: CollisionLayer[]
    readonly rules: IRule[]
    readonly winConditions: WinConditionSimple[]
    readonly levels: LevelMap[]

    constructor(
        title: string,
        metadata: GameMetadata,
        objects: GameSprite[],
        legends: GameLegendTileSimple[],
        sounds: GameSound[],
        collisionLayers: CollisionLayer[],
        rules: ASTRule[],
        winConditions: WinConditionSimple[],
        levels: LevelMap[]
    ) {
        this.title = title
        this.metadata = metadata
        this.objects = objects
        this.legends = legends
        this.sounds = sounds
        this.collisionLayers = collisionLayers
        this.winConditions = winConditions
        this.levels = levels

        const ruleCache = new Map()
        const bracketCache = new Map()
        const neighborCache = new Map()
        const tileCache = new Map()
        this.rules = _.flatten(rules.map(rule => rule.simplify(ruleCache, bracketCache, neighborCache, tileCache)))
    }

    _getSpriteByName(name: string) {
        return this.objects.find(sprite => sprite.getName().toLowerCase() === name.toLowerCase())
    }
    _getTileByName(name: string) {
        return this.legends.find(tile => tile.getName().toLowerCase() === name.toLowerCase())
    }

    getMagicBackgroundSprite() {
        let background: Optional<GameSprite> = this._getSpriteByName('background')
        if (!background) {
            const legendBackground = this.legends.find(tile => tile.spriteNameOrLevelChar.toLocaleLowerCase() === 'background')
            if (legendBackground) {
                if (legendBackground.isOr()) {
                    return null
                } else {
                    return legendBackground.getSprites()[0]
                }
            }
        }
        if (!background) {
            throw new Error(`ERROR: Game does not have a Background Sprite or Tile`)
        }
        return background
    }
    getPlayer(): IGameTile {
        const player = this._getSpriteByName('player') || this.legends.find(tile => tile.spriteNameOrLevelChar.toLocaleLowerCase() === 'player')
        if (!player) {
            throw new Error(`BUG: Could not find the Player sprite or tile in the game`)
        }
        return player
    }

    clearCaches() {
        for (const rule of this.rules) {
            rule.clearCaches()
        }
        for (const sprite of this.objects) {
            sprite.clearCaches()
        }
    }
}
