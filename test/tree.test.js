const { default: Engine } = require('../src/engine')
const { default: Parser } = require('../src/parser/parser')
const { buildAndPopulateTree } = require('../src/gameTree')

function parseEngine(code) {
    const { data, error } = Parser.parse(code)
    expect(error && error.message).toBeFalsy() // Use && so the error messages are shorter

    const engine = new Engine(data)
    engine.setLevel(0)
    return { engine, data }
}

function getSpriteByName(data, name) {
    return data.objects.filter((sprite) => sprite._name === name)[0]
}


describe('GameTree', () => {
    it('percolates up a simple rule', () => {
        const {engine, data} = parseEngine(`
        title foo

        ===
        OBJECTS
        ===

        player p
        white

        cat c
        black

        dog d
        brown

        kangaroo k
        pink

        ===
        COLLISIONLAYERS
        ===

        player, cat, dog, kangaroo

        ===
        RULES
        ===

        [ player | NO cat | > dog | ] [ kangaroo ] -> [ | | | ] [ ]


        ===
        LEVELS
        ===

        pddck
        `)

        const tree = buildAndPopulateTree(data, engine)
        // // Delete the Engine ref in the Cell so it serializes better
        // engine.getCells().forEach(cell => {
        //     cell._engine = null
        //     cell._spriteAndWantsToMoves = null
        // })
        // expect(tree).toMatchSnapshot()
    })
})