const {readFileSync} = require('fs')
const glob = require('glob')

const {parse} = require('./src/parser')
const {renderLevel} = require('./src/ui')


let totalRenderTime = 0


glob('./gists/*/script.txt', (err, files) => {

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

      const startTime = Date.now()

      // Draw the "last" level (after the messages)
      const level = data.levels.reverse().filter(level => level.isMap())[0]
      if (level) {
        // console.log(level)
        renderLevel(data, level)
      }

      totalRenderTime += Date.now() - startTime

      if (index === files.length - 1) {
        console.log('-----------------------');
        console.log('Renderings took:', totalRenderTime)
        console.log('-----------------------');
      }
    }

  })

})
