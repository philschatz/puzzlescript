/* eslint-env jasmine */
const { LevelEngine } = require('../lib/engine')
const { default: Parser } = require('../lib/parser/parser')

const HORIZONTAL_GAME = `title check that Horizontal Expands

========
OBJECTS
========

Background
blue

Player
green

Sand
yellow

Water
Blue

=======
LEGEND
=======

. = Background

================
COLLISIONLAYERS
================

Background
Player
Sand
Water

======
RULES
======

LEFT [ HORIZONTAL Player > Water ] -> [ UP Sand ]

=======
LEVELS
=======

.


` // end game

function parseEngine(code) {
    const { data, error } = Parser.parse(code)
    expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

    const engine = new LevelEngine(data)
    engine.setLevel(0)
    return { engine, data }
}

describe('Rule simplifier', () => {
    it('expands horizontal rules', () => {
        const { engine, data } = parseEngine(HORIZONTAL_GAME)
        const foo = data.rules
        expect(foo.length).toBe(1)
        expect(foo[0].rules.length).toBe(2)
    })

    it('treats adjacent neighbors that are the same as distinct (e.g. [ Wall | Wall ]', () => {
        const { engine, data } = parseEngine(`title check that Horizontal Expands

    ========
    OBJECTS
    ========

    Background
    blue

    Player
    green

    Wall
    yellow

    RightExtension
    Blue

    =======
    LEGEND
    =======

    W = Wall

    ================
    COLLISIONLAYERS
    ================

    Background
    Player
    Wall
    RightExtension

    ======
    RULES
    ======

    RIGHT [ Wall | Wall ] -> [ RightExtension | RightExtension ]

    =======
    LEVELS
    =======

    WW

    `) // end game
        const rightExtension = data._getSpriteByName('RightExtension')
        engine.tick()

        expect(engine.currentLevel.getCells()[0][0].getSpritesAsSet().has(rightExtension)).toBe(true)
    })

    it('converts VERTICAL and HORIZONTAL at the beginning of a rule into 2 rules', () => {
        const { engine, data } = parseEngine(`title check that Horizontal Expands

        ========
        OBJECTS
        ========

        Background
        black

        Player
        green

        SimpleWall
        Yellow

        PrettyHorizWall
        Blue
        .....
        .....
        00000
        .....
        .....

        PrettyVertWall
        Blue
        ..0..
        ..0..
        ..0..
        ..0..
        ..0..


        =======
        LEGEND
        =======

        . = Background
        W = SimpleWall
        Wall = SimpleWall OR PrettyHorizWall OR PrettyVertWall

        ===
        SOUNDS
        ===

        ================
        COLLISIONLAYERS
        ================

        Background
        Player
        Wall, PrettyHorizWall, PrettyVertWall

        ======
        RULES
        ======

        HORIZONTAL [ Wall | SimpleWall | Wall ] -> [ Wall | PrettyHorizWall | Wall ]
        VERTICAL [ Wall | SimpleWall | Wall ] -> [ Wall | PrettyVertWall | Wall ]

        ===
        WINCONDITIONS
        ===

        =======
        LEVELS
        =======

        WWWW
        W..W
        W..W
        WWWW

    `) // end game
        const horiz = data._getSpriteByName('PrettyHorizWall')
        const vert = data._getSpriteByName('PrettyVertWall')
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(data.rules.length).toBe(2)
        expect(data.rules[0].rules.length).toBe(2) // just LEFT RIGHT
        expect(data.rules[1].rules.length).toBe(2) // just UP DOWN

        expect(engine.currentLevel.getCells()[0][1].getSpritesAsSet().has(horiz)).toBe(true)
        expect(engine.currentLevel.getCells()[0][2].getSpritesAsSet().has(horiz)).toBe(true)

        expect(engine.currentLevel.getCells()[3][1].getSpritesAsSet().has(horiz)).toBe(true)
        expect(engine.currentLevel.getCells()[3][2].getSpritesAsSet().has(horiz)).toBe(true)

        expect(engine.currentLevel.getCells()[1][0].getSpritesAsSet().has(vert)).toBe(true)
        expect(engine.currentLevel.getCells()[1][3].getSpritesAsSet().has(vert)).toBe(true)

        expect(engine.currentLevel.getCells()[2][0].getSpritesAsSet().has(vert)).toBe(true)
        expect(engine.currentLevel.getCells()[2][3].getSpritesAsSet().has(vert)).toBe(true)

    })


    it('expands MOVING into simple UP DOWN LEFT RIGHT ACTION rules', () => {
        const { engine, data } = parseEngine(`title check that MOVING Expands

    ========
    OBJECTS
    ========

    Background
    blue

    Player
    green

    Shadow
    black

    =======
    LEGEND
    =======

    . = Background
    P = Player
    S = Shadow

    ================
    COLLISIONLAYERS
    ================

    Background
    Shadow
    Player

    ======
    RULES
    ======

    RIGHT [ Player ] -> [ > Player ]
    [ MOVING Player | Shadow ] -> [ MOVING Player | MOVING Shadow ]

    =======
    LEVELS
    =======

    P..
    S..

    `) // end game
        const player = data._getSpriteByName('player')
        const shadow = data._getSpriteByName('shadow')
        engine.tick()

        expect(data.rules.length).toBe(2)
        expect(data.rules[0].rules.length).toBe(1) // Not interesting
        expect(data.rules[1].rules.length).toBe(4 * 5) // UP DOWN LEFT RIGHT ACTION

        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(engine.currentLevel.getCells()[0][0].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel.getCells()[0][1].getSpritesAsSet().has(player)).toBe(true)

        expect(engine.currentLevel.getCells()[1][0].getSpritesAsSet().has(shadow)).toBe(false)
        expect(engine.currentLevel.getCells()[1][1].getSpritesAsSet().has(shadow)).toBe(true)
    })

    it('expands MOVING in multiple brackets into simple UP DOWN LEFT RIGHT ACTION rules', () => {
        const { engine, data } = parseEngine(`title check that MOVING Expands

    ========
    OBJECTS
    ========

    Background
    blue

    Player
    green

    Shadow
    black

    =======
    LEGEND
    =======

    . = Background
    P = Player
    S = Shadow

    ================
    COLLISIONLAYERS
    ================

    Background
    Shadow
    Player

    ======
    RULES
    ======

    RIGHT [ Player ] -> [ > Player ]
    DOWN [ MOVING Player ] [ STATIONARY Shadow ] -> [ MOVING Player ] [ MOVING Shadow ]

    =======
    LEVELS
    =======

    P..
    S..

    `) // end game
        const player = data._getSpriteByName('player')
        const shadow = data._getSpriteByName('shadow')
        engine.tick()

        expect(data.rules.length).toBe(2)
        expect(data.rules[0].rules.length).toBe(1) // Not interesting
        expect(data.rules[1].rules.length).toBe(5) // UP DOWN LEFT RIGHT ACTION

        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(engine.currentLevel.getCells()[0][0].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel.getCells()[0][1].getSpritesAsSet().has(player)).toBe(true)

        expect(engine.currentLevel.getCells()[1][0].getSpritesAsSet().has(shadow)).toBe(false)
        expect(engine.currentLevel.getCells()[1][1].getSpritesAsSet().has(shadow)).toBe(true)
    })
})
