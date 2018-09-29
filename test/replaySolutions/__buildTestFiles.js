const { writeFileSync } = require('fs')
const path = require('path')
const glob = require('glob')

glob(path.join(__dirname, '../../gist-solutions/*.json'), (err, matches) => {
    if (err) {
        throw err
    }
    for (const gistJsonName of matches) {
        const gistName = path.basename(gistJsonName).replace(/\.json$/, '')
        const testCode = `const { createTestForGame } = require('./__helper')
createTestForGame('${gistName}')
`
        writeFileSync(path.join(__dirname, `${gistName}.test.js`), testCode)
    }
})
