/* eslint-env jasmine */
const { LevelEngine } = require('../lib/engine')
const { default: Parser } = require('../lib/parser/parser')


function parseEngine(code) {
    const { data, error } = Parser.parse(code)
    expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

    const engine = new LevelEngine(data)
    engine.setLevel(0)
    return { engine, data }
}

function buildGame(winConditions) {
    return `title foo

    ========
    OBJECTS
    ========

    Background .
    gray

    Player
    transparent

    Hat H
    transparent

    Glasses
    transparent

    Dog D
    transparent

    Cat
    transparent

    =======
    LEGEND
    =======

    P = Player AND Glasses AND Hat
    L = Player

    =======
    SOUNDS
    =======

    ================
    COLLISIONLAYERS
    ================
    Background
    Player
    Hat
    Glasses
    Dog
    Cat

    ======
    RULES
    ======

    ==============
    WINCONDITIONS
    ==============

    ${winConditions.join('\n')}

    =======
    LEVELS
    =======

    PDHL

`
}

describe('Win Conditions', () => {

    it('detects conditions for simple checks', () => {
        function simple(conditions, expected) {
            const { engine, data } = parseEngine(buildGame(conditions))
            const {isWinning} = engine.tick()
            expect(isWinning).toBe(expected)
        }
        simple(['NO Player'], false)
        simple(['NO Cat'], true)
        simple(['SOME Cat'], false)
        simple(['SOME Player'], true)
        simple(['ALL Glasses ON Player'], true)
        simple(['SOME Glasses ON Player'], true)
        simple(['NO Glasses ON Player'], false)
        // All Target on CleanDishes
        simple(['ALL Player ON Hat'], false)
        simple(['NO Dog ON Player'], true)
        simple(['ALL Dog ON Player'], false)
        simple(['SOME Dog ON Player'], false)

    })


})
