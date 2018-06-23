const fs = require('fs')
const glob = require('glob')
const pify = require('pify')

run()


async function run() {
    const gists = await pify(glob)('./gist-solutions/*.json')

    for (const f of gists) {
        // const gistId = path.basename(f).replace('.json', '')

        const json = JSON.parse(fs.readFileSync(f, 'utf-8'))
        fs.writeFileSync(f, JSON.stringify({version: 1, solutions: json}, null, 2))
    }
}