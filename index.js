const {readFileSync} = require('fs')
const glob = require('glob')
const ohm = require('ohm-js')
const axel = require('axel')

const {parse, LevelMap, GameLegendItemSimple, GameLegendItemAnd} = require('./src/parser')


glob('./gists/*/script.txt', (err, files) => {
// glob('./test-game.txt', (err, files) => {

  console.log(`Looping over ${files.length} games...`);

  files.forEach((filename, index) => {

    const code = readFileSync(filename, 'utf-8')
    const {data, error, trace} = parse(code)

    if (error) {
      console.log(trace.toString())
      console.log(error.message)
      console.log(`Failed on game ${index}`)
      throw new Error(filename)
    } else {
      // console.log(data.title)
      // return

      // Draw the "first" level (after the messages)
      const level = data.levels.filter(level => level.isMap())[0]
      if (level) {
        // console.log(level)
        axel.bg(0,0,0)
        axel.clear()
        level.getRows().forEach((row, rowIndex) => {
          // Don't draw too much for this demo
          if (data.settings.flickscreen && rowIndex > data.settings.flickscreen.height) {
            return
          }
          row.forEach((col, colIndex) => {
            // Don't draw too much for this demo
            if (data.settings.flickscreen && rowIndex > data.settings.flickscreen.width) {
              return
            }
            if (!col.getObjects) {
              axel.bg(0,0,0)
              console.log(col)
            }
            const objectsToDraw = col.getObjects()
            objectsToDraw.forEach(objectToDraw => {
              if (!objectToDraw.getPixels) {
                axel.bg(0,0,0)
                console.log(col)
              }
              objectToDraw.getPixels().forEach((objRow, objRowIndex) => {
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

                  if (a === 0 && data.settings.background_color) {
                    objColor = data.settings.background_color
                    const rgba = objColor.toRgba()
                    r = rgba.r
                    g = rgba.g
                    b = rgba.b
                    a = rgba.a
                  }

                  if (a === 0) {
                    return
                  }

                  const x = (colIndex * 5 + objColIndex) * 2 // Use 2 characters for 1 pixel on the X-axis
                  const y = rowIndex * 5 + objRowIndex
                  if (a) {
                    axel.brush = ' ' // " ░▒▓█"
                    axel.fg(255, 255, 255)
                    axel.bg(r, g, b)
                    axel.point(x, y)
                    axel.point(x + 1, y) // double-width because the console is narrow
                  }

                })
              })
            })
          })
        })
      }
    }

  })

})
