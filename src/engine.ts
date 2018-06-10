import * as _ from 'lodash'
import { EventEmitter2 } from 'eventemitter2'
import { GameData } from './models/game'
import { LevelMap } from './models/level';
import { GameSprite, GameLegendTileSimple, IGameTile } from './models/tile'
import { GameRule, CellMutation, IRule, IMutation } from './models/rule'
import { RULE_MODIFIER, nextRandom, setAddAll, RULE_DIRECTION_ABSOLUTE } from './util'
import { RULE_DIRECTION } from './enums';
import { AbstractCommand, COMMAND_TYPE } from './models/command';
import { GameSound } from './models/sound';

const MAX_REPEATS = 10


// This Object exists so the UI has something to bind to
export class Cell {
    _engine: Engine
    // In the original implementation, wantsToMove is stored for the collisionLayer,
    // not on the sprite. Since we do not do that, we have to transfer the wantsToMove
    // when a sprite in a collisionLayer is swapped with another sprite in the same layer.
    // TODO: Store wantsToMove information using the collisionLayer as a key rather than the sprite.
    _spriteAndWantsToMoves: Map<GameSprite, string>
    rowIndex: number
    colIndex: number

    constructor(engine: Engine, sprites: Set<GameSprite>, rowIndex: number, colIndex: number) {
        this._engine = engine
        this.rowIndex = rowIndex
        this.colIndex = colIndex
        this._spriteAndWantsToMoves = new Map()

        for (const sprite of sprites) {
            this._spriteAndWantsToMoves.set(sprite, RULE_DIRECTION_ABSOLUTE.STATIONARY)
        }

    }

    getSprites() {
        // Just pull out the sprite, not the wantsToMoveDir
        const sprites = [...this._spriteAndWantsToMoves.keys()]
        return sprites.sort((a, b) => {
            return a.getCollisionLayerNum() - b.getCollisionLayerNum()
        }).reverse()
    }
    getSpritesAsSet() {
        // Just pull out the sprite, not the wantsToMoveDir
        return new Set(this._spriteAndWantsToMoves.keys())
    }
    getSpriteAndWantsToMoves() {
        // Just pull out the sprite, not the wantsToMoveDir
        // Retur na new set so we can mutate it later
        return new Map(this._spriteAndWantsToMoves)
    }
    hasSprite(sprite: GameSprite) {
        return this._spriteAndWantsToMoves.has(sprite)
    }

    _getRelativeNeighbor(y: number, x: number) {
        const row = this._engine.currentLevel[this.rowIndex + y]
        if (!row) return null
        return row[this.colIndex + x]
    }
    getNeighbor(direction: string) {
        switch (direction) {
            case RULE_MODIFIER.UP:
                return this._getRelativeNeighbor(-1, 0)
            case RULE_MODIFIER.DOWN:
                return this._getRelativeNeighbor(1, 0)
            case RULE_MODIFIER.LEFT:
                return this._getRelativeNeighbor(0, -1)
            case RULE_MODIFIER.RIGHT:
                return this._getRelativeNeighbor(0, 1)
            default:
                throw new Error(`BUG: Unsupported direction "${direction}"`)
        }
    }
    wantsToMoveTo(tile: IGameTile, absoluteDirection: RULE_DIRECTION) {
        let wantsToMove = false
        tile.getSprites().forEach(sprite => {
            const directionForSprite = this.directionForSprite(sprite)
            if (directionForSprite && directionForSprite === absoluteDirection) {
                wantsToMove = true
            }
        })
        return wantsToMove
    }
    getWantsToMove(sprite: GameSprite) {
        const wantsToMove = this._spriteAndWantsToMoves.get(sprite)
        if (wantsToMove) {
            return RULE_DIRECTION_ABSOLUTE[wantsToMove]
        } else {
            return null
        }
    }
    directionForSprite(sprite: GameSprite) {
        const entry = [...this._spriteAndWantsToMoves].filter(([a]) => a.getCollisionLayerNum() === sprite.getCollisionLayerNum())[0]
        if (entry) {
            return entry[1]
        }
        return null
    }
    hasCollisionWithSprite(otherSprite: GameSprite) {
        let hasCollision = false
        this._spriteAndWantsToMoves.forEach((wantsToMove, sprite) => {
            if (sprite.getCollisionLayerNum() === otherSprite.getCollisionLayerNum()) {
                hasCollision = true
            }
        })
        return hasCollision
    }
    clearWantsToMove(sprite: GameSprite) {
        this._spriteAndWantsToMoves.set(sprite, RULE_DIRECTION_ABSOLUTE.STATIONARY)
        sprite.updateCell(this, RULE_DIRECTION_ABSOLUTE.STATIONARY)
    }
    addSprite(sprite: GameSprite, wantsToMove?: RULE_DIRECTION_ABSOLUTE) {

        if (wantsToMove) {
            this._spriteAndWantsToMoves.set(sprite, wantsToMove)
        } else if (!this._spriteAndWantsToMoves.has(sprite)) {
            wantsToMove = RULE_DIRECTION_ABSOLUTE.STATIONARY
            this._spriteAndWantsToMoves.set(sprite, wantsToMove)
        }
        sprite.addCell(this, wantsToMove)
    }
    removeSprite(sprite: GameSprite) {
        this._spriteAndWantsToMoves.delete(sprite)
        sprite.removeCell(this)
    }
    removeSprites(sprites: Iterable<GameSprite>) {
        for (const sprite of sprites) {
            this.removeSprite(sprite)
        }
    }
    setWantsToMove(tile: IGameTile, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        for (const sprite of tile.getSprites()) {
            if (this._spriteAndWantsToMoves.has(sprite)) {
                this.addSprite(sprite, wantsToMove)
            }
        }
    }
    toString() {
        return `Cell [${this.rowIndex}][${this.colIndex}] ${[...this.getSpriteAndWantsToMoves().entries()].map(([sprite, wantsToMove]) => `${wantsToMove} ${sprite.getName()}`).join(' ')}`
    }
}

export default class Engine extends EventEmitter2 {
    gameData: GameData
    currentLevel: Cell[][]
    _pendingPlayerWantsToMove: RULE_DIRECTION_ABSOLUTE
    _hasAgainThatNeedsToRun: boolean

    constructor(gameData: GameData) {
        super()
        this.gameData = gameData
        this._hasAgainThatNeedsToRun = false
    }

    setLevel(levelNum: number) {
        this.gameData.clearCaches()

        const level = this.gameData.levels[levelNum]
        if (!level) {
            throw new Error(`Invalid levelNum: ${levelNum}`)
        }
        if (process.env['NODE_ENV'] !== 'production') {
            level.__coverageCount++
        }
        // Clone the board because we will be modifying it
        this.currentLevel = level.getRows().map((row, rowIndex) => {
            return row.map((col, colIndex) => new Cell(this, new Set(col.getSprites()), rowIndex, colIndex))
        })

        // link up all the cells. Loop over all the sprites
        // in case they are NO tiles (so the cell is included)
        const batchCells: Map<string, Cell[]> = new Map()
        function spriteSetToKey(sprites: Set<GameSprite>) {
            const key = []
            for (const spriteName of [...sprites].map(sprite => sprite._name).sort()) {
                key.push(spriteName)
            }
            return key.join(' ')
        }
        const allCells = this.getCells()
        for (const cell of allCells) {
            const key = spriteSetToKey(cell.getSpritesAsSet())
            if (!batchCells.has(key)) {
                batchCells.set(key, [])
            }
            batchCells.get(key).push(cell)
        }

        // Print progress while loading up the Cells
        let i = 0
        for (const [key, cells] of batchCells) {
            if ((batchCells.size > 100 && i % 10 === 0) || cells.length > 100) {
                console.log(`Loading cells ${i}-${i + cells.length} of ${allCells.length}. SpriteKey="${key}"`)
            }
            // All Cells contain the same set of sprites so just pull out the 1st one
            for (const sprite of this.gameData.objects) {
                const cellSprites = cells[0].getSpritesAsSet()
                const hasSprite = cellSprites.has(sprite)
                if (hasSprite || sprite.hasNegationTile()) {
                    if (hasSprite) {
                        sprite.addCells(cells, RULE_DIRECTION_ABSOLUTE.STATIONARY)
                    } else {
                        sprite.removeCells(cells)
                    }
                }
            }
            i += cells.length
        }

        // Return the cells so the UI can listen to when they change
        return this.getCells()
    }

    getCells() {
        return _.flatten(this.currentLevel)
    }

    toSnapshot() {
        return this.currentLevel.map(row => {
            return row.map(cell => {
                const ret = []
                cell.getSpriteAndWantsToMoves().forEach((wantsToMove, sprite) => {
                    ret.push(`${wantsToMove} ${sprite._name}`)
                })
                return ret
            })
        })
    }

    tickUpdateCells() {
        return this._tickUpdateCells(this.gameData.rules.filter(r => !r.isLate()))
    }

    tickUpdateCellsLate() {
        return this._tickUpdateCells(this.gameData.rules.filter(r => r.isLate()))
    }

    _tickUpdateCells(rules: Iterable<IRule>) {
        const changedMutations: Set<IMutation> = new Set()
        const evaluatedRules: IRule[] = []
        let ruleIndex = 0
        for (const rule of rules) {
            const cellMutations = rule.evaluate()
            if (cellMutations.length > 0) {
                evaluatedRules.push(rule)
            }
            for (const mutation of cellMutations) {
                changedMutations.add(mutation)
            }
            ruleIndex++ // Just for debugging
        }

        // We may have mutated the same cell 4 times (e.g. [Player]->[>Player]) so consolidate
        const changedCells = new Set<Cell>()
        const commands = new Set<AbstractCommand>()
        for (const mutation of changedMutations) {
            if (mutation.hasCell()) {
                changedCells.add(mutation.getCell())
            } else {
                commands.add(mutation.getCommand())
            }
            // if (!changedCells.has(mutation.cell)) {
            //     changedCells.set(mutation.cell, mutation.didSpritesChange)
            // }
        }
        return {evaluatedRules: evaluatedRules, changedCells: changedCells, commands: commands}
    }

    tickMoveSprites(changedCells: Set<Cell>) {
        let movedCells: Set<Cell> = new Set()
        // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
        let somethingChanged
        do {
            somethingChanged = false
            for (const cell of changedCells) {
                for (let [sprite, wantsToMove] of cell.getSpriteAndWantsToMoves()) {

                    if (wantsToMove !== RULE_DIRECTION_ABSOLUTE.STATIONARY) {
                        if (wantsToMove === RULE_DIRECTION.ACTION) {
                            // just clear the wantsToMove flag
                            somethingChanged = true
                            cell.clearWantsToMove(sprite)
                        } else if (wantsToMove === RULE_DIRECTION.STATIONARY) {
                            somethingChanged = true
                            cell.clearWantsToMove(sprite)
                        } else {
                            if (wantsToMove === RULE_DIRECTION.RANDOMDIR) {
                                const rand = nextRandom(4)
                                switch (rand) {
                                    case 0:
                                        wantsToMove = RULE_DIRECTION.UP
                                        break
                                    case 1:
                                        wantsToMove = RULE_DIRECTION.DOWN
                                        break
                                    case 2:
                                        wantsToMove = RULE_DIRECTION.LEFT
                                        break
                                    case 3:
                                        wantsToMove = RULE_DIRECTION.RIGHT
                                        break
                                    default:
                                        throw new Error(`BUG: Random number generator yielded something other than 0-3. "${rand}"`)
                                }
                            }
                            if (wantsToMove === RULE_DIRECTION.RANDOM) {
                                throw new Error('BUG: should have converted RANDOM to something else earlier')
                            }
                            const neighbor = cell.getNeighbor(wantsToMove)
                            // Make sure
                            if (neighbor && !neighbor.hasCollisionWithSprite(sprite)) {
                                cell.removeSprite(sprite)
                                neighbor.addSprite(sprite, RULE_DIRECTION_ABSOLUTE.STATIONARY)
                                movedCells.add(neighbor)
                                movedCells.add(cell)
                                somethingChanged = true
                                // Don't delete until we are sure none of the sprites want to move
                                // changedCells.delete(cell)
                            } else {
                                // Clear the wantsToMove flag LATER if we hit a wall (a sprite in the same collisionLayer) or are at the end of the map
                                // We do this later because we are looping as long as something changed
                                // cell.clearWantsToMove(sprite)
                            }
                        }
                    }
                }
            }
        } while (somethingChanged)

        // Clear the wantsToMove from all remaining cells
        for (const cell of changedCells) {
            for (const [sprite, wantsToMove] of cell.getSpriteAndWantsToMoves()) {
                cell.clearWantsToMove(sprite)
            }
        }
        return movedCells
    }

    tickNormal() {
        let changedCellMutations = new Set()
        if (this._pendingPlayerWantsToMove) {
            const t = this.gameData.getPlayer()
            for (const cell of t.getCellsThatMatch()) {
                for (const sprite of t.getSpritesThatMatch(cell)) {
                    cell.addSprite(sprite, this._pendingPlayerWantsToMove)
                    changedCellMutations.add(cell)
                }
            }
            this._pendingPlayerWantsToMove = null
        }

        const {changedCells: changedCellMutations2, evaluatedRules, commands} = this.tickUpdateCells()
        changedCellMutations = setAddAll(changedCellMutations, changedCellMutations2)

        // Save the "AGAIN" rules that ran so they can be re-evaluated at the next tick
        this._hasAgainThatNeedsToRun = !!evaluatedRules.filter(r => r.isAgain())[0]
        const movedCells = this.tickMoveSprites(new Set<Cell>(changedCellMutations.keys()))
        const {changedCells: changedCellsLate, evaluatedRules: evaluatedRulesLate, commands: commandsLate} = this.tickUpdateCellsLate()
        return {
            changedCells: setAddAll(setAddAll(changedCellMutations, changedCellsLate), movedCells),
            evaluatedRules: evaluatedRules.concat(evaluatedRulesLate),
            commands: commands
        }
    }

    tick() {
        let ret : { changedCells: Set<Cell>, evaluatedRules: IRule[] , commands: Set<AbstractCommand>}
        if (this._hasAgainThatNeedsToRun) {
            // run the AGAIN rules
            this._hasAgainThatNeedsToRun = false // let the .tick() make it true
            ret = this.tickNormal()
        } else {
            ret = this.tickNormal()
        }
        // TODO: Handle the commands like RESTART, CANCEL, WIN at this point
        let soundToPlay: GameSound = null
        let hasWinCommand = false
        for (const command of ret.commands) {
            switch (command.getType()) {
                case COMMAND_TYPE.SFX:
                    soundToPlay = command.getSound()
                    break
                case COMMAND_TYPE.WIN:
                    hasWinCommand = true
                    break
                default:
                    // console.error(`BUG: Unsupported command "${command.getType()}"`)
            }
        }
        return {
            changedCells: new Set(ret.changedCells.keys()),
            soundToPlay,
            isWinning: hasWinCommand || this.isWinning()
        }
    }

    hasAgain() {
        return this._hasAgainThatNeedsToRun
    }

    isWinning() {
        let conditionsSatisfied = this.gameData.winConditions.length > 0 // true
        this.gameData.winConditions.forEach(winCondition => {
            if (!winCondition.isSatisfied(this.getCells())) {
                conditionsSatisfied = false
            }
        })
        return conditionsSatisfied
    }

    press(direction: RULE_DIRECTION_ABSOLUTE) {
        this._pendingPlayerWantsToMove = direction
    }
    pressUp() {
        this.press(RULE_DIRECTION_ABSOLUTE.UP)
    }
    pressDown() {
        this.press(RULE_DIRECTION_ABSOLUTE.DOWN)
    }
    pressLeft() {
        this.press(RULE_DIRECTION_ABSOLUTE.LEFT)
    }
    pressRight() {
        this.press(RULE_DIRECTION_ABSOLUTE.RIGHT)
    }
    pressAction() {
        this.press(RULE_DIRECTION_ABSOLUTE.ACTION)
    }

    pressRestart(levelNum) {
        this.setLevel(levelNum)
    }
    pressUndo() { }
}
