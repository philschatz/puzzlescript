/* eslint-env jasmine */
const { LevelEngine } = require('../lib/engine')
const { default: Parser } = require('../lib/parser/parser')
const { RULE_DIRECTION_ABSOLUTE } = require('../lib/util')


const EMPTY_GAME = `
title foo

===
OBJECTS
===

background
transparent

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

` // End EMPTY_GAME


const NOOP_GAME = `
title foo

===
OBJECTS
===

background
transparent

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

` // End NOOP_GAME


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

const MIRROR_ISLES_CORNERS2 = `title Mirror Isles corners2

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

RemoveLandRU
Blue
....0
.....
.....
.....
.....

RemoveLandRD
Blue
.....
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

RemoveLandR = RemoveLandRUD OR RemoveLandRU OR RemoveLandRD

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
UP [ RemoveLandRUD | NO WaterHere ] -> [ RemoveLandRD | ]
DOWN [ RemoveLandRUD | NO WaterHere ] -> [ RemoveLandRU | ]

=======
LEVELS
=======

._
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

const HACK_THE_NET_NODES = `title Hack the net nodes disappearing

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
s = Sand
P = Player
w = Water
thing = sand OR water

================
COLLISIONLAYERS
================

Background
Player
Sand, Water

======
RULES
======

(no-op)

[ thing ] -> [ thing Player ]

=======
LEVELS
=======

sw


` // end game

function parseEngine(code) {
    const { data, error } = Parser.parse(code)
    expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

    const engine = new LevelEngine(data)
    engine.setLevel(0)
    return { engine, data }
}

describe('engine', () => {
    it('evaluates an empty game', () => {
        const { engine, data } = parseEngine(EMPTY_GAME)
        const player = data.getPlayer()
        engine.tick()
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(player)).toBe(true)

        engine.press(RULE_DIRECTION_ABSOLUTE.RIGHT)
        engine.tick()
        expect(player.getCellsThatMatch().size).toBe(1)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(player)).toBe(true)
        expect(engine.toSnapshot()).toMatchSnapshot()
    })
    it('evaluates a no-op game', () => {
        const { engine, data } = parseEngine(NOOP_GAME)
        const player = data.getPlayer()
        engine.tick()
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(player)).toBe(true)

        engine.press(RULE_DIRECTION_ABSOLUTE.RIGHT)
        engine.tick()
        expect(player.getCellsThatMatch().size).toBe(1)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(player)).toBe(true)
        expect(engine.toSnapshot()).toMatchSnapshot()
    })

    it('evaluates a simple game', () => {
        const { engine, data } = parseEngine(SIMPLE_GAME)
        const one = data._getSpriteByName('one')
        // const zero = data._getSpriteByName('zero')
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()
        expect(engine.currentLevel[0][0].getSpritesAsSet()).toContain(one)
    })

    it('draws corner sprites correctly (according to mirror isles)', () => {
        const { engine, data } = parseEngine(MIRROR_ISLES_CORNERS)
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()
        const expectedSprite = data._getSpriteByName('RemoveLandRUD')
        const interestingCell = engine.currentLevel[0][0]
        const sprites = interestingCell.getSpritesAsSet()
        expect(sprites.has(expectedSprite)).toBe(true)

        // Ensure that the CrateInHole does not exist anywhere
        const crateInHole = data._getSpriteByName('CrateInHole')
        expect(crateInHole.getCellsThatMatch().size).toBe(0)
    })

    it('draws corner sprites correctly (according to skipping stones)', () => {
        const { engine, data } = parseEngine(SKIPPING_STONES_CORNERS)
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()
        const expectedSprite = data._getSpriteByName('RemoveLandRUD')
        const interestingCell = engine.currentLevel[0][0]
        const sprites = interestingCell.getSpritesAsSet()
        expect(sprites.has(expectedSprite)).toBe(true)

        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(sprites.has(expectedSprite)).toBe(true)
        const neighborCell = engine.currentLevel[0][1]
        const neighborSprites = neighborCell.getSpritesAsSet()
        expect(neighborSprites.has(expectedSprite)).toBe(false)
    })

    it('draws corner sprites correctly according to mirror isles (just the RightUp corner should be blue)', () => {
        const { engine, data } = parseEngine(MIRROR_ISLES_CORNERS2)
        engine.tick()
        const expectedSprite = data._getSpriteByName('RemoveLandRU')
        const expectedSprite2 = data._getSpriteByName('RemoveLandRD')
        const interestingCell = engine.currentLevel[0][0]
        let sprites = interestingCell.getSpritesAsSet()
        expect(sprites.has(expectedSprite)).toBe(true)
        expect(engine.currentLevel[1][0].getSpritesAsSet().has(expectedSprite2)).toBe(true)

        // Ensure that the CrateInHole does not exist anywhere
        const crateInHole = data._getSpriteByName('CrateInHole')
        expect(crateInHole.getCellsThatMatch().size).toBe(0)
    })

    it('Respects when an OR LegendItem is on the right side of a Rule to preserve the sprite that was there', () => {
        const { engine, data } = parseEngine(HACK_THE_NET_NODES)
        const player = data._getSpriteByName('player')
        const sand = data._getSpriteByName('sand')
        const water = data._getSpriteByName('water')
        engine.tick()

        expect(sand.getCellsThatMatch().size).toBe(1)
        expect(water.getCellsThatMatch().size).toBe(1)
        expect(player.getCellsThatMatch().size).toBe(2)
    })

    it('Runs LATE rules after sprites have moved', () => {
        const { engine, data } = parseEngine(`title Match 3 Block Push

    ========
    OBJECTS
    ========

    Background
    LIGHTGREEN GREEN
    11111
    01111
    11101
    11111
    10111


    Player
    Black Orange White Blue
    .000.
    .111.
    22222
    .333.
    .3.3.

    Crate
    Orange Yellow
    00000
    0...0
    0...0
    0...0
    00000


    =======
    LEGEND
    =======

    . = Background
    P = Player
    * = Crate


    =======
    SOUNDS
    =======

    ================
    COLLISIONLAYERS
    ================

    Background
    Player, Crate

    ======
    RULES
    ======

    ( Put this rule 1st so we know it gets executed AFTER the move occurs)
    LATE [ Crate | Crate | Crate ] -> [ | | ]

    RIGHT [ STATIONARY Player ] -> [ > Player ]

    [ > Player | Crate ] -> [ > Player | > Crate ]


    ==============
    WINCONDITIONS
    ==============

    =======
    LEVELS
    =======

    ..*
    P*.
    ..*

    `)
        const crate = data._getSpriteByName('crate')
        engine.tick()

        expect(crate.getCellsThatMatch().size).toBe(0)
    })

    it('Evaluates the rules as-if they were evaluated from top->bottom and left->right (e.g. beam islands waves)', () => {
        const { engine, data } = parseEngine(`title Match 3 Block Push

    ========
    OBJECTS
    ========

    BgNW1 .
    #6719ac #a13cb7
    00000
    00000
    00000
    00000
    00000

    BgNE1
    #6719ac #a13cb7
    00000
    00000
    00100
    00000
    00000

    BgSW1
    #6719ac #a13cb7
    00000
    00000
    00000
    01000
    00000

    BgSE1
    #6719ac #a13cb7
    00000
    00000
    00000
    00000
    00000


    =======
    LEGEND
    =======

    Background = BgNW1 OR BgNE1 OR BgSW1 OR BgSE1

    ================
    COLLISIONLAYERS
    ================

    Background

    ======
    RULES
    ======

    [ NO Background ] -> [ BgNW1 ]
    DOWN  [ BgNW1 | BgNW1 ] -> [ BgNW1 | BgSW1 ]
    RIGHT [ BgNW1 | BgNW1 ] -> [ BgNW1 | BgNE1 ]
    RIGHT [ BgSW1 | BgSW1 ] -> [ BgSW1 | BgSE1 ]


    =======
    LEVELS
    =======

    ...........
    ...........
    ...........
    ...........
    ...........
    ...........
    ...........
    ...........
    ...........
    ...........

    `)
        const bgnw1 = data._getSpriteByName('bgnw1')
        const bgsw1 = data._getSpriteByName('bgsw1')
        const bgne1 = data._getSpriteByName('bgne1')
        const bgse1 = data._getSpriteByName('bgse1')
        engine.tick()

        // This mimics the 1st level of Beam Islands because picking a smaller size does not
        // cause the problem to appear
        expect(bgnw1.getCellsThatMatch().size).toBe(30) // fails if this is 18 (or any other number)
        expect(bgsw1.getCellsThatMatch().size).toBe(30)
        expect(bgne1.getCellsThatMatch().size).toBe(25)
        expect(bgse1.getCellsThatMatch().size).toBe(25)
    })

    it('Removes sprites that were in the OR  tile of a condition but not present in the action side', () => {
        const { engine, data } = parseEngine(`title Aaaah! I'm Being Attacked by a Giant Tentacle!
        realtime_interval 0.6

        ========
        OBJECTS
        ========

        Background
        #ccc #ddd #bee
        10000
        12220
        12220
        12220
        11110

        Player
        Brown #fda Purple pink black
        .000.
        .111.
        22222
        22222
        .434.


        RNG1
        transparent

        RNG2
        transparent

        =======
        LEGEND
        =======
        . = Background
        P = Player AND RNG1

        RNG = RNG1 OR RNG2

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        RNG1, RNG2
        Player


        ======
        RULES
        ======

        (OR'd fields are not removed even though they should be)
        ([ Player ] -> [ Player RANDOM RNG ])
        [RNG] -> []


        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        P

    `) // end game definition
        const rng1 = data._getSpriteByName('RNG1')
        const rng2 = data._getSpriteByName('RNG2')
        engine.tick()

        // [RNG] -> [] should result in the sprites not appearing
        expect(rng1.getCellsThatMatch().size).toBe(0)
        expect(rng2.getCellsThatMatch().size).toBe(0)
    })

    it('Evaluates brackets when new cells match mid-evaluation', () => {
        const { engine, data } = parseEngine(`title foo
        realtime_interval 0.6

        ========
        OBJECTS
        ========

        Background .
        gray

        Player P
        Brown

        SpriteA A
        green

        SpriteB B
        blue

        =======
        LEGEND
        =======

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        SpriteA
        SpriteB


        ======
        RULES
        ======

        RIGHT [ A | B ] -> [ A | A ]


        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        PABBB

    `) // end game definition

        const spriteA = data._getSpriteByName('spritea')
        const spriteB = data._getSpriteByName('spriteb')
        engine.tick()

        expect(spriteA.getCellsThatMatch().size).toBe(4)
        expect(spriteB.getCellsThatMatch().size).toBe(0)
    })

    it('preserves wantsToMove when a sprite is replaced but it is in the same collision layer', () => {
        const { engine, data } = parseEngine(`title foo
        realtime_interval 0.6

        ========
        OBJECTS
        ========

        Background .
        gray

        Player P
        transparent

        SpriteA A
        green

        SpriteB B
        blue

        =======
        LEGEND
        =======

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        SpriteA, SpriteB


        ======
        RULES
        ======

        (just get A to move)
        RIGHT [ STATIONARY A ] -> [ > A ]
        (swap A with B and the wantsToMove should be preserved)
        RIGHT [ A ] -> [ B ]


        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        PA.

    `) // end game definition

        const spriteA = data._getSpriteByName('spritea')
        const spriteB = data._getSpriteByName('spriteb')
        engine.tick()

        // Check that movement was transferred from A to B
        expect(engine.currentLevel[0][2].getSpritesAsSet().has(spriteB)).toBe(true)
        // The rest are just sanity-checks
        expect(engine.currentLevel[0][2].getSpritesAsSet().has(spriteA)).toBe(false)
        expect(spriteA.getCellsThatMatch().size).toBe(0)
        expect(spriteB.getCellsThatMatch().size).toBe(1)
    })

    it('percolates wantsToMove up (Beam Islands PlayerIsland)', () => {
        // This test ran indefinitely at one point
        const { engine, data } = parseEngine(`title foo
        realtime_interval 0.6

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Island
        green

        PlayerIsland
        blue

        BlockIsland
        Transparent


        =======
        LEGEND
        =======

        . = Background
        P = Player AND Island AND PlayerIsland
        I = Island and PlayerIsland
        s = Island (for blocking movement)

        MoveBlock = Island

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        PlayerIsland, BlockIsland
        Island


        ======
        RULES
        ======

        ( These Rules cause the engine to run indefinitely )

        RIGHT [ STATIONARY Player ] -> [ > Player ]
        [ Island NO PlayerIsland ] -> [ Island BlockIsland ]
        [ > Player ][ PlayerIsland ] -> [ > Player ][ > PlayerIsland ]
    (
        [ > PlayerIsland Island | NO MoveBlock ] -> [ > PlayerIsland > Island | ]

        [ < Island | Island NO BlockIsland ] -> [ < Island | < Island ]
    )
        [ STATIONARY Island PlayerIsland ][ MOVING Player ] -> [ Island PlayerIsland ][ STATIONARY Player ] (SFX2)


        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        PIs..

    `) // end game definition

        const player = data._getSpriteByName('player')
        const island = data._getSpriteByName('island')
        const playerIsland = data._getSpriteByName('playerisland')
        engine.tickUpdateCells()

        expect(player.getCellsThatMatch().size).toBe(1)
        expect([...player.getCellsThatMatch()][0].getWantsToMove(player)).toBe('STATIONARY')
    })

    it('moves sprites to a new neighbor (simple)', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Red R
        red

        Green G
        green

        Blue B
        blue

        =======
        LEGEND
        =======

        . = Background
        P = Player

        Color = Red OR Green OR Blue

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Color

        ======
        RULES
        ======

        (shift colors to the right)
        RIGHT [ Color | NO Color ] -> [ NO Color | Color ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        B.

    `) // end game definition

        // Testing something like `left [ > Counter | MirrorUR ] -> [ | MirrorUR up Counter ]`
        const red = data._getSpriteByName('red')
        const green = data._getSpriteByName('green')
        const blue = data._getSpriteByName('blue')
        engine.tick()

        expect(red.getCellsThatMatch().size).toBe(0)
        expect(green.getCellsThatMatch().size).toBe(0)
        expect(blue.getCellsThatMatch().size).toBe(1)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(blue)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(blue)).toBe(true)
    })

    it('moves sprites to a new neighbor (intermediate)', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Red R
        red

        Green G
        green

        Blue B
        blue

        =======
        LEGEND
        =======

        . = Background
        P = Player

        Color = Red OR Green OR Blue

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Color

        ======
        RULES
        ======

        (shift colors to the right)
        RIGHT [ Color | NO Color ] -> [ NO Color | Color ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        RG.B..

    `) // end game definition

        // Testing something like `left [ > Counter | MirrorUR ] -> [ | MirrorUR up Counter ]`
        const red = data._getSpriteByName('red')
        const green = data._getSpriteByName('green')
        const blue = data._getSpriteByName('blue')
        engine.tick()

        expect(red.getCellsThatMatch().size).toBe(1)
        expect(green.getCellsThatMatch().size).toBe(1)
        expect(blue.getCellsThatMatch().size).toBe(1)
        expect(engine.currentLevel[0][3].getSpritesAsSet().has(red)).toBe(true)
        expect(engine.currentLevel[0][4].getSpritesAsSet().has(green)).toBe(true)
        expect(engine.currentLevel[0][5].getSpritesAsSet().has(blue)).toBe(true)
    })

    it('swaps an OR tile to a different bracket', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Red R
        red

        Green G
        green

        Blue B
        blue

        =======
        LEGEND
        =======

        . = Background
        P = Player

        Color = Red OR Green OR Blue

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Color

        ======
        RULES
        ======

        (add the Color onto the Player)
        RIGHT [ Color ] [ Player NO Color ] -> [ ] [ Player Color ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        PRGB

    `) // end game definition

        // Testing something like `left [ > Counter | MirrorUR ] -> [ | MirrorUR up Counter ]`
        const red = data._getSpriteByName('red')
        const green = data._getSpriteByName('green')
        const blue = data._getSpriteByName('blue')
        engine.tick()

        // The original implementation expects the tick to end this way:
        // RED BACKGROUND GREEN BLUE
        expect(red.getCellsThatMatch().size).toBe(1)
        expect(green.getCellsThatMatch().size).toBe(1)
        expect(blue.getCellsThatMatch().size).toBe(1)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(red)).toBe(true)
        expect(engine.currentLevel[0][2].getSpritesAsSet().has(green)).toBe(true)
        expect(engine.currentLevel[0][3].getSpritesAsSet().has(blue)).toBe(true)
    })

    it('keeps running the rule even when only the direction changed', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Red R
        red

        Green G
        green

        Blue B
        blue

        =======
        LEGEND
        =======

        . = Background
        P = Player

        Color = Red OR Green OR Blue
        A = Red AND Green AND Blue

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Red
        Green
        Blue

        ======
        RULES
        ======

        DOWN [ STATIONARY Red ] -> [ > Red ]
        [ > Red Blue ] -> [ > Red > Blue ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        AAA
        ...

    `) // end game definition

        const red = data._getSpriteByName('red')
        const green = data._getSpriteByName('green')
        const blue = data._getSpriteByName('blue')
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(red.getCellsThatMatch().size).toBe(3)
        expect(green.getCellsThatMatch().size).toBe(3)
        expect(blue.getCellsThatMatch().size).toBe(3)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(green)).toBe(true)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(green)).toBe(true)
        expect(engine.currentLevel[0][2].getSpritesAsSet().has(green)).toBe(true)
        expect(engine.currentLevel[1][0].getSpritesAsSet().has(red)).toBe(true)
        expect(engine.currentLevel[1][1].getSpritesAsSet().has(red)).toBe(true)
        expect(engine.currentLevel[1][2].getSpritesAsSet().has(red)).toBe(true)
        expect(engine.currentLevel[1][0].getSpritesAsSet().has(blue)).toBe(true)
        expect(engine.currentLevel[1][1].getSpritesAsSet().has(blue)).toBe(true)
        expect(engine.currentLevel[1][2].getSpritesAsSet().has(blue)).toBe(true)
    })

    it('does not move the island when there is a bridge in the way (simulated RIGID keyword)', () => {
        const { engine, data } = parseEngine(`title BeamishIslands testing
        author mjau
        run_rules_on_level_start
        realtime_interval 0.3

        ( for ludum dare 29 )

        =========
         OBJECTS
        =========

        BgNW1 .
        #6719ac #a13cb7
        00000
        00000
        00000
        00000
        00000


        Player
        #f7e26b #000000
        01010
        .000.
        .0.0.
        .....
        .....

        Island #
        #000000


        PlayerIsland
        #078ffd
        .....
        .....
        ..0..
        .....
        .....

        BlockIsland
        #df2619
        .....
        .....
        ..0..
        .....
        .....


        Bridge -
        #000000 #a27d5b
        .....
        .111.
        .101.
        .111.
        .000.


        ========
         LEGEND
        ========

        @ = Player and Island

        Background = BgNW1
        Movable = Player or Island or PlayerIsland
        MoveBlock = Island or Bridge


        ========
         SOUNDS
        ========


        =================
         COLLISIONLAYERS
        =================

        Background
        Island, Bridge
        Player
        PlayerIsland, BlockIsland

        =======
         RULES
        =======


        ( player island )
        (use RIGHT in the rules only to reduce the number of rules that are updated)
        RIGHT [ Player Island ] -> [ Player Island PlayerIsland ]
        down  [ PlayerIsland | Island ] -> [ PlayerIsland | Island PlayerIsland ]

        ( rigid movement )
        LEFT [ > Player ][ PlayerIsland ] -> [ > Player ][ > PlayerIsland ]
        LEFT [ > PlayerIsland Island  | no MoveBlock ] -> [ > PlayerIsland > Island | ]
        RIGHT [ < Island  | Island no BlockIsland ] -> [ < Island | < Island ]
        RIGHT [ stationary Island PlayerIsland ][ moving Player ] -> [ Island PlayerIsland ][ stationary Player ] (SFX2)
        RIGHT [ stationary Island PlayerIsland ][ LEFT Movable ]  -> [ Island stationary PlayerIsland ][ stationary Movable ]

        ===============
         WINCONDITIONS
        ===============

        ========
         LEVELS
        ========

        .@
        -#

    `) // end game definition

        const player = data._getSpriteByName('player')
        const island = data._getSpriteByName('island')
        const playerIsland = data._getSpriteByName('PlayerIsland')
        engine.press(RULE_DIRECTION_ABSOLUTE.LEFT)
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(island.getCellsThatMatch().size).toBe(2)
        expect(playerIsland.getCellsThatMatch().size).toBe(2)
        // Check that the Island did not move
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(island)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(island)).toBe(true)
        expect(engine.currentLevel[1][1].getSpritesAsSet().has(island)).toBe(true)
        // Check that the PlayerIsland didn't move either
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(playerIsland)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(playerIsland)).toBe(true)
        expect(engine.currentLevel[1][1].getSpritesAsSet().has(playerIsland)).toBe(true)

        // Check that the player did not move either
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(player)).toBe(true)
    })


    it('removes the wantsToMove when specified in the rule', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        =======
        LEGEND
        =======

        . = Background
        P = Player

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player

        ======
        RULES
        ======

        [ > Player | ] -> [ | Player ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        P..

    `) // end game definition

        const player = data._getSpriteByName('player')
        engine.press(RULE_DIRECTION_ABSOLUTE.RIGHT)
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(player.getCellsThatMatch().size).toBe(1)
        // Don't double-move the Player (verify that we remove the wantsToMove)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[0][2].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(player)).toBe(true)
    })


    it('removes a sprite when it has NO in the action side', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Hat
        transparent

        =======
        LEGEND
        =======

        . = Background
        P = Player AND Hat

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Hat

        ======
        RULES
        ======

        [ Player ] -> [ Player NO Hat ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        P

    `) // end game definition

        const hat = data._getSpriteByName('hat')
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(hat.getCellsThatMatch().size).toBe(0)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(hat)).toBe(false)
    })


    it('removes a sprite when it has NO in the action side (an OR tile)', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Hat
        transparent

        Shirt
        transparent

        =======
        LEGEND
        =======

        . = Background
        P = Player AND Hat
        Clothing = Shirt OR Hat

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Hat
        Shirt

        ======
        RULES
        ======

        [ Player ] -> [ Player NO Clothing ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        P

    `) // end game definition

        const hat = data._getSpriteByName('hat')
        const shirt = data._getSpriteByName('shirt')
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(hat.getCellsThatMatch().size).toBe(0)
        expect(shirt.getCellsThatMatch().size).toBe(0)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(hat)).toBe(false)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(shirt)).toBe(false)
    })


    it('moves a tile from one bracket to another (OR tile is in same collisionlayer', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Hat
        brown

        Shirt
        red

        Clipboard
        transparent

        =======
        LEGEND
        =======

        . = Background
        P = Player AND Hat
        C = Clipboard
        Clothing = Hat OR Shirt

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Hat, Shirt
        Clipboard

        ======
        RULES
        ======

        [ Player Clothing ] [ Clipboard ] -> [ Player ] [ Clipboard Clothing ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        PC

    `) // end game definition

        const hat = data._getSpriteByName('hat')
        const shirt = data._getSpriteByName('shirt')
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(hat.getCellsThatMatch().size).toBe(1)
        expect(shirt.getCellsThatMatch().size).toBe(0)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(hat)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(hat)).toBe(true)
    })

    it('moves a tile from one bracket to another (OR tile is in DIFFERENT collisionlayer', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Hat
        brown

        Shirt
        red

        Clipboard
        transparent

        =======
        LEGEND
        =======

        . = Background
        P = Player AND Hat
        C = Clipboard
        Clothing = Hat OR Shirt

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Hat
        Shirt
        Clipboard

        ======
        RULES
        ======

        [ Player Clothing ] [ Clipboard ] -> [ Player ] [ Clipboard Clothing ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        PC

    `) // end game definition

        const hat = data._getSpriteByName('hat')
        const shirt = data._getSpriteByName('shirt')
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(hat.getCellsThatMatch().size).toBe(1)
        expect(shirt.getCellsThatMatch().size).toBe(0)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(hat)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(hat)).toBe(true)
    })

    it('swaps 2 OR tiles (OR tile has sprites in DIFFERENT collisionlayer', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Hat
        brown

        Shirt
        red

        Clipboard
        transparent

        Target
        transparent

        =======
        LEGEND
        =======

        . = Background
        P = Player AND Hat
        C = Clipboard
        T = Target AND Shirt
        Clothing = Hat OR Shirt

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Hat
        Shirt
        Clipboard
        Target

        ======
        RULES
        ======

        [ Player Clothing ] [ Clipboard ] -> [ Player ] [ Clipboard Clothing ]
        [ Target Clothing ] [ Player ] -> [ Target ] [ Player Clothing ]
        [ Clipboard Clothing ] [ Target ] -> [ Clipboard ] [ Target Clothing ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        PTC

    `) // end game definition

        const hat = data._getSpriteByName('hat')
        const shirt = data._getSpriteByName('shirt')
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()

        expect(hat.getCellsThatMatch().size).toBe(1)
        expect(shirt.getCellsThatMatch().size).toBe(1)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(hat)).toBe(false)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(hat)).toBe(true)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(shirt)).toBe(true)
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(shirt)).toBe(false)
    })

    it('ignores negated OR tiles in the condition', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Red R
        red

        Green G
        green

        Blue B
        blue

        Hat
        transparent

        Shirt
        transparent

        =======
        LEGEND
        =======

        . = Background
        P = Player AND Hat

        Color = Red OR Green OR Blue
        Clothing = Hat OR Shirt

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Red, Shirt
        Green, Hat
        Blue

        ======
        RULES
        ======

        (make sure we do not remove the hat which is in the same collision layer as a color)
        RIGHT [ Player  NO Color ] -> [ ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        P.

    `) // end game definition

        const hat = data._getSpriteByName('hat')
        engine.tick()

        expect(hat.getCellsThatMatch().size).toBe(1)
    })

    it('supports AND tiles (in DIFFERENT collisionLayers) in the condition', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Red R
        red

        Green G
        green

        Blue B
        blue

        Hat
        transparent

        Shirt
        transparent

        =======
        LEGEND
        =======

        . = Background
        P = Player AND Hat AND Shirt

        Color = Red OR Green OR Blue
        Clothing = Hat OR Shirt

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Red, Shirt
        Green, Hat
        Blue

        ======
        RULES
        ======

        (make sure we do not remove the hat which is in the same collision layer as a color)
        RIGHT [ Player Clothing ] -> [ ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        P.

    `) // end game definition

        const hat = data._getSpriteByName('hat')
        const shirt = data._getSpriteByName('shirt')
        engine.tick()

        expect(hat.getCellsThatMatch().size).toBe(0)
        expect(shirt.getCellsThatMatch().size).toBe(0)
    })


    it('supports ellipsis rules', () => {
        const { engine, data } = parseEngine(`title foo

        ========
        OBJECTS
        ========

        Background
        gray

        Player
        transparent

        Cat C
        black

        =======
        LEGEND
        =======

        . = Background
        P = Player

        =======
        SOUNDS
        =======

        ================
        COLLISIONLAYERS
        ================
        Background
        Player
        Cat

        ======
        RULES
        ======

        RIGHT [ Player | ... | Cat ] -> [ Player | ... | > Cat ]

        ==============
        WINCONDITIONS
        ==============

        =======
        LEVELS
        =======

        P.C..

    `) // end game definition

        const cat = data._getSpriteByName('cat')
        engine.tick()

        expect(cat.getCellsThatMatch().size).toBe(1)
        expect(engine.currentLevel[0][2].getSpritesAsSet().has(cat)).toBe(false) // the Cat moved
        expect(engine.currentLevel[0][3].getSpritesAsSet().has(cat)).toBe(true)

        engine.tick()

        expect(cat.getCellsThatMatch().size).toBe(1)
        expect(engine.currentLevel[0][3].getSpritesAsSet().has(cat)).toBe(false) // the Cat moved
        expect(engine.currentLevel[0][4].getSpritesAsSet().has(cat)).toBe(true)
    })

})
