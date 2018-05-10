const ohm = require('ohm-js')
const {readFileSync} = require('fs')

const grammar = `
Puzzlescript {
  Details =
  	Title
    Author?
    Homepage?
    ColorPalette?
    RealtimeInterval?
    Noaction?
    Section<"OBJECTS", ObjectsItem>
    Section<"LEGEND", legendItem>
    Section<"SOUNDS", SoundItem>
    Section<"COLLISIONLAYERS", CollisionLayerItem>
    Section<"RULES", RuleItem>

  Title = "title " restOfLine
  Author = "author " restOfLine
  Homepage = "homepage " restOfLine
  ColorPalette = "color_palette " restOfLine
  RealtimeInterval = "realtime_interval " restOfLine
  Noaction = "noaction"


  ObjectsItem =
  	objectName
    nonemptyListOf<colorNameOrHex, " ">
    (pixelRow+)?

  objectName = (~lineTerminator (letter|digit))+
  colorTransparent = "transparent"
  colorHex = "#" hexDigit hexDigit hexDigit hexDigit hexDigit hexDigit
  colorNameOrHex = colorTransparent | colorHex | letter+


  legendItem = legendVarName " = " nonemptyListOf<varName, andOr> lineTerminator
  andOr = " and " | " or "


  // TODO: Handle tokens like sfx0 and explicit args instead of just varName (like "Player CantMove up")
  // all of them are at https://www.puzzlescript.net/Documentation/sounds.html
  SoundItem = varName+ integer


  CollisionLayerItem = NonemptyListOf<varName, ",">


  RuleItem = rulePrefix? RuleCondition+ "->" RuleCondition* ruleCommand* lineTerminator

  rulePrefix =
      caseInsensitive<"late">
    | caseInsensitive<"random">

  ruleCommand =
      caseInsensitive<"again">
    | caseInsensitive<"CANCEL">
    | caseInsensitive<"checkpoint">
    | caseInsensitive<"restart">
    | caseInsensitive<"Win">
    | ruleCommandMessage
    | caseInsensitive<"sfx0">
    | caseInsensitive<"sfx1">
    | caseInsensitive<"sfx2">
    | caseInsensitive<"sfx3">
    | caseInsensitive<"sfx4">
    | caseInsensitive<"sfx5">
    | caseInsensitive<"sfx6">
    | caseInsensitive<"sfx7">
    | caseInsensitive<"sfx8">
    | caseInsensitive<"sfx9">
    | caseInsensitive<"sfx10">

  ruleCommandMessage = "Message " (~lineTerminator any)+

  RuleCondition = "[" ListOf<RuleConditionEntry, "|"> "]"

  RuleConditionEntry = ruleDirection? varName+


  ruleDirection =
      caseInsensitive<"MOVING">
    | caseInsensitive<"orthogonal">
    | caseInsensitive<"stationary">
    | ">"
    | "<"
    | "^"
    | "v"
    | caseInsensitive<"UP">
    | caseInsensitive<"DOWN">
    | caseInsensitive<"LEFT">
    | caseInsensitive<"RIGHT">

  // ================
  // SECTION_NAME
  // ================
  Section<Name, ItemExpr> =
    headingBar
    Name
    headingBar
    ItemExpr+

  legendChar = any // a single character that is allowed to be in a puzzle level
  varName = letter (letter | digit | "_")*
  legendVarName = varName | legendChar
  headingBar = "="+
  pixelRow = pixelDigit+ lineTerminator
  pixelDigit = (digit | ".")+
  restOfLine = (~lineTerminator sourceCharacter)* lineTerminator
  lineTerminator = "\\n"
  sourceCharacter = any

  // redefine what a space is so we can ignore comments
  space := "\u0000".." " | multiLineComment

  multiLineComment = "(" (~")" sourceCharacter)* ")"

  integer = digit+

}
`// readFileSync('./grammar.ohm', 'utf-8')





const code = `title Boxes & Balloons
author Ben Reilly
homepage ben-reilly.com
color_palette amiga
realtime_interval 0.1
noaction

========
OBJECTS
========

Background
LightGrey LightGrey
00010
11111
01000
11111
00010

Exit
Yellow Brown
.111.
11111
11111
10111
11111

Wall
DarkGrey DarkGrey
00010
11111
01000
11111
00010

Player
darkbrown LightBrown orange
.000.
.111.
22222
.222.
.0.0.

DeadPlayer
darkred lightred red darkred
.000.
.111.
22222
.222.
.3.3.

Crate
Orange Lightbrown
00000
01110
01110
01110
00000

StuckCrate
DarkGrey Grey
00000
01110
01110
01110
00000

Balloon
Blue Grey
.000.
00000
.000.
..1..
.11..

PoppingBalloon
Blue Grey
.0.0.
0...0
.0.0.
..1.
.1...

LadderMain
Brown
.0.0.
.000.
.0.0.
.000.
.0.0.

LadderTop
Brown
.....
.....
.0.0.
.000.
.0.0.

LadderBottom
Brown
.0.0.
.000.
.0.0.
.....
.....

DownSpike
darkgrey red
..0..
..0..
..1..
.....
.....

UpSpike
darkgrey red
.....
.....
..1..
..0..
..0..

RightSpike
Darkgrey red
.....
.....
001..
.....
.....

LeftSpike
Darkgrey red
.....
.....
..100
.....
.....

(Weights/forces acting on objects; Wx, where x is the amount of downward pushing force applied to an object. Note that there is only one negative one, since we do top-down force calculations, so we only need to know if an object is moving up, not with how much force.)
FreeBody
White

Wn1
Grey

W0
Grey

W1
Grey

W2
Grey

W3
Grey

W4
Grey

W5
Grey

Final
Black

TimeTick
Blue

AllowMove
Red

Shadow
Black

Sound
Grey


qfade2d1
#daa9ad
.....
.....
.....
..0..
.....

qfade2d2
#daa9ad
.....
.....
.....
.....
..0..

(Quark movement)
ql
transparent

qr
transparent

qu
transparent

qd
transparent

turnl
transparent

turnr
transparent

(Arrows)
lstart
transparent

rstart
transparent

=======
LEGEND
=======
Ladder = LadderMain or LadderTop or LadderBottom

Status = TimeTick or AllowMove or Sound

. = Background
# = Wall and Background
P = Player
C = Crate
B = Balloon

t = LadderTop
L = LadderMain
m = LadderBottom

- = Crate and LadderMain
+ = Balloon and LadderMain
* = Player and LadderMain

/ = Crate and LadderTop

0 = upspike
1 = rightspike
2 = downspike
3 = leftspike

X = Exit

W = Wn1 or W0 or W1 or W2 or W3 or W4 or W5
FB = FreeBody

Upper = Balloon
Downer = Crate or Player
Obj = Upper or Downer

Spike = Upspike or Downspike or Leftspike or Rightspike
vertspike = upspike or downspike
horizspike = leftspike or rightspike

Ground = Obj or StuckCrate or Wall or Ladder

=======
SOUNDS
=======

Crate MOVE 53548707
Balloon MOVE 798907

sfx5 15551704
sfx6 12412104
sfx7 50943104

================
COLLISIONLAYERS
================

Status
FB
W, Final
Shadow
Background
Ladder, Exit
Player, Wall, Crate, Balloon, StuckCrate, PoppingBalloon, DeadPlayer
Spike

======
RULES
======

(Mark if player is moving or not.)
[orthogonal Player] [Exit no AllowMove] -> CANCEL
[orthogonal Player] [timetick] -> [orthogonal Player] [no timetick]
[stationary Player] [Exit no timetick] -> [Player] [Exit TimeTick]

(If player moves, resolve gravity on the player before allowing another move.)
[Player no Shadow] -> [Player Shadow]
late [Exit no AllowMove] -> [Exit AllowMove]
late [Player no Shadow] [AllowMove] -> [Player] []
late [Shadow] -> []

(**********************************************************)
(***PLAYER-CAUSED MOTION***)
(**********************************************************)

(Player cannot move vertically, except on ladders, and to exit a ladder from below.)
[Exit no TimeTick] [vertical Player no Ladder] -> [Exit] [Player]
up [Exit no TimeTick] [> Player Ladder | no Ladder] -> [Exit] [ Player Ladder | ]

(Player cannot move horizontally mid-air)
down [Exit no TimeTick] [horizontal Player no Ladder | no Ground] -> [Exit] [Player |]

(Player pushes things, things push things. Includes vertical movement because players are strong and grip ladders really tightly.)
[Exit no TimeTick] [> Obj | Obj] -> [Exit] [> Obj | > Obj]

(**********************************************************)
(***GRAVITY***)
(**********************************************************)
(Idea: Apply gravitational forces to objects that are not being moved by the player. Process them from the top of a stack of objects downward, balancing the sum of positive (downward) and negative (upward) forces.

Since we're processing downward, any object determined to be moving upwards is definitely moving upwards. Such an object indicates the bottom of a sub-stack, and the next object in the stack starts the calculation over.

When we reach the bottom of a (sub-)stack, the movement of the final, lowest object tells us how the whole (sub-)stack will move, so we apply that movement iteratively upwards.

NOTE: Players can grip ladders really tightly, so they are only affected by stack gravity when the player is not on a ladder.
)

(***STEP 1: Mark the bodies that the player is not affecting.***)
[TimeTick] [stationary Balloon no FB] -> [TimeTick] [Balloon FB]
[TimeTick] [stationary Crate no FB] -> [TimeTick] [Crate FB]
[TimeTick] [stationary Player no Ladder no FB] -> [TimeTick] [Player FB]

(***STEP 2: Begin the gravity calc at top of each stack.***)
down [no FB | Upper  FB] -> [ | < Upper  FB Wn1]
down [no FB | Downer FB] -> [ | > Downer FB W1]

(***STEP 3: Iteratively apply gravity downward on stack.***)
(1. DOWNWARD MOTION)
    down   [> Obj W1 | Upper  FB] -> [  Obj |   Upper  FB W0]
    + down [> Obj W2 | Upper  FB] -> [> Obj | > Upper  FB W1]
    + down [> Obj W3 | Upper  FB] -> [> Obj | > Upper  FB W2]
    + down [> Obj W4 | Upper  FB] -> [> Obj | > Upper  FB W3]
    + down [> Obj W5 | Upper  FB] -> [> Obj | > Upper  FB W4]

    + down [> Obj W1 | Downer FB] -> [> Obj | > Downer FB W2]
    + down [> Obj W2 | Downer FB] -> [> Obj | > Downer FB W3]
    + down [> Obj W3 | Downer FB] -> [> Obj | > Downer FB W4]
    + down [> Obj W4 | Downer FB] -> [> Obj | > Downer FB W5]
    + down [> Obj W5 | Downer FB] -> [> Obj | > Downer FB W5](!!)
(2. UPWARD MOTION)
    (doesn't affect next; re-apply top-of-stack rules)
    + down [< Obj W | Upper  FB] -> [< Obj Final | < Upper FB Wn1]
    + down [< Obj W | Downer FB] -> [< Obj Final | > Downer FB W1]
(3. NO MOTION)
  (possibly subject to next obj; re-apply top-of-stack rules)
    + down [stationary Obj W | Upper  FB] -> [< Obj Final | < Upper FB Wn1]
    + down [stationary Obj W | Downer FB] -> [        Obj | > Downer FB W1]

(***Step 4: Stop at bottom of stack.***)
(As with beginning a stack, if the stack is pushing into a non-free object, the stack remains still or else it might interrupt the other object's motion.)
down [Obj W | no FB] -> [Obj Final | ]

(***Step 5: Apply bottom-of-sub-stack motion to whole sub-stack.)
(1. UPWARD MOTION)
  up [> Obj Final | Obj FB no Final] -> [> Obj Final| > Obj Final]
(2. DOWNWARD MOTION)
  + up [< Obj Final | Obj FB no Final] -> [< Obj Final | Obj Final]
(3. NO MOTION)
  + up [stationary Obj Final | Obj FB no Final] -> [Obj Final | Obj Final]

(**********************************************************)
(***Cleanup***)
late [W] -> []
late [Final] -> []
late [FreeBody] -> []

(
(Horizontal motion has the right-of-way.)
vertical [> Obj | horizontal Obj] -> [Obj | horizontal Obj]
)

(Spikes)
[poppingballoon] -> []
vertical [> balloon | vertspike] -> [> poppingballoon | vertspike]
horizontal [> balloon | horizspike] -> [> poppingballoon | horizspike]
late [poppingballoon no spike] -> [balloon]
late [poppingballoon] -> sfx5

vertical [> Crate | vertspike] -> [> stuckcrate | vertspike]
horizontal [> Crate | horizspike] -> [> stuckcrate | horizspike]
late [stuckcrate no spike] -> [Crate]
late [stuckcrate no Sound] -> [StuckCrate Sound] sfx6

vertical [> Player | vertspike] -> [> DeadPlayer | vertspike]
horizontal [> Player | horizspike] -> [> DeadPlayer | horizspike]
late [DeadPlayer no spike] -> [Player]
late [DeadPlayer no Sound] -> [DeadPlayer Sound] sfx7

`


const g = ohm.grammar(grammar)
const m = g.match(code)

if (m.succeeded()) {
  debugger
  console.log('hooray!');
} else {
  console.log(g.trace(code).toString())
  console.log(m.message)
}
