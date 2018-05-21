const { parseEngine } = require('./engine.test')
const { resetRandomSeed } = require('../src/util')

describe('Directions', () => {
    it('Marks a sprite when it wants to move', () => {
        const {engine, data} = parseEngine(`
title foo

========
OBJECTS
========

Background
green

Player
blue

=======
LEGEND
=======

. = Background
P = Player

================
COLLISIONLAYERS
================

Background
Player

===
RULES
===

[ Player ] -> [ > Player ]

=======
LEVELS
=======

P.

`)
        const {changedCells} = engine.tickUpdateCells()
        expect(engine.toSnapshot()).toMatchSnapshot()
        // Once these sprites actually move, we neet to separate engine.tick() into multiple steps:
        // 1. Update all the cells with new sprites and the wantsToMove directions
        // 2. Move all the sprites that want to move
        // 3. Late: Update all the cells with new sprites ...
        // 4. Late: Move all the sprites that want to move
        // next tick for all the AGAIN rules
        expect([...engine.currentLevel[0][0]._spriteAndWantsToMoves][0].b).toBe('RIGHT')

        // Ensure only 1 cell was marked for update
        expect(changedCells.size).toBe(1)
        expect(changedCells).toContain(engine.currentLevel[0][0])
    })

    it('Moves the sprite', () => {
        const {engine, data} = parseEngine(`
title foo

========
OBJECTS
========

Background
green

Player
blue

=======
LEGEND
=======

. = Background
P = Player

================
COLLISIONLAYERS
================

Background
Player

===
RULES
===

[ Player ] -> [ > Player ]

=======
LEVELS
=======

P.

`)
        const {changedCells} = engine.tick()
        // expect(engine.toSnapshot()).toMatchSnapshot()
        const player = data._getSpriteByName('player')
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(player)).toBe(true)

        // Ensure both cells were marked for re-rendering
        expect(changedCells.size).toBe(2)
        expect(changedCells).toContain(engine.currentLevel[0][0])
        expect(changedCells).toContain(engine.currentLevel[0][1])

    })

    it('Does not move the sprite if it collides with a sprite in another cell (same collisionlayer)', () => {
        const {engine, data} = parseEngine(`
title foo

========
OBJECTS
========

Background
green

Player
blue

Wall
brown

=======
LEGEND
=======

. = Background
P = Player
W = Wall

================
COLLISIONLAYERS
================

Background
Player, Wall

===
RULES
===

[ Player ] -> [ > Player ]

=======
LEVELS
=======

PW

`)
        const {changedCells} = engine.tick()
        // expect(engine.toSnapshot()).toMatchSnapshot()
        const player = data._getSpriteByName('player')
        expect(engine.currentLevel[0][1].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(player)).toBe(true)

        // Make sure the wantsToMove flag is cleared
        expect(engine.currentLevel[0][0]._getSpriteAndWantsToMoveForSprite(player).b).toBeFalsy()

        // TODO: Ideally this would be 0 because nothing actually changed
        expect(changedCells.size).toBe(1)
        expect(changedCells).toContain(engine.currentLevel[0][0])

    })


    it('Does not move the sprite when ACTION is added to it', () => {
        const {engine, data} = parseEngine(`
title foo

========
OBJECTS
========

Background
green

Player
blue

=======
LEGEND
=======

. = Background
P = Player

================
COLLISIONLAYERS
================

Background
Player

===
RULES
===

[ Player ] -> [ ACTION Player ]

=======
LEVELS
=======

P.

`)
        const {changedCells} = engine.tick()
        // expect(engine.toSnapshot()).toMatchSnapshot()
        const player = data._getSpriteByName('player')
        expect(engine.currentLevel[0][0].getSpritesAsSet().has(player)).toBe(true)

        // Make sure the wantsToMove flag is cleared
        expect(engine.currentLevel[0][0]._getSpriteAndWantsToMoveForSprite(player).b).toBeFalsy()

        // Ideally this would be 0 since the cell did not actually change
        expect(changedCells.size).toBe(1)
        expect(changedCells).toContain(engine.currentLevel[0][0])

    })

    it('Moves the sprite in a "random" direction using "RANDOM" in a bracket', () => {
        resetRandomSeed()
        const {engine, data} = parseEngine(`
title foo

========
OBJECTS
========

Background
green

Player
blue

=======
LEGEND
=======

. = Background
P = Player

================
COLLISIONLAYERS
================

Background
Player

===
RULES
===

[ Player ] -> [ RANDOM Player ]

=======
LEVELS
=======

.....
.....
..P..
.....
.....

`)
        const {changedCells} = engine.tick()
        // expect(engine.toSnapshot()).toMatchSnapshot()
        const player = data._getSpriteByName('player')
        expect(engine.currentLevel[2][2].getSpritesAsSet().has(player)).toBe(false)
        // Check that the player is around thir previous location
        expect(engine.currentLevel[2][1].getSpritesAsSet().has(player)).toBe(true)
        expect(engine.currentLevel[2][3].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[1][2].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[3][2].getSpritesAsSet().has(player)).toBe(false)

        // Ensure 2 cells were marked for re-rendering
        expect(changedCells.size).toBe(2)
        expect(changedCells).toContain(engine.currentLevel[2][2])
        expect(changedCells).toContain(engine.currentLevel[2][1])


        engine.tick()
        // Check that the player is no longer in the spot they were
        expect(engine.currentLevel[2][1].getSpritesAsSet().has(player)).toBe(false)
        // Check that the player is around thir previous location
        expect(engine.currentLevel[2][0].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[2][2].getSpritesAsSet().has(player)).toBe(true)
        expect(engine.currentLevel[1][1].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[3][1].getSpritesAsSet().has(player)).toBe(false)

    })


    it('Moves the sprite in a "random" direction using "RANDOMDIR" in a bracket', () => {
        resetRandomSeed()
        const {engine, data} = parseEngine(`
title foo

========
OBJECTS
========

Background
green

Player
blue

=======
LEGEND
=======

. = Background
P = Player

================
COLLISIONLAYERS
================

Background
Player

===
RULES
===

[ Player ] -> [ RANDOMDIR Player ]

=======
LEVELS
=======

.....
.....
..P..
.....
.....

`)
        const {changedCells} = engine.tick()
        // expect(engine.toSnapshot()).toMatchSnapshot()
        const player = data._getSpriteByName('player')
        expect(engine.currentLevel[2][2].getSpritesAsSet().has(player)).toBe(false)
        // Check that the player is around thir previous location
        expect(engine.currentLevel[2][1].getSpritesAsSet().has(player)).toBe(true)
        expect(engine.currentLevel[2][3].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[1][2].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[3][2].getSpritesAsSet().has(player)).toBe(false)

        // Ensure 2 cells were marked for re-rendering
        expect(changedCells.size).toBe(2)
        expect(changedCells).toContain(engine.currentLevel[2][2])
        expect(changedCells).toContain(engine.currentLevel[2][1])


        engine.tick()
        // Check that the player is no longer in the spot they were
        expect(engine.currentLevel[2][1].getSpritesAsSet().has(player)).toBe(false)
        // Check that the player is around thir previous location
        expect(engine.currentLevel[2][0].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[2][2].getSpritesAsSet().has(player)).toBe(true)
        expect(engine.currentLevel[1][1].getSpritesAsSet().has(player)).toBe(false)
        expect(engine.currentLevel[3][1].getSpritesAsSet().has(player)).toBe(false)

    })

})