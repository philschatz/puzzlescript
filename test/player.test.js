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
        engine.pressRight()
        engine.tick()

        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerSprite)).toBe(true)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerSprite)).toBe(false)
    })

    it('players next to each other should move in unison', () => {
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

        PP..

        `) // end game

        const player = data.getPlayer()
        const playerSprite = data._getSpriteByName('player')
        engine.pressRight()
        engine.tick()

        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerSprite)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerSprite)).toBe(true)
        expect(engine.currentLevel[0][2].getSpritesAsSet().has(playerSprite)).toBe(true)
        expect(engine.currentLevel[0][3].getSpritesAsSet().has(playerSprite)).toBe(false)

        engine.pressRight()
        engine.tick()

        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerSprite)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerSprite)).toBe(false)
        expect(engine.currentLevel[0][2].getSpritesAsSet().has(playerSprite)).toBe(true)
        expect(engine.currentLevel[0][3].getSpritesAsSet().has(playerSprite)).toBe(true)
    })


    it('wantsToMove should become applied to sprites in another bracket', () => {
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

        shadow
        black

        ===
        LEGEND
        ===

        . = background
        P = Player
        S = shadow

        ====
        SOUNDS
        ====

        ====
        COLLISIONLAYERS
        ====

        background
        player
        shadow

        ====
        RULES
        ====

        [ > player ] [ shadow ] -> [ > player ] [ > shadow ]

        ===
        WINCONDITIONS
        ===

        ===
        LEVELS
        ===

        P.
        S.

        `) // end game

        const player = data.getPlayer()
        const playerSprite = data._getSpriteByName('player')
        const shadowSprite = data._getSpriteByName('shadow')
        engine.pressRight()
        engine.tick()

        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerSprite)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerSprite)).toBe(true)

        expect(engine.currentLevel[1][0].getSpritesAsSet().has(shadowSprite)).toBe(false)
        expect(engine.currentLevel[1][1].getSpritesAsSet().has(shadowSprite)).toBe(true)
    })

    it('wantsToMove should remain when updating sprites', () => {
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

        [ player ] -> [ player ]

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
        engine.pressRight()
        engine.tick()

        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerSprite)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerSprite)).toBe(true)
    })
})
