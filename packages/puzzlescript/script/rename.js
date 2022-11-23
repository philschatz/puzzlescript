const fs = require('fs')
const path = require('path')
const glob = require('glob')
let from
let to

const ROOT_DIR = path.join(__dirname, '..')

glob(path.join(__dirname, '../games/*/script.txt'), (err, gameSources) => {

    for (const gameSource of gameSources) {
        // Check if the game exists
        if (fs.existsSync(gameSource)) {

            from = path.basename(path.dirname(gameSource))

            // Read the 1st couple of lines of the game to see what the title should be
            const sourceLines = fs.readFileSync(gameSource, 'utf8').split('\n')
            const titleLine = sourceLines.find(l => l.startsWith('title '))

            if (titleLine) {
                to = titleLine.substring('title '.length)
            }
            let parenIndex = to.indexOf('(')
            if (parenIndex < 0) {
                parenIndex = to.indexOf('[')
            }
            to = to
                .substring(0, parenIndex < 0 ? undefined : parenIndex)
                .trim()
                .replace(/[ '\.]/g, '-') // chars to replace with -
                .replace(/[!,:]/g, '') // chars to just remove
                .replace(/&/g, '-and-')
                .replace(/--/g, '-') // collapse multiple -
                .replace(/--/g, '-') // collapse multiple -
                .replace(/--/g, '-') // collapse multiple -
                .replace(/--/g, '-') // collapse multiple -
                .replace(/-$/g, '') // remove trailing -
                .toLowerCase()
            console.log(`mv "games/${from}" "games/${to}"`)

            // Check if the solution exists
            if (fs.existsSync(path.join(ROOT_DIR, 'game-solutions', `${from}.json`))) {
                console.log(`mv "game-solutions/${from}.json" "game-solutions/${to}.json"`)
            }

            // Check if there are references to the game in code (including package.json)
            console.log(`grep -R "${from}" src`)
            console.log(`echo "${from} -> ${to}" >> rename.log`)
            // console.log(`${from}\t|\t${to}`)

        } else {
            console.error(`ERROR: Game not found '${gameSource}'`)
        }
    }

})
