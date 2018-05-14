const axel = require('axel')

// First Tile one is on top.
// This caused a 2x speedup while rendering.
function collapseTilesToPixels (objectsToDraw, backgroundColor) {
  if (objectsToDraw.length === 1) {
    return objectsToDraw[0].getPixels()
  }
  const tile = objectsToDraw[0].getPixels()
  objectsToDraw.slice(1).forEach((objectToDraw, tileIndex) => {
    const pixels = objectToDraw.getPixels()
    for (let y = 0; y < 5; y++) {
      tile[y] = tile[y] || []
      for (let x = 0; x < 5; x++) {
        const pixel = pixels[y][x]
        // try to pull it out of the current object
        if (!tile[y][x] && pixel && pixel !== 'transparent' && pixel.toRgba().a === 1) {
          tile[y][x] = pixel
        }

        // If this is the last tile and nothing was found then use the game background color
        if (!tile[y][x] && tileIndex === objectsToDraw.length - 1) {
          tile[y][x] = backgroundColor
        }
      }
    }
  })
  return tile
}

function renderScreen (data, levelRows) {
  axel.fg(255, 255, 255)
  axel.bg(0, 0, 0)
  axel.clear()

  const magicBackgroundObject = data.objects.filter(({_name}) => _name.toLowerCase() === 'background')[0]

  levelRows.forEach((row, rowIndex) => {
    // Don't draw too much for this demo
    if (data.settings.flickscreen && rowIndex > data.settings.flickscreen.height) {
      return
    }
    row.forEach((col, colIndex) => {
      // Don't draw too much for this demo
      if (data.settings.flickscreen && colIndex > data.settings.flickscreen.width) {
        return
      }
      const objectsToDraw = col.getObjects() // Not sure why, but entanglement renders properly when reversed

      // If there is a magic background object then rely on it last
      if (magicBackgroundObject) {
        objectsToDraw.push(magicBackgroundObject)
      }

      const pixels = collapseTilesToPixels(objectsToDraw, data.settings.background_color)

      pixels.forEach((objRow, objRowIndex) => {
        objRow.forEach((objColor, objColIndex) => {
          let r
          let g
          let b
          let a

          if (objColor && objColor !== 'transparent') { // could be transparent
            const rgba = objColor.toRgba()
            r = rgba.r
            g = rgba.g
            b = rgba.b
            a = rgba.a
          }

          // Fallback to the game background color (e.g. entanglement)
          if (a !== 1 && data.settings.background_color) {
            const rgba = data.settings.background_color.toRgba()
            r = rgba.r
            g = rgba.g
            b = rgba.b
            a = rgba.a
          }

          const x = (colIndex * 5 + objColIndex) * 2 // Use 2 characters for 1 pixel on the X-axis
          const y = rowIndex * 5 + objRowIndex + 1 // Y column is 1-based
          if (a) {
            axel.brush = ' ' // " ░▒▓█"
            axel.bg(r, g, b)
            axel.point(x, y)
            axel.point(x + 1, y) // double-width because the console is narrow
          }
        })
      })
    })
  })
  // Clear back to sane colors
  axel.fg(255, 255, 255)
  axel.bg(0, 0, 0)
}

function clearScreen() {
  axel.clear()
}

module.exports = { renderScreen, clearScreen }
