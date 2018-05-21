const { parseEngine } = require('./engine.test')

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
        engine.tick()
        expect(engine.toSnapshot()).toMatchSnapshot()
        // Once these sprites actually move, we neet to separate engine.tick() into multiple steps:
        // 1. Update all the cells with new sprites and the wantsToMove directions
        // 2. Move all the sprites that want to move
        // 3. Late: Update all the cells with new sprites ...
        // 4. Late: Move all the sprites that want to move
        // next tick for all the AGAIN rules
        expect([...engine.currentLevel[0][0]._spriteAndWantsToMoves][0].b).toBe('RIGHT')

    })
})