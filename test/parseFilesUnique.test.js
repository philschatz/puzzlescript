/* eslint-env jasmine */
const fs = require('fs')
const path = require('path')
const { default: Parser } = require('../lib/parser/parser')

const GISTS_ROOT = path.join(__dirname, '../gists/')

describe('parsing files unambiguously', () => {

    if (process.env.SKIP_SOLUTIONS) {
        it('does not do anything because SKIP_SOLUTIONS is set', () => {})
    } else {

        const gistDirs = fs.readdirSync(GISTS_ROOT)
        // it('checks all files that they parse uniquely', () => {
        gistDirs.forEach(gistDirName => {
            const codeFile = path.join(GISTS_ROOT, gistDirName, 'script.txt')
            if (fs.existsSync(codeFile)) {
                it (`parses ${gistDirName} uniquely`, () => {
                    const code = fs.readFileSync(codeFile, 'utf-8')
                    Parser.parse(code)
                })
            }
        })
        // })

    }

})
