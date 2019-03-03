// This updates the set of Playtested files (so they show up white in the list of games)
const fs = require('fs')
const path = require('path')
const glob = require('glob')
const pify = require('pify')
// const {default: Parser} = require('../lib/parser/parser')

const SOLUTION_FILE = path.join(__dirname, `../src/cli/solvedGames.ts`)
const SOLUTIONS_GLOB = path.join(__dirname, '../game-solutions/*.json')
// const readFile = pify(fs.readFile)

run()

async function run() {
    const gists = await pify(glob)(SOLUTIONS_GLOB)

    const solutionsFileList = [
        `//`,
        `// This file is AUTOGENERATED by doBatchStuff.js`,
        `//`,
        `const solvedGames = new Map<string, string>()`,
        `solvedGames.set('Skipping Stones to Lonely Homes', 'skipping-stones_d6fd6fcf84de185e2584') // hardcoded`,
        `solvedGames.set(\`Spikes \'n\' Stuff\`, 'spikes-n-stuff_dc5c4a669e362e389e994025075f7d0b') // hardcoded`
    ]

    // const promises = []
    const entries = []
    for (const f of gists) {
        const gistId = path.basename(f).replace('.json', '')

        const json = JSON.parse(fs.readFileSync(f, 'utf-8'))
        if (json.solutions && json.solutions.find(s => s && s.solution)) {
            entries.push(`solvedGames.set(\`${json.title}\`, '${gistId}')`)
        }
        // const promise = readFile(`./games/${gistId}/script.txt`, 'utf-8').then(code => {
        //     console.log(`Parsing ${gistId}...`)
        //     const { data, error, trace } = Parser.parse(code)
        //     json.title = data.title
        //     json.totalLevels = data.levels.length
        //     json.totalMapLevels = data.levels.filter(l => l.isMap()).length
        //     fs.writeFileSync(f, JSON.stringify(json, null, 2))
        //     console.log(`Done with ${gistId}`)
        // })
        // promises.push(promise)
    }
    // await Promise.all(promises)

    solutionsFileList.push(entries.join('\n'))
    solutionsFileList.push(`export default solvedGames`)

    fs.writeFileSync(SOLUTION_FILE, solutionsFileList.join('\n') + '\n')
}