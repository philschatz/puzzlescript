/* eslint-env jasmine */
const { readFileSync } = require('fs')
const { default: Parser } = require('../lib/parser/parser')

function checkGrammar(code) {
    const grammar = Parser.getGrammar()
    const match = grammar.match(code)
    expect(match.succeeded()).toBe(true)

    const s = grammar.createSemantics()
    s.addOperation('toJSON2', {
        _terminal: function () { return this.primitiveValue },
        _iter: function (children) {
            return children.map(child => child.toJSON2())
        },
        _default: function (children) {
            if (this.ctorName === 'word') {
                return this.sourceString
                // } if (this.ctorName[0] === this.ctorName[0].toLowerCase()) {
                //   return this.ctorName
            } else {
                const obj = {
                    __name: this.ctorName
                }
                children.forEach((child, index) => {
                    const value = child.toJSON2()
                    if (!Array.isArray(value) || value.length >= 1) {
                        obj[`_i${index}`] = value
                    }
                })
                return obj
            }
        }
    })
    const tree = s(match).toJSON2()
    // expect(tree).toMatchSnapshot()
    return tree
}

describe.skip('BIG', () => {
    it('Reads in a big file', () => {
        checkGrammar(readFileSync('./gists/z_on-board_itch/toobig-script.txt', 'utf-8'))
    })
})
