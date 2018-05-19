/* eslint-env jasmine */
const { default: Engine } = require('../src/engine')
const { default: Parser } = require('../src/parser')

const SIMPLE_GAME = `
title foo

(verbose_logging)
(debug)

(run_rules_on_level_start)

realtime_interval 0.1


===
OBJECTS
===

background
transparent

one
Darkblue
...0.
..00.
...0.
...0.
..000

zero
Darkblue
..00.
.0..0
.0..0
.0..0
..00.

Player
yellow
00000
0...0
0...0
0...0
00000

===
LEGEND
===

. = background
0 = zero
1 = one
P = Player

====
SOUNDS
====

====
COLLISIONLAYERS
====

background
one
player
zero


====
RULES
====

(
[ stationary Player ] [ stationary 0 ] -> [Player] [ action 1 ]
[ stationary Player ] [ 0 ] -> [Player] [ 1 ]
)
[0] -> [1]



===
WINCONDITIONS
===


===
LEVELS
===

0P

` // End SIMPLE_GAME

const MIRROR_ISLES_CORNERS = `title Mirror Isles corners

========
OBJECTS
========

Background
yellow

Hole
blue

Player
DarkRed #493c2b #000000
..0..
.111.
01110
02220
.2.2.

RemoveLandRUD
Blue
....0
.....
.....
.....
....0

CrateInHole
Brown DarkBrown Blue
20002
01110
01110
01110
20002

=======
LEGEND
=======

. = Background
P = Player
_ = Hole

RemoveLandR = RemoveLandRUD
WaterHere = Hole or CrateInHole

================
COLLISIONLAYERS
================

Background
Player
Hole, CrateInHole
RemoveLandR

======
RULES
======

RIGHT [ NO WaterHere NO RemoveLandR | WaterHere ] -> [ RemoveLandRUD | WaterHere ]

=======
LEVELS
=======

._


` // end game

const SKIPPING_STONES_CORNERS = `title Skipping Stones corners

========
OBJECTS
========

Background
blue

Sand
yellow

Player
DarkRed #493c2b #000000
..0..
.111.
01110
02220
.2.2.

RemoveLandRUD
Blue
....0
.....
.....
.....
....0

=======
LEGEND
=======

. = Sand
P = Player
_ = Background

RemoveLandR = RemoveLandRUD

================
COLLISIONLAYERS
================

Background
Player
Sand
RemoveLandR

======
RULES
======

RIGHT [ Sand NO RemoveLandR | NO Sand ] -> [ Sand RemoveLandRUD | NO Sand ]

=======
LEVELS
=======

.__


` // end game

function parseEngine(code) {
  const { data, error } = Parser.parse(code)
  expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

  const engine = new Engine(data)
  engine.setLevel(0)
  return { engine, data }
}

function getSpriteByName(data, name) {
  return data.objects.filter((sprite) => sprite._name === name)[0]
}

describe('engine', () => {
  it('evaluates a simple game', () => {
    const { engine } = parseEngine(SIMPLE_GAME)
    engine.tick()
  })

  it('draws corner sprites correctly (according to mirror isles)', () => {
    const { engine, data } = parseEngine(MIRROR_ISLES_CORNERS)
    engine.tick()
    const expectedSprite = getSpriteByName(data, 'RemoveLandRUD')
    const interestingCell = engine.currentLevel[0][0]
    const sprites = interestingCell.getSpritesAsSet()
    expect(sprites.has(expectedSprite)).toBe(true)
  })

  it('draws corner sprites correctly (according to skipping stones)', () => {
    const { engine, data } = parseEngine(SKIPPING_STONES_CORNERS)
    engine.tick()
    const expectedSprite = getSpriteByName(data, 'RemoveLandRUD')
    const interestingCell = engine.currentLevel[0][0]
    const sprites = interestingCell.getSpritesAsSet()
    expect(sprites.has(expectedSprite)).toBe(true)

    engine.tick()

    expect(sprites.has(expectedSprite)).toBe(true)
    const neighborCell = engine.currentLevel[0][1]
    const neighborSprites = neighborCell.getSpritesAsSet()
    expect(neighborSprites.has(expectedSprite)).toBe(false)
  })
})
