const {parse, parseGrammar} = require('../src/parser')

const OBJECT_HEADER = `
===
OBJECTS
===
`

const RULE_HEADER = `
===
RULES
===
`

function checkGrammar(code) {
  const {match, grammar} = parseGrammar(`title checkGrammar\n${RULE_HEADER}\n${code}`)
  const {data, error, trace} = match
  expect(error).toBeFalsy()

  const s = grammar.createSemantics()
  s.addOperation('toJSON2', {
    _terminal: function () { return this.primitiveValue },
    _iter: function(children) {
      return children.map(child => child.toJSON2())
    },
    _default: function(children) {
      if (this.ctorName === 'word') {
        return this.sourceString
      // } if (this.ctorName[0] === this.ctorName[0].toLowerCase()) {
      //   return this.ctorName
      } else {
        const obj = {
          __name: this.ctorName
        }
        children.forEach((child, index) => {
          const value = child.toJSON2()
          if (!Array.isArray(value) || value.length >= 1) {
            obj[`_i${index}`] = value
          }
        })
        return obj
      }
    }
  })
  const tree = s(match).toJSON2()
  expect(tree).toMatchSnapshot()
  return tree
}

function checkParse(code, varNames) {
  // Now check if the semantics parsed
  const objectDefinitions = varNames.map(varName => {
    return `${varName}\ntransparent\n\n`
  })
  const {data, error, trace} = parse(`title checkParse\n${OBJECT_HEADER}\n${objectDefinitions.join('\n')}\n${RULE_HEADER}\n${code}`)
  expect(error).toBeFalsy()
  expect(data).toMatchSnapshot()
  return data
}

function parseRule(code, varNames) {
  checkGrammar(code)
  return checkParse(code, varNames)
}


describe('rules', () => {
  it('parses a simple rule', () => {
    parseRule('[ z ] -> [ ]', ['z'])
  })
  it('parses a simple rule 2', () => {
    parseRule('[ z ] -> [ z ]', ['z'])
  })
  it('parses a simple rule without whitespace', () => {
    parseRule('[z]->[z]', ['z'])
  })
  it('parses a rule with multiple cells', () => {
    parseRule('[ z | x ]->[ ]', ['z', 'x'])
  })
  // it('parses a rule with multiple layers', () => {
  //   parseRule('[ z x ]->[ ]', ['z', 'x'])
  // })
  it('parses a rule with ellpisis', () => {
    parseRule('[ z | ... | x ] -> [ RANDOM z | ... | x ]', ['z', 'x'])
  })

  describe('Cell Modifiers', () => {
    it('parses a rule with directions 1', () => {
      parseRule('[ > z ] -> [ z ]', ['z'])
    })
    it('parses a rule with directions 2', () => {
      parseRule('[ ^ z ] -> [ z ]', ['z'])
    })
    it('parses a rule with modifiers', () => {
      parseRule('[ NO z ] -> [ z ]', ['z'])
    })
    it('parses a rule with modifiers 2', () => {
      parseRule('[ STATIONARY z ] -> [ z ]', ['z'])
    })
  })

})
