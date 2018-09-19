/* eslint-env jasmine */
const fs = require('fs')
const path = require('path')
const { default: Parser } = require('../lib/parser/parser')

const GISTS_ROOT = path.join(__dirname, '../gists/')
const gistDirs = fs.readdirSync(GISTS_ROOT)

describe('parsing files unambiguously', () => {

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
})
