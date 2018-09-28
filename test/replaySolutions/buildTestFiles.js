const { writeFileSync } = require('fs')
const { join: pathJoin } = require('path')

const MAX = 40

for (let i = 0; i < MAX; i++) {
    const testCode = `const { createTests } = require('./helper')
createTests(${i}, ${MAX})
`
    writeFileSync(pathJoin(__dirname, `${i}.test.js`), testCode)
}
