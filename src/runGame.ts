import { readFileSync, writeFileSync } from 'fs'
import * as path from 'path'
import * as glob from 'glob'
import * as pify from 'pify'

import Parser from './parser'
import UI from './ui'
import Engine from './engine'

let totalRenderTime = 0

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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

      const startTime = Date.now()

      // Draw the "last" level (after the messages)
      const level = data.levels.filter(level => level.isMap())[0]
      if (level) {
        const engine = new Engine(data)
        engine.setLevel(data.levels.indexOf(level))
        engine.on('cell:updated', cell => {
          UI.drawCellAt(data, cell, cell.rowIndex, cell.colIndex, false)
        })

        UI.renderScreen(data, engine.currentLevel)

        // record the changes in a coverage.json file
        const codeCoverageTemp = {} // key = Line number, value = count of times the rule executed

        // First add all the Tiles, Legend Items, collisionLayers, Rules, and Levels.
        // Then, after running, add all the matched rules.
        function coverageKey(node) {
          // the HTML reporter does not like multiline fields. Rather than report multiple times, we just report the 1st line
          // This is a problem with `startloop`
          const { start, end } = node.__getLineAndColumnRange()
          if (start.line !== end.line) {
            return JSON.stringify({ start, end: { line: start.line, col: start.col + 3 } })
          }
          return JSON.stringify({ start, end })
        }
        function addNodeToCoverage(node) {
          codeCoverageTemp[coverageKey(node)] = 0
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
          const changes = engine.tick()
          if (changes.size === 0) {
            break
          }

          // record the tick coverage
          for (const [rule, cellsCovered] of changes.entries()) {
            const line = coverageKey(rule)
            if (!codeCoverageTemp[line]) {
              codeCoverageTemp[line] = 0
            }
            codeCoverageTemp[line] = codeCoverageTemp[line] + 1
          }
        }

        const codeCoverage2 = Object.entries(codeCoverageTemp).map(([key, value]) => {
          return { loc: JSON.parse(key), count: value }
        })
        // Generate the coverage.json file from which Rules were applied
        const statementMap = {}
        const fnMap = {}
        const f = {}
        const s = {}

        // Add all the matched rules
        codeCoverage2.forEach(({ loc, count }, index) => {

          s[index] = count
          statementMap[index] = loc
          f[index] = count
          fnMap[index] = {
            name: "foo",
            decl: loc
            loc: loc,
            line: loc.start.line
          }

        })

        const absPath = path.resolve(filename)
        const gistName = path.basename(path.dirname(filename))
        const codeCoverageEntry = {
          path: absPath,
          s: s,
          statementMap: statementMap,
          fnMap: fnMap,
          f: f,
          branchMap: {},
          b: {}
        }
        const codeCoverageObj = {}
        codeCoverageObj[absPath] = codeCoverageEntry
        writeFileSync(`coverage/coverage-gists-${gistName}.json`, JSON.stringify(codeCoverageObj, null, 2)) // indent by 2 chars
      }

      UI.clearScreen()
      totalRenderTime += Date.now() - startTime
    }
  }

  console.log('-----------------------')
  console.log('Renderings took:', totalRenderTime)
  console.log('-----------------------')
}

run()
