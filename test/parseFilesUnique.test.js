/* eslint-env jasmine */
const fs = require('fs')
const path = require('path')
const { default: Parser } = require('../lib/parser/parser')

const GISTS_ROOT = path.join(__dirname, '../gists/')
const GIST_SOLUTIONS_ROOT = path.join(__dirname, '../gist-solutions/')

const describeFn = process.env.CI === 'true' ? describe.skip : describe

describeFn('parsing files unambiguously', () => {

    const gistDirs = fs.readdirSync(GISTS_ROOT)
    // it('checks all files that they parse uniquely', () => {
    gistDirs.forEach(gistDirName => {
        // Only parse files that do not have solutions
        // because solutions will be tested by running the games
        if (!fs.existsSync(path.join(GIST_SOLUTIONS_ROOT, `${gistDirName}.json`))) {
            const codeFile = path.join(GISTS_ROOT, gistDirName, 'script.txt')
            if (fs.existsSync(codeFile)) {
                it (`parses ${gistDirName} uniquely`, () => {
                    const code = fs.readFileSync(codeFile, 'utf-8')
                    Parser.parse(code)
                })
            }
        }
    })
    // })

})
