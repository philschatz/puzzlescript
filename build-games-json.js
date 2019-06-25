
// yarn compile:ts && node ./build-games-json.js && mv games/*.json ../puzzle-rust/games/


fs = require('fs')
Parser = require('./lib/parser/parser').default
Serializer = require('./lib/parser/serializer').default
glob = require('glob')
path = require('path')


glob('games/*/script.txt', (err, files) => {

  files.forEach(file => {
    gameName = path.basename(path.dirname(file))

    console.log(`Serializing "${gameName}"`)

    source = fs.readFileSync(file, 'utf-8')

    data = Parser.parse(source).data
    try {
      json = new Serializer(data).toJson()
      fs.writeFileSync(`games/${gameName}.json`, JSON.stringify(json, null, 2))
    } catch (e) {
      console.error(e.message)
      // continue
    }

  })

})



