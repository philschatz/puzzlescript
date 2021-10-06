/* eslint-env jasmine */
import { lookupColorPalette } from '../../../puzzlescript/src/colors'
import { GameEngine } from '../../../puzzlescript/src/engine'
import { RGB } from '../../../puzzlescript/src/models/colors'
import Parser from '../../../puzzlescript/src/parser/parser'
import UI from './terminal'
import { EmptyGameEngineHandler } from '../../../puzzlescript/src/util'

const C_WHITE = new RGB(255, 255, 255, null)
const C_BLACK = new RGB(0, 0, 0, null)
const C_GRAY = new RGB(119, 119, 119, null) // not sure why this cannot be 127 or 128 but it's close enough

function parseAndReturnFirstSpritePixels(code: string) {
    const { data } = Parser.parse(code)
    const engine = new GameEngine(data, new EmptyGameEngineHandler())
    engine.setLevel(0, null/*no checkpoint*/)
    const cell = engine.getCurrentLevelCells()[0][0]
    // console.log(cell.getSprites())
    UI.onGameChange(engine.getGameData())
    const pixels = UI.getPixelsForCell(cell)
    UI.destroy()
    return { pixels, data }
}

describe('UI', () => {

    afterEach(() => {
        // clean up memory leaks
        UI.destroy()
    })

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

    it('Uses the alpha channel', () => {
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
#fff7 transparent
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

        // Expect a gray diagonal
        expect(pixels[0][0].toRgb()).toEqual(C_GRAY)
        expect(pixels[1][1].toRgb()).toEqual(C_GRAY)
        expect(pixels[2][2].toRgb()).toEqual(C_GRAY)
        expect(pixels[3][3].toRgb()).toEqual(C_GRAY)
        expect(pixels[4][4].toRgb()).toEqual(C_GRAY)

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
        const background = data.getMagicBackgroundSprite()
        if (!background) {
            throw new Error(`BUG: Background sprite not found`)
        }
        expect(background.getPixels(5, 5)[0][0].toRgb()).toEqual(C_WHITE)
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
