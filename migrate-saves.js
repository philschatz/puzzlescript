const fs = require('fs')
const path = require('path')
const glob = require('glob')
const pify = require('pify')
const {default: Parser} = require('./lib/parser/parser')

const readFile = pify(fs.readFile)

run()

async function run() {
    const gists = await pify(glob)('./gist-solutions/*.json')

    const promises = []
    for (const f of gists) {
        const gistId = path.basename(f).replace('.json', '')

        const json = JSON.parse(fs.readFileSync(f, 'utf-8'))
        const promise = readFile(`./gists/${gistId}/script.txt`, 'utf-8').then(code => {
            console.log(`Parsing ${gistId}...`)
            const { data, error, trace } = Parser.parse(code)
            json.title = data.title
            json.totalLevels = data.levels.length
            json.totalMapLevels = data.levels.filter(l => l.isMap()).length
            fs.writeFileSync(f, JSON.stringify(json, null, 2))
            console.log(`Done with ${gistId}`)
        })
        promises.push(promise)
    }
    await Promise.all(promises)
}