/* eslint-env jasmine */
const { default: Parser } = require('../lib/parser/parser')
const { default: Serializer } = require('../lib/parser/serializer')

function checkGrammar(code) {
    // check that it does not throw an Error
    const {data} = Parser.parse(code)
    const json = new Serializer(data).toJson()
    expect(json).toMatchSnapshot()
    const game2 = Serializer.fromJson(json, code)

    // verify the toKey representation of all the rules is the same as before
    if (data.rules.length !== game2.rules.length) {
        throw new Error(`BUG: rule lengths do not match`)
    }
    data.rules.forEach((rule, index) => {
        const rule2 = game2.rules[index]
        // if (rule.toKey() !== rule2.toKey()) {
        //     debugger
        //     throw new Error(`BUG: rule.toKey mismatch.\norig=${rule.toKey()}\nnew =${rule2.toKey()}`)
        // }
        expect(rule.toKey()).toEqual(rule2.toKey())
    })

    // const json2 = new Serializer(game2).toJson()
    // expect(json2).toEqual(json)
}


describe('serializer', () => {
    it('parses an empty game', () => {
        checkGrammar(`title Test Game`)
    })

    it('parses a simple game', () => {
        checkGrammar(`title Test Game
===
OBJECTS
===

background .
black

player P
yellow

===
COLLISIONLAYERS
===

background
player

===
RULES
===

[ NO player | background ] -> [ RANDOM player | > background ]

===
LEVELS
===

MESSAGE hello

..P..

`)
    })
})
