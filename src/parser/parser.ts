import nearleyParser from '../nearley-parser/parser'
import { _extend } from '../util'

class Parser {

    public parse(code: string) {
        return nearleyParser.parse(code)
    }
}

export default new Parser()
