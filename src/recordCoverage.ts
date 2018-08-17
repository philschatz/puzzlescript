import { GameData, IGameNode } from "./models/game";
import { writeFileSync, existsSync } from "fs";
import { IRule } from "./models/rule";

// These types are just so that the Code Coverage JSON objects are strongly-typed
type CoverageLocation = {
    line: number
    col: number
}
type CoverageLocationRange = {
    start: CoverageLocation
    end: CoverageLocation
}
type CoverageFunction = {
    name: string,
    decl: CoverageLocationRange,
    loc: CoverageLocationRange,
    line: number
}
type CoverageCount = { [id: string]: number }
type CoverageStatements = { [id: string]: CoverageLocationRange }
type CoverageFunctions = { [id: string]: CoverageFunction }
type CoverageEntry = {
    path: string
    s: CoverageCount
    f: CoverageCount
    statementMap: CoverageStatements
    fnMap: CoverageFunctions
    branchMap: object
    b: object
}

export function saveCoverageFile(data: GameData, absPath: string, coverageFilenameSuffix: string) {
    // record the appliedRules in a coverage.json file
    const codeCoverageTemp = new Map<string, {count: number, node: IGameNode}>() // key = Line number, value = count of times the rule executed

    // First add all the Tiles, Legend Items, collisionLayers, Rules, and Levels.
    // Then, after running, add all the matched rules.
    function coverageKey(node: IGameNode) {
        // the HTML reporter does not like multiline fields. Rather than report multiple times, we just report the 1st line
        // This is a problem with `startloop`
        const { start, end } = node.__getLineAndColumnRange()
        if (start.line !== end.line) {
            return JSON.stringify({
                start: {
                    line: start.line,
                    col: start.col - 1
                },
                end: {
                    line: start.line,
                    col: start.col + 3
                }
            })
        } else {
            return JSON.stringify({
                start: {
                    line: start.line,
                    col: start.col - 1
                },
                end: {
                    line: end.line,
                    col: end.col - 1
                }
            })
        }
    }
    function addNodeToCoverage(node: IGameNode) {
        codeCoverageTemp.set(coverageKey(node), {count: 0, node})
    }
    // data.objects.forEach(addNodeToCoverage)
    // data.legends.forEach(addNodeToCoverage)
    // data.sounds.forEach(addNodeToCoverage)
    // data.collisionLayers.forEach(addNodeToCoverage) // these entries are sometimes (always?) null
    data.rules.forEach(addNodeToCoverage)
    data.winConditions.forEach(addNodeToCoverage)
    // data.levels.forEach(addNodeToCoverage)


    function recursivelyGetRules(rules: IRule[]) {
        let ret: IRule[] = []
        for (const rule of rules) {
            ret.push(rule)
            ret = ret.concat(recursivelyGetRules(rule.getChildRules()))
        }
        return ret
    }

    // record the tick coverage
    const ary = new Array<IGameNode>()
    const nodesToCover = ary.concat(recursivelyGetRules(data.rules))/*.concat(data.objects).concat(data.legends)*/.concat(data.winConditions)/*.concat(data.levels)*/
    for (const node of nodesToCover) {
        const line = coverageKey(node)
        const nodeCount = node.__coverageCount || 0
        const existingEntry = codeCoverageTemp.get(line)
        if (existingEntry) {
            codeCoverageTemp.set(line, {count: existingEntry.count + nodeCount, node})
        } else {
            codeCoverageTemp.set(line, {count: nodeCount, node})
        }
    }

    const codeCoverage2 = [...codeCoverageTemp.entries()].map(([key, {count, node}]) => {
        const loc = <CoverageLocationRange> JSON.parse(key)
        return { loc: loc, count, node }
    })
    // Generate the coverage.json file from which Rules were applied
    const statementMap: CoverageStatements = {}
    const fnMap: CoverageFunctions = {}
    const f: CoverageCount = {}
    const s: CoverageCount = {}

    // Add all the matched rules
    codeCoverage2.forEach((entry, index) => {
        let { loc, count, node } = entry

        // sometimes count can be null
        if (!(count >= 0)) {
            count = 0
        }
        s[index] = count
        statementMap[index] = loc
        f[index] = count
        fnMap[index] = {
            name: node.toSourceString(),
            decl: loc,
            loc: loc,
            line: loc.start.line
        }
})

    const codeCoverageEntry: CoverageEntry = {
        path: absPath,
        s: s,
        statementMap: statementMap,
        fnMap: fnMap,
        f: f,
        branchMap: {},
        b: {}
    }
    const codeCoverageObj: { [path: string]: CoverageEntry } = {}
    codeCoverageObj[absPath] = codeCoverageEntry
    if (existsSync(`coverage`)) {
        writeFileSync(`coverage/coverage-${coverageFilenameSuffix}.json`, JSON.stringify(codeCoverageObj, null, 2)) // indent by 2 chars
    }
}