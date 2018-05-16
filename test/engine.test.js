/* eslint-env jasmine */
const {default: Engine} = require('../src/engine')
const {default: Parser} = require('../src/parser')

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

describe('engine', () => {
  it('evaluates a simple game', () => {
    const {data, error} = Parser.parse(SIMPLE_GAME)
    expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

    const engine = new Engine(data)
    engine.setLevel(0)

    console.log('tick-returned:', engine.tick())
  })
})
