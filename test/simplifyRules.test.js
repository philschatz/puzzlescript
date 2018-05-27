/* eslint-env jasmine */
const { default: Engine } = require('../src/engine')
const { default: Parser } = require('../src/parser/parser')

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

function parseEngine (code) {
  const { data, error } = Parser.parse(code)
  expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

  const engine = new Engine(data)
  engine.setLevel(0)
  return { engine, data }
}

describe('Rule simplifier', () => {
  it('expands horizontal rules', () => {
    const {engine, data} = parseEngine(HORIZONTAL_GAME)
    const foo = data.rules
    expect(foo.length).toBe(1)
    expect(foo[0]._rules.length).toBe(2)
  })

  it('treats adjacent neighbors that are the same as distinct (e.g. [ Wall | Wall ]', () => {
    const {engine, data} = parseEngine(`title check that Horizontal Expands

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

    expect(engine.currentLevel[0][0].getSpritesAsSet().has(rightExtension)).toBe(true)
  })
})
