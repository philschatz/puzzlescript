const {readFileSync} = require('fs')
const glob = require('glob')

const {parse} = require('./src/parser')
const {renderScreen} = require('./src/ui')
const Engine = require('./src/engine')

let totalRenderTime = 0

glob('./gists/*/script.txt', (err, files) => {
  if (err) {
    throw err
  }
  console.log(`Looping over ${files.length} games...`)

  files.forEach((filename, index) => {
    console.log(`Parsing and rendering ${filename}`);
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

      const startTime = Date.now()

      // Draw the "last" level (after the messages)
      const level = data.levels.reverse().filter(level => level.isMap())[0]
      if (level) {
        const engine = new Engine(data)
        engine.setLevel(data.levels.indexOf(level))

        // console.log(level)
        renderScreen(data, engine.currentLevel)

        engine.tick()
        // renderScreen(data, engine.currentLevel)
      }

      totalRenderTime += Date.now() - startTime

      if (index === files.length - 1) {
        console.log('-----------------------')
        console.log('Renderings took:', totalRenderTime)
        console.log('-----------------------')
      }
    }
  })
})
