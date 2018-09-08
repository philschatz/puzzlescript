import * as ohm from 'ohm-js'
import { Optional } from '../util';

export type IGameCode = ohm.Interval
export interface IGameCodeWithSource extends ohm.Interval {
    sourceString: string
}
// Return an object with the line and column information for the given
// offset in `str`.
// From https://github.com/harc/ohm/blob/b88336faf69e7bd89e309931b60445c3dfd495ab/src/util.js#L56
export function getLineAndColumn(str: string, offset: number) {
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

export class BaseForLines {
    readonly __source: IGameCode;
    __coverageCount: Optional<number>;
    constructor(source: IGameCode) {
        if (!source || !source.getLineAndColumnMessage) {
            throw new Error(`BUG: failed to provide the source when constructing this object`);
        }
        this.__source = source;
        // This is only used for code coverage
        if (process.env['NODE_ENV'] === 'development') {
            this.__coverageCount = 0;
        }
    }
    __getSourceLineAndColumn() {
        const s = <IGameCodeWithSource>this.__source;
        return getLineAndColumn(s.sourceString, this.__source.startIdx);
    }
    toString() {
        const s = <IGameCodeWithSource>this.__source;
        return s.getLineAndColumnMessage();
    }
    toSourceString() {
        const s = <IGameCodeWithSource>this.__source;
        return s.trimmed().contents;
    }
    // This is mostly used for creating code coverage for the games. So we know which Rules (or objects) are not being matched
    __getLineAndColumnRange() {
        const s = <IGameCodeWithSource>this.__source;
        const start = getLineAndColumn(s.sourceString, this.__source.startIdx);
        const end = getLineAndColumn(s.sourceString, this.__source.endIdx - 1); // subtract one to hopefully get the previous line
        return {
            start: { line: start.lineNum, col: start.colNum },
            end: { line: end.lineNum, col: end.colNum },
        };
    }
    __incrementCoverage() {
        if (process.env['NODE_ENV'] === 'development') {
            if (!this.__coverageCount) {
                this.__coverageCount = 0;
            }
            this.__coverageCount++;
        }
    }
}