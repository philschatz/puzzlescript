const fs = require('fs')
const path = require('path')

const FILENAME = path.join(__dirname, 'static', 'index.xhtml')

const data = fs.readFileSync(FILENAME, 'utf-8')
const uppercased = data.replace('<!doctype html>', '<!DOCTYPE html>')
if (uppercased.indexOf('<!DOCTYPE html>') < 0) {
    throw new Error(`BUG? Did not replace lowercase doctype with uppercase DOCTYPE (necessary for XHTML) in file '${FILENAME}'`)
}
fs.writeFileSync(FILENAME, uppercased)