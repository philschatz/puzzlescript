import * as _ from 'lodash'
import { GameMetadata } from './metadata'
import { GameSprite, GameLegendTileSimple, IGameTile } from './tile'
import { GameRule, SimpleRule, IRule } from './rule'
import { GameSound } from './sound'
import { LevelMap } from './level'
import { CollisionLayer } from './collisionLayer'
import { WinConditionSimple } from './winCondition'
import { Cell } from '../engine'

export interface IGameNode {
    __getSourceLineAndColumn: () => { lineNum: number, colNum: number }
    __getLineAndColumnRange: () => { start: { line: number, col: number }, end: { line: number, col: number } }
    __coverageCount: number
    toString: () => string
}

export interface IGameCode {
    sourceString: string
    startIdx: number
    endIdx: number
    getLineAndColumnMessage: () => string
}

export class BaseForLines {
    __source: IGameCode
    __coverageCount: number

    constructor(source: IGameCode) {
        if (!source || !source.getLineAndColumnMessage) {
            throw new Error(`BUG: failed to provide the source when constructing this object`)
        }
        Object.defineProperty(this, '__source', {
            get: function () { return source }
        })
        // This is only used for code coverage
        if (process.env['NODE_ENV'] !== 'production') {
            this.__coverageCount = 0
        }
    }
    __getSourceLineAndColumn() {
        return getLineAndColumn(this.__source.sourceString, this.__source.startIdx)
    }
    toString() {
        return this.__source.getLineAndColumnMessage()
    }

    // This is mostly used for creating code coverage for the games. So we know which Rules (or objects) are not being matched
    __getLineAndColumnRange() {
        const start = getLineAndColumn(this.__source.sourceString, this.__source.startIdx)
        const end = getLineAndColumn(this.__source.sourceString, this.__source.endIdx - 1) // subtract one to hopefully get the previous line
        return {
            start: { line: start.lineNum, col: start.colNum },
            end: { line: end.lineNum, col: end.colNum },
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
    title: string
    metadata: GameMetadata
    objects: GameSprite[]
    legends: GameLegendTileSimple[]
    sounds: GameSound[]
    collisionLayers: CollisionLayer[]
    rules: IRule[]
    winConditions: WinConditionSimple[]
    levels: LevelMap[]

    constructor(
        title: string,
        metadata: GameMetadata,
        objects: GameSprite[],
        legends: GameLegendTileSimple[],
        sounds: GameSound[],
        collisionLayers: CollisionLayer[],
        rules: GameRule[],
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
        return this.objects.filter(sprite => sprite._getName().toLowerCase() === name.toLowerCase())[0]
    }

    getMagicBackgroundSprite() {
        return this._getSpriteByName('background') || this.legends.find(tile => tile._spriteNameOrLevelChar.toLocaleLowerCase() === 'background').getSprites()[0]
    }
    getPlayer(): IGameTile {
        return this._getSpriteByName('player') || this.legends.find(tile => tile._spriteNameOrLevelChar.toLocaleLowerCase() === 'player')
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

export class GameMessage extends BaseForLines {
    _message: string

    constructor(source: IGameCode, message: string) {
        super(source)
        this._message = message
    }
    isInvalid(): string {
        return null
    }
    isMap() {
        return false
    }
}