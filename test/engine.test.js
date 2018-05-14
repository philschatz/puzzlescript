/* eslint-env jasmine */
const Engine = require('../src/engine')
const {parse} = require('../src/parser')
const {renderScreen} = require('../src/ui')

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



const SIMPLE_GAME2 = `
title foo
===
OBJECTS
===

background
transparent

One
Darkblue
...0.
..00.
...0.
...0.
..000

Two
Darkblue
.000.
....0
..00.
.0...
.0000

Three
Darkblue
.000.
....0
..000
....0
.000.

Four
Darkblue
.0..0
.0..0
.0000
....0
....0

Five
Darkblue
.0000
.0...
.000.
....0
.000.

Six
Darkblue
..00.
.0...
.000.
.0..0
..00.

Seven
Darkblue
.0000
....0
...0.
..0..
.0...

Eight
Darkblue
..00.
.0..0
..00.
.0..0
..00.

Nine
Darkblue
..00.
.0..0
..000
....0
..00.

Zero
Darkblue
..00.
.0..0
.0..0
.0..0
..00.

===
LEGEND
===

. = background
0 = zero
1 = one
2 = two

====
RULES
====
[zero]-> message Zero!
[zero]->[one]
[one]->[two]
[two]->[zero]

===
LEVELS
===

...
.0.
...

` // End SIMPLE_GAME
describe('engine', () => {
  it('evaluates a simple game', () => {
    const {data, error} = parse(SIMPLE_GAME)
    if (error) {
      console.log(error.message)
    }
    expect(error).toBeFalsy()

    const engine = new Engine(data)
    engine.setLevel(0)
    renderScreen(data, engine.currentLevel)

    console.log('tick-returned:', engine.tick())
    console.log('gameaskldjalskjd');
    console.log(JSON.stringify(data, null, 2));
  })
})
