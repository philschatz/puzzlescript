import { GameData, IGameNode } from "./models/game";
import { writeFileSync } from "fs";
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
    const codeCoverageTemp = new Map() // key = Line number, value = count of times the rule executed

    // First add all the Tiles, Legend Items, collisionLayers, Rules, and Levels.
    // Then, after running, add all the matched rules.
    function coverageKey(node: IGameNode) {
        // the HTML reporter does not like multiline fields. Rather than report multiple times, we just report the 1st line
        // This is a problem with `startloop`
        const { start, end } = node.__getLineAndColumnRange()
        if (start.line !== end.line) {
            return JSON.stringify({ start, end: { line: start.line, col: start.col + 3 } })
        }
        return JSON.stringify({ start, end })
    }
    function addNodeToCoverage(node: IGameNode) {
        codeCoverageTemp.set(coverageKey(node), 0)
    }
    data.objects.forEach(addNodeToCoverage)
    data.legends.forEach(addNodeToCoverage)
    // data.sounds.forEach(addNodeToCoverage)
    // data.collisionLayers.forEach(addNodeToCoverage) // these entries are sometimes (always?) null
    data.rules.forEach(addNodeToCoverage)
    data.winConditions.forEach(addNodeToCoverage)
    // data.levels.forEach(addNodeToCoverage)


    function recursivelyGetRules(rules: IRule[]) {
        let ret = []
        for (const rule of rules) {
            ret.push(rule)
            ret = ret.concat(recursivelyGetRules(rule.getChildRules()))
        }
        return ret
    }

    // record the tick coverage
    for (const node of [].concat(recursivelyGetRules(data.rules)).concat(data.objects).concat(data.legends)/*.concat(data.levels)*/) {
        const line = coverageKey(node)
        if (codeCoverageTemp.has(line)) {
            codeCoverageTemp.set(line, codeCoverageTemp.get(line) + node.__coverageCount)
        } else {
            codeCoverageTemp.set(line, node.__coverageCount)
        }
    }

    const codeCoverage2 = [...codeCoverageTemp.entries()].map(([key, value]) => {
        return { loc: JSON.parse(key), count: value }
    })
    // Generate the coverage.json file from which Rules were applied
    const statementMap: CoverageStatements = {}
    const fnMap: CoverageFunctions = {}
    const f: CoverageCount = {}
    const s: CoverageCount = {}

    // Add all the matched rules
    codeCoverage2.forEach((entry: { loc: CoverageLocationRange, count: number }, index) => {
        const { loc, count } = entry

        s[index] = count
        statementMap[index] = loc
        f[index] = count
        fnMap[index] = {
            name: "foo",
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
    writeFileSync(`coverage/coverage-${coverageFilenameSuffix}.json`, JSON.stringify(codeCoverageObj, null, 2)) // indent by 2 chars
}