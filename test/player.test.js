/* eslint-env jasmine */
const { default: Engine } = require('../src/engine')
const { default: Parser } = require('../src/parser/parser')

function parseEngine(code) {
    const { data, error } = Parser.parse(code)
    expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

    const engine = new Engine(data)
    engine.setLevel(0)
    return { engine, data }
}

describe('player movement', () => {
    it('evaluates a simple game', () => {
        const { engine, data } = parseEngine(`title foo

        (verbose_logging)
        (debug)

        (run_rules_on_level_start)

        realtime_interval 0.1


        ===
        OBJECTS
        ===

        background
        green

        player
        Yellow

        ===
        LEGEND
        ===

        . = background
        P = Player

        ====
        SOUNDS
        ====

        ====
        COLLISIONLAYERS
        ====

        background
        player

        ====
        RULES
        ====

        ===
        WINCONDITIONS
        ===

        ===
        LEVELS
        ===

        P.

        `) // end game

        const player = data.getPlayer()
        const playerSprite = data._getSpriteByName('player')
        debugger
        engine.pressRight()
        engine.tick()

        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerSprite)).toBe(true)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerSprite)).toBe(false)
    })

})
