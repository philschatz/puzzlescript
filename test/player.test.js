/* eslint-env jasmine */
const fs = require('fs')
const path = require('path')
const { LevelEngine } = require('../lib/engine')
const { default: Parser } = require('../lib/parser/parser')
const { RULE_DIRECTION } = require('../lib/util')


function parseEngine(code, levelNum = 0) {
    const { data, error } = Parser.parse(code)
    expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

    const engine = new LevelEngine(data)
    engine.setLevel(levelNum)
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
        engine.press(RULE_DIRECTION.RIGHT)
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
        engine.press(RULE_DIRECTION.RIGHT)
        engine.tick()

        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerSprite)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerSprite)).toBe(true)
        expect(engine.currentLevel[0][2].getSpritesAsSet().has(playerSprite)).toBe(true)
        expect(engine.currentLevel[0][3].getSpritesAsSet().has(playerSprite)).toBe(false)

        engine.press(RULE_DIRECTION.RIGHT)
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
        engine.press(RULE_DIRECTION.RIGHT)
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
        engine.press(RULE_DIRECTION.RIGHT)
        engine.tick()

        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerSprite)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerSprite)).toBe(true)
    })

    it('wantsToMove should be removed when the condition has a direction but the right does not', () => {
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

        [ > Player ] -> [ Player ]

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
        engine.press(RULE_DIRECTION.RIGHT)
        engine.tick()

        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerSprite)).toBe(true)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerSprite)).toBe(false)
    })

    it('only creates one Player when Player is an OR tile', () => {
        const { engine, data } = parseEngine(`title foo

        ===
        OBJECTS
        ===

        background
        green

        player1
        Yellow

        player2
        blue

        ===
        LEGEND
        ===

        . = background
        P = Player1
        Player = player1 OR player2

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

        P..

        `) // end game

        const player1 = data._getSpriteByName('player1')
        const player2 = data._getSpriteByName('player2')
        engine.press(RULE_DIRECTION.RIGHT)
        engine.tick()

        expect(player1.getCellsThatMatch().size).toBe(1)
        expect(player2.getCellsThatMatch().size).toBe(0)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(player1)).toBe(true)
    })

    it('preserves wantsToMove when sprite changes', () => {
        const { engine, data } = parseEngine(`title foo

        ===
        OBJECTS
        ===

        background
        green

        player1
        Yellow

        player2
        blue

        ===
        LEGEND
        ===

        . = background
        P = Player1 AND Background
        Player = player1 OR player2

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

        [ Player ] -> [ Player1 ]

        ===
        WINCONDITIONS
        ===

        ===
        LEVELS
        ===

        P.

        `) // end game

        const player1 = data._getSpriteByName('player1')
        engine.press(RULE_DIRECTION.RIGHT)
        engine.tick()

        expect(player1.getCellsThatMatch().size).toBe(1)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(player1)).toBe(true)
    })

    it('plays a level of Beam Islands', () => {
        const LEVEL_NUM = 3
        const LEVEL_SOLUTION = 'lluuuxlduruuxddddd'
        const { engine, data } = parseEngine(fs.readFileSync(path.join(__dirname, '../gists/2b9ece642cd7cdfb4a5f2c9fa8455e40/script.txt'), 'utf-8'), LEVEL_NUM) // end game
        let didWin = false

        const keypresses = LEVEL_SOLUTION.split('')
        for (const key of keypresses) {
            switch(key) {
                case 'u': engine.press(RULE_DIRECTION.UP); break
                case 'd': engine.press(RULE_DIRECTION.DOWN); break
                case 'l': engine.press(RULE_DIRECTION.LEFT); break
                case 'r': engine.press(RULE_DIRECTION.RIGHT); break
                case 'x': engine.press(RULE_DIRECTION.ACTION); break
            }
            const {isWinning} = engine.tick()
            if (isWinning) {
                didWin = true
            }
        }
        expect(didWin).toBe(true)
    })

})
