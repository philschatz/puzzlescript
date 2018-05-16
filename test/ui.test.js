/* eslint-env jasmine */
const Parser = require('../src/parser')
const UI = require('../src/ui')

const C_WHITE = {r: 255, g: 255, b: 255, a: 1}
const C_BLACK = {r: 0,   g: 0,   b: 0,   a: 1}

function parseAndReturnFirstSpritePixels(code) {
  const {data} = Parser.parse(code)
  const cell = data.levels[0].getRows()[0][0]
  // console.log(cell.getSprites())
  return UI.getPixelsForCell(data, cell)
}


describe('UI', () => {
  it('Renders a single sprite', () => {
    const pixels = parseAndReturnFirstSpritePixels(`
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
LEVELS
===

w
`)

    // Expect a white diagonal
    expect(pixels[0][0].toRgba()).toEqual(C_WHITE)
    expect(pixels[1][1].toRgba()).toEqual(C_WHITE)
    expect(pixels[2][2].toRgba()).toEqual(C_WHITE)
    expect(pixels[3][3].toRgba()).toEqual(C_WHITE)
    expect(pixels[4][4].toRgba()).toEqual(C_WHITE)
  })


  it('Overlays sprites based on the collision layer', () => {
    const pixels = parseAndReturnFirstSpritePixels(`
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

Hole
WaterAnim1

===
LEVELS
===

W
`)

    // Expect a white diagonal
    expect(pixels[0][0].toRgba()).toEqual(C_WHITE)
    expect(pixels[1][1].toRgba()).toEqual(C_WHITE)
    expect(pixels[2][2].toRgba()).toEqual(C_WHITE)
    expect(pixels[3][3].toRgba()).toEqual(C_WHITE)
    expect(pixels[4][4].toRgba()).toEqual(C_WHITE)

    // Expect the other pixels to be black
    expect(pixels[0][1].toRgba()).toEqual(C_BLACK)
  })

})
