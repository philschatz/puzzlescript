const glob = require('glob')
const ohm = require('ohm-js')
const {readFileSync} = require('fs')

const {parse} = require('./src/parser')


glob('./gists/*/script.txt', (err, files) => {
// glob('./test-game.txt', (err, files) => {

  console.log(`Looping over ${files.length} games...`);

  files.forEach((filename, index) => {

    const code = readFileSync(filename, 'utf-8')
    const {data, error, trace} = parse(code)

    if (error) {
      console.log(trace.toString())
      console.log(m.message)
      console.log(`Failed on game ${index}`)
      throw new Error(filename)
    } else {
      console.log(data.settings)
    }

  })

})
