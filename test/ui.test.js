/* eslint-env jasmine */
const { default: Parser } = require('../lib/parser/parser')
const { GameEngine } = require('../lib/engine')
const { default: UI } = require('../lib/terminalUi')
const { lookupColorPalette } = require('../lib/colors')

const C_WHITE = { r: 255, g: 255, b: 255 }
const C_BLACK = { r: 0, g: 0, b: 0 }

function parseAndReturnFirstSpritePixels(code) {
    const { data } = Parser.parse(code)
    const engine = new GameEngine(data)
    engine.setLevel(0)
    const cell = engine.getCurrentLevelCells()[0][0]
    // console.log(cell.getSprites())
    UI.setGameEngine(engine)
    return { pixels: UI.getPixelsForCell(cell), data }
}

describe('UI', () => {
    it('Renders a single sprite', () => {
        const { pixels } = parseAndReturnFirstSpritePixels(`
title foo

===
OBJECTS
===

background
black

WaterAnim1 w
white transparent
01111
10111
11011
11101
11110

===
COLLISIONLAYERS
===

Background
WaterAnim1

===
LEVELS
===

w
`)

        // Expect a white diagonal
        expect(pixels[0][0].toRgb()).toEqual(C_WHITE)
        expect(pixels[1][1].toRgb()).toEqual(C_WHITE)
        expect(pixels[2][2].toRgb()).toEqual(C_WHITE)
        expect(pixels[3][3].toRgb()).toEqual(C_WHITE)
        expect(pixels[4][4].toRgb()).toEqual(C_WHITE)
    })

    it('Overlays sprites based on the collision layer', () => {
        const { pixels } = parseAndReturnFirstSpritePixels(`
title foo

===
OBJECTS
===

background
yellow

Hole
black

WaterAnim1
white transparent
01111
10111
11011
11101
11110

===
LEGEND
===

W = WaterAnim1 AND Hole

===
COLLISIONLAYERS
===

background
Hole
WaterAnim1

===
LEVELS
===

W
`)

        // Expect a white diagonal
        expect(pixels[0][0].toRgb()).toEqual(C_WHITE)
        expect(pixels[1][1].toRgb()).toEqual(C_WHITE)
        expect(pixels[2][2].toRgb()).toEqual(C_WHITE)
        expect(pixels[3][3].toRgb()).toEqual(C_WHITE)
        expect(pixels[4][4].toRgb()).toEqual(C_WHITE)

        // Expect the other pixels to be black
        expect(pixels[0][1].toRgb()).toEqual(C_BLACK)
    })

    it('Verifies the transparent pixels pass through to sprites lower in the list of sprites (mirror isles)', () => {
        const { pixels, data } = parseAndReturnFirstSpritePixels(`
title Mirror Isles player transparent

========
OBJECTS
========

BackGround
#ffffff

Player
#000000 #493c2b #000000
..0..
.111.
01110
02220
.2.2.

=======
LEGEND
=======

P = Player

================
COLLISIONLAYERS
================

Background
Player

=======
LEVELS
=======

P

`)
        expect(data.getMagicBackgroundSprite().getPixels(5, 5)[0][0].toRgb()).toEqual(C_WHITE)
        expect(pixels[0][0].toRgb()).toEqual(C_WHITE)
        expect(pixels[0][2].toRgb()).toEqual(C_BLACK)
    })

    it('uses default color palette when none specified', () => {
        const game1 = parseAndReturnFirstSpritePixels(`
      title Game 1 with color palette
      color_palette pastel

      ========
      OBJECTS
      ========

      BackGround
      Lightblue

      Player
      #000000 #493c2b #000000
      ..0..
      .111.
      01110
      02220
      .2.2.

      =======
      LEGEND
      =======

      P = Player

      ================
      COLLISIONLAYERS
      ================

      Background
      Player

      =======
      LEVELS
      =======

      P

      `)

        expect(game1.pixels[0][0].toHex().toLowerCase()).toEqual(lookupColorPalette('pastel', 'lightblue').toLowerCase())

        const game2 = parseAndReturnFirstSpritePixels(`
      title Game 2 with no color palette

      ========
      OBJECTS
      ========

      BackGround
      Lightblue

      Player
      #000000 #493c2b #000000
      ..0..
      .111.
      01110
      02220
      .2.2.

      =======
      LEGEND
      =======

      P = Player

      ================
      COLLISIONLAYERS
      ================

      Background
      Player

      =======
      LEVELS
      =======

      P

      `)

        expect(game2.pixels[0][0].toHex().toLowerCase()).toEqual(lookupColorPalette('arnecolors', 'lightblue').toLowerCase())
    })

    it.skip('Does not replace the pixels in a sprite (grr, we should just use immutable objects', () => {
        // not sure how to test
        // This was caused by collapseSpritesToPixels using the 1st sprite (instead of copying it)
        // and then layering other sprites on top
    })
})
