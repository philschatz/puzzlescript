const gameSource = `
title Pot Wash Panic
author Dan Howard
homepage https://twitter.com/DanHowardGames
color_palette 2
background_color darkblue
require_player_movement
noaction

========
OBJECTS
========
Player
Pink white black
.111.
.000.
11111
.111.
.222.

Background
grey darkblue
00000
01100
01000
00011
00010


TrolleyEmpty
black darkgrey
00000
01110
01110
01110
00000

TrolleyFull
grey yellow
00000
01110
01110
01110
00000

Wall
orange red
11000
00110
00011
01100
00011

Wall5
orange red
11111
10101
10011
10101
11111

Wall4
orange red
11000
10110
10011
11100
10011

Wall6
orange red
11001
00111
00011
01101
00011

Wall8
orange red
11111
00110
00011
01100
00011

Wall2
orange red
11000
00110
00011
01100
11111

Wall7
orange red
11111
10110
10011
11100
10011

Wall3
orange red
11001
00111
00011
01101
11111

Wall9
orange red
11111
00101
00011
01101
00011

Wall1
orange red
11000
10110
10011
10100
11111

WallU
orange red
11111
10101
10011
11101
10011

WallB
orange red
11001
10101
10011
10101
11111

WallH
orange red
11111
00110
00011
01100
11111

WallV
orange red
11001
10101
10011
11101
10011

WallR
orange red
11111
00101
00011
01101
11111

WallL
orange red
11111
10100
10011
10100
11111

hobs
orange darkgrey
00000
01010
00000
01010
00000

oven
orange darkgrey black
00000
11111
12221
11111
00000

CleanDishes
lightgrey White
01000
.010.
.....
01000
.010.

DirtyDishes
darkbrown brown
01000
.010.
.....
01000
.010.

CleanWater
lightBlue blue
10101
00000
10001
00000
10101

DirtyWater
lightblue lightbrown brown
21212
11111
21112
11111
21212

BucketFull
green blue
.....
01110
.000.
.000.
.....

BucketEmpty
green DARKGREEN
.....
01110
.000.
.000.
.....
=======
LEGEND
=======
P = Player
. = Background
# = Wall
4 = Wall4
6 = Wall6
8 = Wall8
2 = Wall2
1 = Wall1
3 = Wall3
7 = Wall7
9 = Wall9
5 = Wall5
U = WallU
B = WallB
H = WallH
I = WallV
R = WallR
L = WallL
$ = oven
£ = hobs
D = DirtyDishes
C = CleanDishes
W = CleanWater
X = DirtyWater
F = BucketFull
E = BucketEmpty
O = TrolleyEmpty
Dishes = DirtyDishes or CleanDishes
Water = DirtyWater or CleanWater
Walls = wall or oven or hobs or Wall1 or Wall2 or Wall3 or Wall4 or Wall5 or Wall6 or Wall7 or Wall8 or Wall9 or WallU or WallB or WallH or WallV or WallR or WallL
Buckets = BucketFull or BucketEmpty
Target = TrolleyEmpty or TrolleyFull

=======
SOUNDS
=======
dishes move 49543106
sfx0 83842103
sfx1 38183900
sfx2 91847302
sfx3 11022909
buckets move 3422907


================
COLLISIONLAYERS
================

Background
Target, Water
Player, Walls, Dishes, Buckets

======
RULES
======

[ >  Player | Dishes ] -> [  >  Player | > Dishes  ]
[ >  Player | Buckets ] -> [  >  Player | > Buckets  ]

[ > CleanDishes | DirtyWater ] -> [ > DirtyDishes | DirtyWater ] sfx3
[ > DirtyDishes | CleanWater ] -> [ > CleanDishes | DirtyWater ] sfx0

[ > BucketFull | DirtyWater ] -> [ > BucketEmpty | CleanWater ] sfx2

late [ TrolleyEmpty CleanDishes] -> [TrolleyFull CleanDishes ] sfx1
late [ TrolleyFull no CleanDishes] -> [TrolleyEmpty no CleanDishes ]


==============
WINCONDITIONS
==============

All Target on CleanDishes

=======
LEVELS
=======

(message Wash up those dishes you flipping doyle. Then put them on the trolley. Level 1/14)

788888888889
4#22222222#6
46p.d.w..o46
4#88888888#6
122222222223

(message You can't wash clean dishes in dirty water! Level 2/14)


$####22####£
#2223p.1222#
6..........4
6.c.xoow.d.4
6..........4
#8889..7888#
£####88####$

(message I want to see my face in them! Level 3/14)

#2222#222#
6....B..o4
6..d.wp..4
6.c..U..o4
6..78#888#
#88#######

`

const {TableUI, keymaster} = window.PuzzleScript
const table = document.querySelector('#thegamecanbeidentifiedbyselector')
const tableUI = new TableUI(table)

let currentLevel = 0
tableUI.setGame(gameSource)
tableUI.setLevel(currentLevel)

// Set the key handlers
keymaster('up, w', () => tableUI.pressUp())
keymaster('down, s', () => tableUI.pressDown())
keymaster('left, a', () => tableUI.pressLeft())
keymaster('right, d', () => tableUI.pressRight())
keymaster('space, x', () => tableUI.pressAction())
keymaster('z, u', () => tableUI.pressUndo())
keymaster('r', () => tableUI.pressRestart())



function runLoop() {
    const {
        changedCells,
        didLevelChange,
        didWinGame,
        messageToShow,
        soundToPlay,
        wasAgainTick
    } = tableUI.tick()

    if (didWinGame) {
        alert(`You Won!`)
        clearInterval(timer)
    } else if (didLevelChange) {
        currentLevel++
        tableUI.setLevel(currentLevel)
    } else if (messageToShow) {
        alert(messageToShow)
    }
    if (soundToPlay) {
        console.log(`playing sound`)
    }
}

const timer = setInterval(runLoop, 30)
