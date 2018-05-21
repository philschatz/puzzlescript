import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pify from 'pify'

import Parser from './parser/parser'
import { IGameNode } from './models/game'
import UI from './ui'
import Engine from './engine'
import { setAddAll } from './util';
import { start } from 'repl';

let totalRenderTime = 0

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
type CoverageStatements = {[id: string]: CoverageLocationRange}
type CoverageFunctions = {[id: string]: CoverageFunction}
type CoverageEntry = {
  path: string
  s: CoverageCount
  f: CoverageCount
  statementMap: CoverageStatements
  fnMap: CoverageFunctions
  branchMap: object
  b: object
}

async function run() {
  const files = await pify(glob)('./gists/*/script.txt')
  console.log(`Looping over ${files.length} games...`)

  for (let filename of files) {
    console.log(`Parsing and rendering ${filename}`)
    const code = readFileSync(filename, 'utf-8')
    const { data, error, trace, validationMessages } = Parser.parse(code)

    if (error) {
      console.log(trace.toString())
      console.log(error.message)
      throw new Error(filename)
    } else {
      // console.log(data.title)
      // return

      if (validationMessages) {
        validationMessages.forEach(({ gameNode, level, message }) => {
          const { lineNum, colNum } = gameNode.__getSourceLineAndColumn()
          console.warn(`(${lineNum}:${colNum}) ${level} : ${message}`)
        })
      }

      // Draw the "last" level (after the messages)
      const level = data.levels.filter(level => level.isMap())[0]
      if (level) {
        const engine = new Engine(data)
        engine.setLevel(data.levels.indexOf(level))
        // engine.on('cell:updated', cell => {
        //   UI.drawCellAt(data, cell, cell.rowIndex, cell.colIndex, false)
        // })

        let startTime = Date.now()
        UI.renderScreen(data, engine.currentLevel)
        totalRenderTime += Date.now() - startTime

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
        // data.objects.forEach(addNodeToCoverage)
        // data.legends.forEach(addNodeToCoverage)
        // data.sounds.forEach(addNodeToCoverage)
        // data.collisionLayers.forEach(addNodeToCoverage) // these entries are sometimes (always?) null
        data.rules.forEach(addNodeToCoverage)
        data.winConditions.forEach(addNodeToCoverage)
        // data.levels.forEach(addNodeToCoverage)


        for (var i = 0; i < 10; i++) {
          await sleep(500)
          const {appliedRules, movedCells} = engine.tick()


          // Draw any cells that moved
          movedCells.forEach(cell => {
            UI.drawCell(data, cell, true)
          })

          if (appliedRules.size === 0) {
            break
          }

          // UI.renderScreen(data, engine.currentLevel)
          let changedCells = new Set()
          for (const [rule, cellsCovered] of appliedRules.entries()) {
            changedCells = setAddAll(changedCells, cellsCovered)
          }

          startTime = Date.now()
          for (const cell of changedCells) {
            UI.drawCell(data, cell, false)
          }
          totalRenderTime += Date.now() - startTime

          // record the tick coverage
          for (const [rule, cellsCovered] of appliedRules.entries()) {
            const line = coverageKey(rule)
            if (!codeCoverageTemp.has(line)) {
              codeCoverageTemp.set(line, 0)
            }
            codeCoverageTemp.set(line, codeCoverageTemp.get(line) + 1)
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
        codeCoverage2.forEach((entry: {loc: CoverageLocationRange, count: number}, index) => {
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

        const absPath = path.resolve(filename)
        const gistName = path.basename(path.dirname(filename))
        const codeCoverageEntry: CoverageEntry = {
          path: absPath,
          s: s,
          statementMap: statementMap,
          fnMap: fnMap,
          f: f,
          branchMap: {},
          b: {}
        }
        const codeCoverageObj: {[path: string]: CoverageEntry} = {}
        codeCoverageObj[absPath] = codeCoverageEntry
        writeFileSync(`coverage/coverage-gists-${gistName}.json`, JSON.stringify(codeCoverageObj, null, 2)) // indent by 2 chars
      }

      UI.clearScreen()
    }
  }

  console.log('-----------------------')
  console.log('Renderings took:', totalRenderTime)
  console.log('-----------------------')
}

run()
