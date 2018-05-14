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
  // add a header for the parser
  code = `title checkGrammar\n${RULE_HEADER}\n${code}`

  const {match, grammar} = parseGrammar(code)
  if (!match.succeeded()) {
    const trace = grammar.trace(code)
    console.log(trace.toString())
  }
  expect(match.succeeded()).toBe(true)

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
  const legendItems = varNames.map(varName => {
    return `${varName} = testObject`
  })
  const {data, error, trace} = parse(`
title checkParse

===
OBJECTS
===

testObject
transparent

===
LEGEND
===

${legendItems.join('\n')}

====
RULES
====

${code}
`)
  if (error) {
    console.log(error.message)
  }
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
    parseRule('[ z | x ] -> [ ]', ['z', 'x'])
  })
  it('parses a rule with multiple layers', () => {
    parseRule('[ z x ] -> [ ]', ['z', 'x'])
  })
  it('parses a rule with ellpisis', () => {
    parseRule('[ z | ... | x ] -> [ RANDOM z | ... | x ]', ['z', 'x'])
  })
  it('parses a rule with a period for a variable name', () => {
    parseRule('[.] -> []', ['.'])
  })
  it('parses a rule with a _ for a variable name', () => {
    parseRule('[z_x] -> []', ['z_x'])
  })


  describe('Cell Modifiers', () => {
    it('parses a rule with directions', () => {
      parseRule('[ACTION z ] -> [ ]', ['z'])
      parseRule('[^ z ] -> [ ]', ['z'])
      parseRule('[v z ] -> [ ]', ['z']) // This needs to be the down arrow, not a variable
      parseRule('[> z ] -> [ ]', ['z'])
      parseRule('[< z ] -> [ ]', ['z'])
      parseRule('[LEFT z ] -> [ ]', ['z'])
      parseRule('[RIGHT z ] -> [ ]', ['z'])
      parseRule('[UP z ] -> [ ]', ['z'])
      parseRule('[DOWN z ] -> [ ]', ['z'])
      parseRule('[STATIONARY z ] -> [ ]', ['z'])
      parseRule('[MOVING z ] -> [ ]', ['z'])
      parseRule('[VERTICAL z ] -> [ ]', ['z'])
      parseRule('[HORIZONTAL z ] -> [ ]', ['z'])
      parseRule('[PERPENDICULAR z ] -> [ ]', ['z'])
      parseRule('[ORTHOGONAL z ] -> [ ]', ['z'])
      parseRule('[RANDOMDIR z ] -> [ ]', ['z'])
    })
    it('parses a rule with modifiers', () => {
      parseRule('[ NO z ] -> [ ]', ['z'])
    })
    it('parses a rule with a variable that begins with the name of a modifier', () => {
      parseRule('[ stationaryz ] -> [ stationaryz ]', ['stationaryz'])
    })
    it('parses a rule with modifiers 2', () => {
      parseRule('[ STATIONARY z ] -> [ z ]', ['z'])
    })
  })

  describe('Commands', () => {
    it('parses a rule with a command inside the brackets (these should be moved up to the Action Commands)', () => {
      parseRule('[z]->[SFX0]', ['z'])
      parseRule('[z]->[z SFX1]', ['z'])
      parseRule('[z]->[z winter]', ['z', 'winter'])
    })
  })


})
