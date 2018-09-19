import * as fs from 'fs'
import * as nearley from 'nearley'
import { IASTGame } from './astTypes'
import * as compiledGrammar from './grammar'
import parser2 from './parser'

const grammar = nearley.Grammar.fromCompiled(compiledGrammar as nearley.CompiledRules)
const parser = new nearley.Parser(grammar)

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

const results = parser.results as Array<IASTGame<string>>

if (results.length === 1) {
    parser2.parse(content + '\n')
    // console.log(data)
} else if (results.length === 0) {
    console.log(`ERROR: Could not parse ${filename}`) // tslint:disable-line:no-console
    process.exit(111)
} else {
    console.log(`AMBIGUOUS: "${filename}" has ${results.length} results`) // tslint:disable-line:no-console
    process.exit(112)
}
