const fs = require('fs')
const path = require('path')
const glob = require('glob')
const pify = require('pify')
const {default: Parser} = require('./lib/parser/parser')

const readFile = pify(fs.readFile)

run()

async function run() {
    const gists = await pify(glob)('./gists/*/script.txt')

    const promises = []
    for (const f of gists) {
        const promise = readFile(f, 'utf-8').then(code => {
            const { data, error, trace } = Parser.parse(code)
            if (data.metadata.homepage === 'rosden.itch.io') {
                console.error(`YAY! ${data.title}`)
            }
        })
        promises.push(promise)
    }
    await Promise.all(promises)
}