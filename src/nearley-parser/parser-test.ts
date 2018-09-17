import * as fs from 'fs'
import * as nearley from 'nearley'
import * as compiledGrammar from './grammar'

const parser = new nearley.Parser(nearley.Grammar.fromCompiled(compiledGrammar as nearley.CompiledRules))

const filename = process.argv[2]
if (!filename) {
  throw new Error(`Missing filename argument`)
}

const content = fs.readFileSync(filename, 'utf-8')
parser.feed(content)

if (content[content.length - 1] !== '\n') {
  parser.feed('\n') // some games do not finish the level with a newline
}
parser.finish()

// const results = parser.finish()
if (parser.results.length === 1) {
  console.log(`UNIQUE PARSE: ${filename}`)
} else if (parser.results.length === 0) {
  console.log(`ERROR: Could not parse ${filename}`)
  process.exit(111)
} else {
  console.log(`AMBIGUOUS: "${filename}" has ${parser.results.length} results`)
  process.exit(112)
}
