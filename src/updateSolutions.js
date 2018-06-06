const {readFileSync, writeFileSync} = require('fs')
const {join: pathJoin} = require('path')
const glob = require('glob')

glob(pathJoin(__dirname, '../gist-solutions/*.json'), (err, filenames) => {
    if (err) {
        return console.log(err)
    }
    for (const filename of filenames) {
        const recordings = JSON.parse(readFileSync(filename, 'utf-8'))
        recordings.forEach((recording, index) => {
            if (typeof recording === 'string') {
                recordings[index] = { solution: recording }
            }
        })
        writeFileSync(filename, JSON.stringify(recordings, null, 2))
    }
})