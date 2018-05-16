import * as axel from "axel"

// First Sprite one is on top.
// This caused a 2x speedup while rendering.
function collapseSpritesToPixels (spritesToDraw, backgroundColor) {
  if (spritesToDraw.length === 1) {
    return spritesToDraw[0].getPixels()
  }
  if (spritesToDraw.length === 0) {
    // Just draw the background
    const sprite = []
    for (let y = 0; y < 5; y++) {
      sprite[y] = sprite[y] || []
      for (let x = 0; x < 5; x++) {
        // If this is the last sprite and nothing was found then use the game background color
        sprite[y][x] = backgroundColor
      }
    }
    return sprite
  }
  const sprite = spritesToDraw[0].getPixels()
  spritesToDraw.slice(1).forEach((objectToDraw, spriteIndex) => {
    const pixels = objectToDraw.getPixels()
    for (let y = 0; y < 5; y++) {
      sprite[y] = sprite[y] || []
      for (let x = 0; x < 5; x++) {
        const pixel = pixels[y][x]
        // try to pull it out of the current sprite
        if ((!sprite[y][x] || sprite[y][x].isTransparent()) && pixel && !pixel.isTransparent()) {
          sprite[y][x] = pixel
        }

        // If this is the last sprite and nothing was found then use the game background color
        if (!sprite[y][x] && spriteIndex === spritesToDraw.length - 1) {
          sprite[y][x] = backgroundColor
        }
      }
    }
  })
  return sprite
}

function renderCell (cell) {

}

class UI {
  renderScreen (data, levelRows) {
    axel.fg(255, 255, 255)
    axel.bg(0, 0, 0)

    data.settings.__magicBackgroundObject = data.objects.filter(({_name}) => _name.toLowerCase() === 'background')[0]

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

        this.drawCellAt(data, col /* cell */, rowIndex, colIndex)
      })
    })
    // Clear back to sane colors
    axel.fg(255, 255, 255)
    axel.bg(0, 0, 0)
  }

  drawCellAt (data, cell, rowIndex, colIndex) {
    const pixels = this.getPixelsForCell(data, cell)

    pixels.forEach((spriteRow, spriteRowIndex) => {
      spriteRow.forEach((spriteColor, spriteColIndex) => {
        let r
        let g
        let b
        let a

        if (spriteColor && spriteColor !== 'transparent') { // could be transparent
          const rgba = spriteColor.toRgba()
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

        const x = (colIndex * 5 + spriteColIndex) * 2 // Use 2 characters for 1 pixel on the X-axis
        const y = rowIndex * 5 + spriteRowIndex + 1 // Y column is 1-based
        if (a) {
          //TODO: brush is readonly. What are you trying to set here?
          //axel.brush = ' ' // " ░▒▓█"
          axel.bg(r, g, b)
          axel.point(x, y, "")
          axel.point(x + 1, y, "") // double-width because the console is narrow
        }
      })
    })

    restoreCursor()
  }

  getPixelsForCell (data, cell) {
    const spritesToDraw = cell.getSprites() // Not sure why, but entanglement renders properly when reversed

    // If there is a magic background object then rely on it last
    if (data.settings.__magicBackgroundObject) {
      spritesToDraw.push(data.settings.__magicBackgroundObject)
    }

    const pixels = collapseSpritesToPixels(spritesToDraw, data.settings.background_color)
    return pixels
  }

  clearScreen () {
    axel.fg(255, 255, 255)
    axel.bg(0, 0, 0)
    axel.clear()
  }

  writeDebug (text) {
    axel.fg(255, 255, 255)
    axel.bg(0, 0, 0)
    writeText(0, 0, `[${text}]`)
  }
}

function restoreCursor () {
  axel.cursor.restore()
}

function writeText (x, y, text) {
  axel.text(x, y, text)
  restoreCursor()
}

export default new UI()
