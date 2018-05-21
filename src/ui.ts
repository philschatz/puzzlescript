import * as axel from 'axel'
import { GameSprite } from './models/tile'
import { GameData } from './models/game'
import { IColor } from './models/colors'
import { Cell } from './engine'
import { RULE_DIRECTION } from './pairs';

// First Sprite one is on top.
// This caused a 2x speedup while rendering.
function collapseSpritesToPixels(spritesToDraw: GameSprite[], backgroundColor: IColor) {
  if (spritesToDraw.length === 1) {
    return spritesToDraw[0].getPixels()
  }
  if (spritesToDraw.length === 0) {
    // Just draw the background
    const sprite: IColor[][] = []
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

class UI {
  _resizeHandler?: () => void
  constructor() {
    this._resizeHandler = null
  }
  renderScreen(data: GameData, levelRows: Cell[][]) {
    // axel.cursor.off()

    // Handle resize events by redrawing the game. Ooh, we do not have Cells at this point.
    // TODO Run renderScreen on cells from the engine rather than cells from the Level data
    if (this._resizeHandler) {
      process.stdout.off('resize', this._resizeHandler)
    }
    this._resizeHandler = () => {
      this.renderScreen(data, levelRows)
    }
    process.stdout.on('resize', this._resizeHandler)

    axel.fg(255, 255, 255)
    axel.bg(0, 0, 0)

    levelRows.forEach((row, rowIndex) => {
      // Don't draw too much for this demo
      if (data.metadata.flickscreen && rowIndex > data.metadata.flickscreen.height) {
        return
      }
      row.forEach((col, colIndex) => {
        // Don't draw too much for this demo
        if (data.metadata.flickscreen && colIndex > data.metadata.flickscreen.width) {
          return
        }

        this.drawCell(data, col, false)
      })
    })
    // Clear back to sane colors
    axel.fg(255, 255, 255)
    axel.bg(0, 0, 0)
    // axel.cursor.restore()

    // Just for debugging, print the game title (doing it here helps with Jest rendering correctly)
    this.writeDebug(`"${data.title}"`)
  }

  drawCell(data: GameData, cell: Cell, dontRestoreCursor: boolean) {
    const spritesForDebugging = cell.getSprites()
    const {rowIndex, colIndex} = cell
    const pixels: IColor[][] = this.getPixelsForCell(data, cell)

    pixels.forEach((spriteRow, spriteRowIndex) => {
      spriteRow.forEach((spriteColor: IColor, spriteColIndex) => {
        const x = (colIndex * 5 + spriteColIndex) * 2 + 1 // Use 2 characters for 1 pixel on the X-axis. X column is 1-based
        const y = rowIndex * 5 + spriteRowIndex + 1 // Y column is 1-based
        let r
        let g
        let b

        // Don't draw below the edge of the screen. Otherwise, bad scrolling things will happen
        if (y >= process.stdout.rows) {
          return
        }

        let color: IColor

        // Always draw a transparent character so we can see if something is not rendering
        // axel.fg(255, 255, 255)
        // axel.bg(0, 0, 0)
        // axel.point(x, y, '░')
        // axel.point(x + 1, y, '░') // double-width because the console is narrow

        if (spriteColor) {
          if (!spriteColor.isTransparent()) {
            color = spriteColor
          }
          else if (data.metadata.background_color) {
            color = data.metadata.background_color
          }
        }

        if (!!color) {
          const rgb = color.toRgb()
          r = rgb.r
          g = rgb.g
          b = rgb.b

          // TODO: brush is readonly. What are you trying to set here?
          // axel.brush = ' ' // " ░▒▓█"
          axel.fg(255, 255, 255)
          axel.bg(r, g, b)
          axel.point(x, y, ' ')
          axel.point(x + 1, y, ' ') // double-width because the console is narrow

          // Print a debug number which contains the number of sprites in this cell
          // Change the foreground color to be black if the color is light
          if (r > 192 && g > 192 && b > 192) {
            axel.fg(0, 0, 0)
          }
          if (spritesForDebugging[spriteRowIndex]) {
            let spriteName = spritesForDebugging[spriteRowIndex]._name
            if (spriteName.length > 10) {
              spriteName = `${spriteName.substring(0, 5)}.${spriteName.substring(spriteName.length - 4)}`
            }
            axel.text(x, y, `${spriteName.substring(spriteColIndex * 2, spriteColIndex * 2 + 2)}`)
          }
          if (spriteRowIndex === 4 && spriteColIndex === 4) {
            axel.text(x + 1, y, `${spritesForDebugging.length}`)
          }
        }
      })
    })

    if (!dontRestoreCursor) {
      restoreCursor()
    }
  }

  getPixelsForCell(data: GameData, cell: Cell) {
    const spritesToDraw = cell.getSprites() // Not sure why, but entanglement renders properly when reversed

    // If there is a magic background object then rely on it last
    let magicBackgroundSprite = data.getMagicBackgroundSprite()
    if (magicBackgroundSprite) {
      spritesToDraw.push(magicBackgroundSprite)
    }

    const pixels = collapseSpritesToPixels(spritesToDraw, data.metadata.background_color)
    return pixels
  }

  clearScreen() {
    axel.fg(255, 255, 255)
    axel.bg(0, 0, 0)
    axel.clear()
  }

  writeDebug(text: string) {
    axel.fg(255, 255, 255)
    axel.bg(0, 0, 0)
    writeText(0, 0, `[${text}]`)
  }
}

function restoreCursor() {
  axel.cursor.restore()
}

function writeText(x: number, y: number, text: string) {
  axel.text(x, y, text)
}

export default new UI()
