import { EventEmitter2, Listener } from 'eventemitter2'
import { logger } from './logger'
import { CollisionLayer } from './models/collisionLayer'
import { GameData } from './models/game'
import { IMutation, SimpleRuleGroup } from './models/rule'
import { GameSprite, IGameTile } from './models/tile'
import { Command, COMMAND_TYPE, SoundItem } from './parser/astTypes'
import { SpriteBitSet } from './spriteBitSet'
import { _flatten, Optional, resetRandomSeed, RULE_DIRECTION, setAddAll, setDifference, setEquals } from './util'

interface ICollisionLayerState {
    readonly wantsToMove: Optional<RULE_DIRECTION>
    readonly sprite: GameSprite
}

interface ITickResult {
    changedCells: Set<Cell>,
    soundToPlay: Optional<SoundItem<IGameTile>>,
    messageToShow: Optional<string>,
    didWinGame: boolean,
    didLevelChange: boolean,
    wasAgainTick: boolean
}

type Snapshot = Array<Array<Set<GameSprite>>>

/**
 * The state of sprites in one position of the current level being played.
 *
 * This stores all the sprites and which direction those sprites want to move.
 *
 * The [[TerminalUI]] uses this object to render and the [[GameEngine]] uses this to maintain the state
 * of one position of the current level.
 */
export class Cell {
    public readonly rowIndex: number
    public readonly colIndex: number
    public readonly spriteBitSet: SpriteBitSet
    private readonly level: Optional<Level>
    private readonly state: Map<CollisionLayer, ICollisionLayerState>
    private cacheCollisionLayers: CollisionLayer[]
    private cachedKeyValue: Optional<string>

    constructor(level: Optional<Level>, sprites: Set<GameSprite>, rowIndex: number, colIndex: number) {
        this.level = level
        this.rowIndex = rowIndex
        this.colIndex = colIndex
        this.state = new Map()
        this.cacheCollisionLayers = []
        this.spriteBitSet = new SpriteBitSet(sprites)
        this.cachedKeyValue = null

        for (const sprite of sprites) {
            this._setWantsToMove(sprite, RULE_DIRECTION.STATIONARY)
        }
    }
    public _setWantsToMove(sprite: GameSprite, wantsToMove: Optional<RULE_DIRECTION>) {
        const collisionLayer = sprite.getCollisionLayer()
        const { wantsToMove: cellWantsToMove, sprite: cellSprite } = this.getStateForCollisionLayer(collisionLayer)
        const didActuallyChangeDir = cellWantsToMove !== wantsToMove
        const didActuallyChangeSprite = cellSprite !== sprite
        // replace the sprite in the bitSet
        if (cellSprite !== sprite) {
            if (cellSprite) {
                throw new Error(`BUG: Should have already been removed?`)
                // this.spriteBitSet.remove(cellSprite)
            }
            this.spriteBitSet.add(sprite)
        }

        this._setState(collisionLayer, sprite, wantsToMove)
        // call replaceSprite only **after** we updated the Cell
        if (cellSprite !== sprite) {
            this.replaceSpriteInLevel(cellSprite, sprite)
        }
        return didActuallyChangeSprite || didActuallyChangeDir
    }
    public _deleteWantsToMove(sprite: GameSprite) {
        // There may be other sprites in the same ... oh wait, no that's not possible.
        const collisionLayer = sprite.getCollisionLayer()
        const cellSprite = this.getSpriteByCollisionLayer(collisionLayer)
        const didActuallyChange = !!cellSprite

        if (cellSprite) {
            this.spriteBitSet.remove(cellSprite)
        }

        this._setState(collisionLayer, null, null) // delete the entry

        return didActuallyChange
    }
    public setWantsToMoveCollisionLayer(collisionLayer: CollisionLayer, wantsToMove: RULE_DIRECTION) {
        // Check that there is a sprite for this collision layer
        const { sprite, wantsToMove: cellWantsToMove } = this.getStateForCollisionLayer(collisionLayer)
        if (!sprite) {
            throw new Error(`BUG: No sprite for collision layer. Cannot set direction.\n${collisionLayer.toString()}`)
        }
        const didActuallyChange = cellWantsToMove !== wantsToMove

        this._setState(collisionLayer, sprite, wantsToMove)

        sprite.updateCell(this, wantsToMove)
        return didActuallyChange
    }
    public getSpriteByCollisionLayer(collisionLayer: CollisionLayer) {
        const { sprite } = this.getStateForCollisionLayer(collisionLayer)
        return sprite || null
    }
    public getCollisionLayers() {
        // return [...this._state.keys()]
        //     .sort((c1, c2) => c1.id - c2.id)
        return this.cacheCollisionLayers
    }
    public getSprites() {
        // Just pull out the sprite, not the wantsToMoveDir
        const sprites: GameSprite[] = []
        const collisionLayers = this.getCollisionLayers()
        for (const collisionLayer of collisionLayers) {
            const sprite = this.getSpriteByCollisionLayer(collisionLayer)
            if (sprite) {
                sprites.push(sprite)
            }
        }
        return sprites.reverse() // reversed so we render sprites properly
    }
    public getSpritesAsSet() {
        // Just pull out the sprite, not the wantsToMoveDir
        const sprites = new Set<GameSprite>()
        for (const { sprite } of this.state.values()) {
            sprites.add(sprite)
        }
        return sprites
    }
    public getSpriteAndWantsToMoves() {
        // Just pull out the sprite, not the wantsToMoveDir
        // Retur na new set so we can mutate it later
        const map = new Map()
        for (const collisionLayer of this.getCollisionLayers()) {
            const { sprite, wantsToMove } = this.getStateForCollisionLayer(collisionLayer)
            map.set(sprite, wantsToMove)
        }
        return map
    }
    public getCollisionLayerWantsToMove(collisionLayer: CollisionLayer) {
        const { wantsToMove } = this.getStateForCollisionLayer(collisionLayer)
        return wantsToMove || null
    }
    public hasSprite(sprite: GameSprite) {
        const cellSprite = this.getSpriteByCollisionLayer(sprite.getCollisionLayer())
        return sprite === cellSprite
    }
    public getNeighbor(direction: string) {
        switch (direction) {
            case RULE_DIRECTION.UP:
                return this.getRelativeNeighbor(-1, 0)
            case RULE_DIRECTION.DOWN:
                return this.getRelativeNeighbor(1, 0)
            case RULE_DIRECTION.LEFT:
                return this.getRelativeNeighbor(0, -1)
            case RULE_DIRECTION.RIGHT:
                return this.getRelativeNeighbor(0, 1)
            default:
                throw new Error(`BUG: Unsupported direction "${direction}"`)
        }
    }
    public getWantsToMove(sprite: GameSprite) {
        return this.getCollisionLayerWantsToMove(sprite.getCollisionLayer())
    }
    public hasCollisionWithSprite(otherSprite: GameSprite) {
        return !!this.getCollisionLayerWantsToMove(otherSprite.getCollisionLayer())
    }
    public clearWantsToMove(sprite: GameSprite) {
        this._setWantsToMove(sprite, RULE_DIRECTION.STATIONARY)
        sprite.updateCell(this, RULE_DIRECTION.STATIONARY)
    }
    public addSprite(sprite: GameSprite, wantsToMove: Optional<RULE_DIRECTION>) {
        let didActuallyChange = false
        // If we already have a sprite in that collision layer then we need to remove it
        const prevSprite = this.getSpriteByCollisionLayer(sprite.getCollisionLayer())
        const prevWantsToMove = this.getCollisionLayerWantsToMove(sprite.getCollisionLayer())
        if (prevSprite && prevSprite !== sprite) {
            this.removeSprite(prevSprite)
        }
        if (wantsToMove) {
            didActuallyChange = this._setWantsToMove(sprite, wantsToMove)
        } else if (!this.hasSprite(sprite)) {
            wantsToMove = prevWantsToMove || RULE_DIRECTION.STATIONARY // try to preserve the wantsToMove
            didActuallyChange = this._setWantsToMove(sprite, wantsToMove)
        }
        sprite.addCell(this, wantsToMove)
        return didActuallyChange
    }
    public updateSprite(sprite: GameSprite, wantsToMove: RULE_DIRECTION) {
        // Copy/pasta from addSprite except it calls updateCell
        let didActuallyChange = false
        // If we already have a sprite in that collision layer then we need to remove it
        const prevSprite = this.getSpriteByCollisionLayer(sprite.getCollisionLayer())
        if (prevSprite !== sprite) {
            throw new Error(`BUG: Should not be trying to update the direction of a sprite that is not in the cell`)
        }
        if (wantsToMove) {
            didActuallyChange = this._setWantsToMove(sprite, wantsToMove)
        } else if (!this.hasSprite(sprite)) {
            throw new Error(`BUG: sprite should already be in the cell since we are updating it`)
        }
        sprite.updateCell(this, wantsToMove)
        return didActuallyChange
    }
    public removeSprite(sprite: GameSprite) {
        const didActuallyChange = this._deleteWantsToMove(sprite)
        sprite.removeCell(this)
        return didActuallyChange
    }
    public toString() {
        return `Cell [${this.rowIndex}][${this.colIndex}] ${[...this.getSpriteAndWantsToMoves().entries()].map(([sprite, wantsToMove]) => `${wantsToMove} ${sprite.getName()}`).join(' ')}`
    }
    public toKey() {
        if (!this.cachedKeyValue) {
            this.cachedKeyValue = [...this.state.values()].map(({ sprite, wantsToMove }) => `${wantsToMove} ${sprite.getName()}`).join(' ')
            // this.cachedKeyValue = [...this.getSpriteAndWantsToMoves().entries()].map(([sprite, wantsToMove]) => `${wantsToMove} ${sprite.getName()}`).join(' ')
        }
        return this.cachedKeyValue
    }
    public toSnapshot() {
        return this.getSpritesAsSet()
    }
    public fromSnapshot(newSprites: Set<GameSprite>) {
        const currentSprites = this.getSpritesAsSet()
        const spritesToRemove = setDifference(currentSprites, newSprites)
        const spritesToAdd = setDifference(newSprites, currentSprites)
        // Remove Sprites
        this.removeSprites(spritesToRemove)
        // Add Sprites
        this.addSprites(spritesToAdd)
    }
    // This method is replaced by LetterCells (because they are not boud to a level)
    protected replaceSpriteInLevel(cellSprite: Optional<GameSprite>, newSprite: GameSprite) {
        this.getLevel().replaceSprite(this, cellSprite, newSprite)
    }
    private _setState(collisionLayer: CollisionLayer, sprite: Optional<GameSprite>, wantsToMove: Optional<RULE_DIRECTION>) {
        let needsToUpdateCache
        if (sprite) {
            needsToUpdateCache = this.cacheCollisionLayers.indexOf(collisionLayer) < 0
            this.state.set(collisionLayer, { wantsToMove, sprite })
        } else {
            this.state.delete(collisionLayer)
            needsToUpdateCache = true
        }

        if (needsToUpdateCache) {
            // Update the collisionLayer Cache
            this.cacheCollisionLayers = [...this.state.keys()]
            .sort((c1, c2) => c1.id - c2.id)
        }
        this.invalidateKey()
    }
    private getLevel() {
        if (!this.level) {
            throw new Error(`BUG: we need an engine Level in order to find neighbors. It is optional for letters in messages`)
        }
        return this.level
    }
    private getStateForCollisionLayer(collisionLayer: CollisionLayer) {
        const state = this.state.get(collisionLayer)
        if (!state) {
            return { wantsToMove: null, sprite: null }
        }
        return state
    }

    private getRelativeNeighbor(y: number, x: number) {
        return this.getLevel().getCellOrNull(this.rowIndex + y, this.colIndex + x)
    }
    private removeSprites(sprites: Iterable<GameSprite>) {
        for (const sprite of sprites) {
            this.removeSprite(sprite)
        }
    }
    private addSprites(sprites: Iterable<GameSprite>) {
        for (const sprite of sprites) {
            this.addSprite(sprite, null)
        }
    }
    private invalidateKey() {
        this.cachedKeyValue = null
    }
}

export class Level {
    private cells: Optional<Cell[][]>
    private rowCache: Array<Optional<SpriteBitSet>>
    private colCache: Array<Optional<SpriteBitSet>>
    constructor() {
        this.rowCache = []
        this.colCache = []
    }
    public setCells(cells: Cell[][]) {
        this.cells = cells
    }
    public getCells() {
        if (!this.cells) {
            throw new Error(`BUG: Should have called setCells() first`)
        }
        return this.cells
    }
    public getCellOrNull(rowIndex: number, colIndex: number) {
        const row = this.getCells()[rowIndex]
        if (row) {
            return row[colIndex]
        }
        return null
    }
    public getCell(rowIndex: number, colIndex: number) {
        // Skip error checks for performance
        return this.getCells()[rowIndex][colIndex]
    }
    public replaceSprite(cell: Cell, oldSprite: Optional<GameSprite>, newSprite: Optional<GameSprite>) {
        // When a new Cell is instantiated it will call this method but `this.cells` is not defined yet
        if (this.cells) {
            // Invalidate the row/column cache. It will be rebuilt when requested
            this.rowCache[cell.rowIndex] = null
            this.colCache[cell.colIndex] = null
        }
    }
    public rowContainsSprites(rowIndex: number, spritesPresent: SpriteBitSet, anySpritesPresent: SpriteBitSet) {
        let cache = this.rowCache[rowIndex]
        if (!cache) {
            cache = this.computeRowCache(rowIndex)
            this.rowCache[rowIndex] = cache
        }
        return cache.containsAll(spritesPresent) && anySpritesPresent.isEmpty() ? true : cache.containsAny(anySpritesPresent)
    }
    public colContainsSprites(colIndex: number, sprites: SpriteBitSet, anySpritesPresent: SpriteBitSet) {
        let cache = this.colCache[colIndex]
        if (!cache) {
            cache = this.computeColCache(colIndex)
            this.colCache[colIndex] = cache
        }
        return cache.containsAll(sprites) && anySpritesPresent.isEmpty() ? true : cache.containsAny(anySpritesPresent)
    }
    private computeRowCache(rowIndex: number) {
        const cols = this.getCells()[0].length
        const bitSets = []
        for (let index = 0; index < cols; index++) {
            bitSets.push(this.getCell(rowIndex, index).spriteBitSet)
        }
        return (new SpriteBitSet()).union(bitSets)
    }
    private computeColCache(colIndex: number) {
        const rows = this.getCells().length
        const bitSets = []
        for (let index = 0; index < rows; index++) {
            bitSets.push(this.getCell(index, colIndex).spriteBitSet)
        }
        return (new SpriteBitSet()).union(bitSets)
    }
}

/**
 * Internal class that ise used to maintain the state of a level.
 *
 * This should not be called directly. Instead, use [[GameEngine]] .
 */
export class LevelEngine extends EventEmitter2 {
    public readonly gameData: GameData
    public pendingPlayerWantsToMove: Optional<RULE_DIRECTION>
    public hasAgainThatNeedsToRun: boolean
    private currentLevel: Optional<Level>
    private tempOldLevel: Optional<Level>
    private undoStack: Snapshot[]

    constructor(gameData: GameData) {
        super()
        this.gameData = gameData
        this.hasAgainThatNeedsToRun = false
        this.undoStack = []
    }

    public setLevel(levelNum: number) {
        this.undoStack = []
        this.gameData.clearCaches()

        const levelData = this.gameData.levels[levelNum]
        if (!levelData) {
            throw new Error(`Invalid levelNum: ${levelNum}`)
        }
        if (process.env.NODE_ENV === 'development') {
            levelData.__incrementCoverage()
        }
        resetRandomSeed()

        const levelSprites = levelData.getRows().map((row) => {
            return row.map((col) => {
                const sprites = new Set(col.getSprites())
                const backgroundSprite = this.gameData.getMagicBackgroundSprite()
                if (backgroundSprite) {
                    sprites.add(backgroundSprite)
                }
                return sprites
            })
        })

        // Clone the board because we will be modifying it
        this._setLevel(levelSprites)

        this.takeSnapshot(this.createSnapshot())

        // Return the cells so the UI can listen to when they change
        return this.getCells()
    }

    public setMessageLevel(sprites: Array<Array<Set<GameSprite>>>) {
        this.tempOldLevel = this.currentLevel
        this._setLevel(sprites)
    }

    public restoreFromMessageLevel() {
        this.currentLevel = this.tempOldLevel
        this.tempOldLevel = null
        // this.setLevel(this.tempOldLevel)
    }

    public getCurrentLevel() {
        if (this.currentLevel) {
            return this.currentLevel
        } else {
            throw new Error(`BUG: There is no current level. Maybe it is a message level or maybe setLevel was never called`)
        }
    }

    public toSnapshot() {
        return this.getCurrentLevel().getCells().map((row) => {
            return row.map((cell) => {
                const ret: string[] = []
                cell.getSpriteAndWantsToMoves().forEach((wantsToMove, sprite) => {
                    ret.push(`${wantsToMove} ${sprite.getName()}`)
                })
                return ret
            })
        })
    }

    public tick() {
        logger.debug(() => ``)

        if (this.hasAgainThatNeedsToRun) {
            // run the AGAIN rules
            this.hasAgainThatNeedsToRun = false // let the .tick() make it true
        }
        const ret = this.tickNormal()
        // TODO: Handle the commands like RESTART, CANCEL, WIN at this point
        let soundToPlay: Optional<SoundItem<IGameTile>> = null
        let messageToShow: Optional<string> = null
        let hasWinCommand = false
        let hasRestart = false
        for (const command of ret.commands) {
            switch (command.type) {
                case COMMAND_TYPE.RESTART:
                    hasRestart = true
                    break
                case COMMAND_TYPE.SFX:
                    soundToPlay = command.sound
                    break
                case COMMAND_TYPE.MESSAGE:
                    this.hasAgainThatNeedsToRun = false // make sure we won't be waiting on another tick
                    messageToShow = command.message
                    break
                case COMMAND_TYPE.WIN:
                    hasWinCommand = true
                    break
                case COMMAND_TYPE.AGAIN:
                case COMMAND_TYPE.CANCEL:
                case COMMAND_TYPE.CHECKPOINT:
                    break
                default:
                    throw new Error(`BUG: Unsupported command "${command}"`)
            }
        }
        logger.debug(() => `checking win condition.`)
        if (this.hasAgainThatNeedsToRun) {
            logger.debug(() => `AGAIN command executed, with changes detected - will execute another turn.`)
        }

        return {
            changedCells: new Set(ret.changedCells.keys()),
            soundToPlay,
            messageToShow,
            hasRestart,
            isWinning: hasWinCommand || this.isWinning()
        }
    }

    public hasAgain() {
        return this.hasAgainThatNeedsToRun
    }

    public canUndo() {
        return this.undoStack.length > 1
    }

    public press(direction: RULE_DIRECTION) {
        // Should disable keypresses if `AGAIN` is running.
        // It is commented because the didSpritesChange logic is not correct.
        // a rule might add a sprite, and then another rule might remove a sprite.
        // We need to compare the set of sprites before and after ALL rules ran.
        // This will likely be implemented as part of UNDO or CHECKPOINT.
        // if (!this.hasAgain()) {
        this.pendingPlayerWantsToMove = direction
        // }
    }
    public pressRestart() {
        // Add the initial checkpoint to the top (rather than clearing the stack)
        // so the player can still "UNDO" after pressing "RESTART"
        const snapshot = this.undoStack[0]
        this.undoStack.push(snapshot)
        this.applySnapshot(snapshot)
    }
    public pressUndo() {
        const snapshot = this.undoStack.pop()
        if (snapshot && this.undoStack.length > 0) { // the 0th entry is the initial load of the level
            this.applySnapshot(snapshot)
        } else if (snapshot) {
            // oops, put the snapshot back on the stack
            this.undoStack.push(snapshot)
        }
    }

    private _setLevel(levelSprites: Array<Array<Set<GameSprite>>>) {
        const level = new Level()
        this.currentLevel = level
        const spriteCells = levelSprites.map((row, rowIndex) => {
            return row.map((sprites, colIndex) => {
                const backgroundSprite = this.gameData.getMagicBackgroundSprite()
                if (backgroundSprite) {
                    sprites.add(backgroundSprite)
                }
                return new Cell(level, sprites, rowIndex, colIndex)
            })
        })
        level.setCells(spriteCells)
        // link up all the cells. Loop over all the sprites
        // in case they are NO tiles (so the cell is included)
        const batchCells: Map<string, Cell[]> = new Map()
        function spriteSetToKey(sprites: Set<GameSprite>) {
            const key = []
            for (const spriteName of [...sprites].map((sprite) => sprite.getName()).sort()) {
                key.push(spriteName)
            }
            return key.join(' ')
        }
        const allCells = this.getCells()
        // But first, fill up any empty condition brackets with ALL THE CELLS
        for (const rule of this.gameData.rules) {
            rule.addCellsToEmptyRules(allCells)
        }
        for (const cell of allCells) {
            const key = spriteSetToKey(cell.getSpritesAsSet())
            let batch = batchCells.get(key)
            if (!batch) {
                batch = []
                batchCells.set(key, batch)
            }
            batch.push(cell)
        }
        // Print progress while loading up the Cells
        let i = 0
        for (const [key, cells] of batchCells) {
            if ((batchCells.size > 100 && i % 10 === 0) || cells.length > 100) {
                this.emit('loading-cells', {
                    cellStart: i,
                    cellEnd: i + cells.length,
                    cellTotal: allCells.length,
                    key
                })
            }
            // All Cells contain the same set of sprites so just pull out the 1st one
            for (const sprite of this.gameData.objects) {
                const cellSprites = cells[0].getSpritesAsSet()
                const hasSprite = cellSprites.has(sprite)
                if (hasSprite || sprite.hasNegationTileWithModifier()) {
                    if (hasSprite) {
                        sprite.addCells(sprite, cells, RULE_DIRECTION.STATIONARY)
                    } else {
                        sprite.removeCells(sprite, cells)
                    }
                }
            }
            i += cells.length
        }
        return level
    }

    private getCells() {
        return _flatten(this.getCurrentLevel().getCells())
    }

    private tickUpdateCells() {
        logger.debug(() => `applying rules`)
        return this._tickUpdateCells(this.gameData.rules.filter((r) => !r.isLate()))
    }

    private tickUpdateCellsLate() {
        logger.debug(() => `applying late rules`)
        return this._tickUpdateCells(this.gameData.rules.filter((r) => r.isLate()))
    }

    private _tickUpdateCells(rules: Iterable<SimpleRuleGroup>) {
        const changedMutations: Set<IMutation> = new Set()
        const evaluatedRules: SimpleRuleGroup[] = []
        if (!this.currentLevel) {
            throw new Error(`BUG: Level Cells do not exist yet`)
        }
        for (const rule of rules) {
            const cellMutations = rule.evaluate(this.currentLevel, false/*evaluate all rules*/)
            if (cellMutations.length > 0) {
                evaluatedRules.push(rule)
            }
            for (const mutation of cellMutations) {
                changedMutations.add(mutation)
            }
            // if (logger.isLevel(LOG_LEVEL.DEBUG)) {
            //     if (rule.timesRan && rule.totalTimeMs) {
            //         const avg = rule.totalTimeMs // Math.round(rule.totalTimeMs / rule.timesRan)
            //         if (avg > 100) {
            //             logger.debug(`Took:${avg}ms (${cellMutations.length} changed) ${rule.toString()}`)
            //         }
            //     }
            //     // if (cellMutations.length > 0) {
            //     //     logger.debug(`Took:${rule.totalTimeMs}ms (${cellMutations.length} changed) ${rule.toString()}`)
            //     // }
            // }
        }

        // We may have mutated the same cell 4 times (e.g. [Player]->[>Player]) so consolidate
        const changedCells = new Set<Cell>()
        const commands: Set<Command<SoundItem<IGameTile>>> = new Set()
        // let didSomeSpriteChange = false
        for (const mutation of changedMutations) {
            // if (mutation.getDidSpritesChange()) {
            //     didSomeSpriteChange = true
            // }
            if (mutation.hasCell()) {
                changedCells.add(mutation.getCell())
            } else {
                commands.add(mutation.getCommand())
            }
            // if (!changedCells.has(mutation.cell)) {
            //     changedCells.set(mutation.cell, mutation.didSpritesChange)
            // }
        }
        return { evaluatedRules, changedCells, commands/*, didSomeSpriteChange: didSomeSpriteChange*/ }
    }

    private tickMoveSprites(changedCells: Set<Cell>) {
        const movedCells: Set<Cell> = new Set()
        // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
        let somethingChanged
        do {
            somethingChanged = false
            for (const cell of changedCells) {
                for (const [sprite, wantsToMove] of cell.getSpriteAndWantsToMoves()) {

                    switch (wantsToMove) {
                        case RULE_DIRECTION.STATIONARY:
                            // nothing to do
                            break
                        case RULE_DIRECTION.ACTION:
                            // just clear the wantsToMove flag
                            somethingChanged = true
                            cell.clearWantsToMove(sprite)
                            break
                        case RULE_DIRECTION.UP:
                        case RULE_DIRECTION.DOWN:
                        case RULE_DIRECTION.LEFT:
                        case RULE_DIRECTION.RIGHT:
                            const neighbor = cell.getNeighbor(wantsToMove)
                            // Make sure
                            if (neighbor && !neighbor.hasCollisionWithSprite(sprite)) {
                                cell.removeSprite(sprite)
                                neighbor.addSprite(sprite, RULE_DIRECTION.STATIONARY)
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
                            break
                        default:
                            throw new Error(`BUG: wantsToMove should have been handled earlier: ${wantsToMove}`)
                    }
                }
            }
        } while (somethingChanged)

        // Clear the wantsToMove from all remaining cells
        for (const cell of changedCells) {
            for (const [sprite] of cell.getSpriteAndWantsToMoves()) {
                cell.clearWantsToMove(sprite)
            }
        }
        return movedCells
    }

    private tickNormal() {
        let changedCellMutations = new Set<Cell>()
        const initialSnapshot = this.createSnapshot()
        if (this.pendingPlayerWantsToMove) {
            this.takeSnapshot(initialSnapshot)

            logger.debug(`=======================\nTurn starts with input of ${this.pendingPlayerWantsToMove.toLowerCase()}.`)

            const t = this.gameData.getPlayer()
            for (const cell of t.getCellsThatMatch()) {
                for (const sprite of t.getSpritesThatMatch(cell)) {
                    cell.updateSprite(sprite, this.pendingPlayerWantsToMove)
                    changedCellMutations.add(cell)
                }
            }
            this.pendingPlayerWantsToMove = null
        } else {
            logger.debug(() => `Turn starts with no input.`)
        }

        const { changedCells: changedCellMutations2, evaluatedRules, commands } = this.tickUpdateCells()
        changedCellMutations = setAddAll(changedCellMutations, changedCellMutations2)

        // Continue evaluating again rules only when some sprites have changed
        // The didSpritesChange logic is not correct.
        // a rule might add a sprite, and then another rule might remove a sprite.
        // We need to compare the set of sprites before and after ALL rules ran.
        // This will likely be implemented as part of UNDO or CHECKPOINT.
        const movedCells = this.tickMoveSprites(new Set<Cell>(changedCellMutations.keys()))
        const { changedCells: changedCellsLate, evaluatedRules: evaluatedRulesLate, commands: commandsLate } = this.tickUpdateCellsLate()
        const allCommands = [...commands, ...commandsLate]
        const didCancel = !!allCommands.filter((c) => c.type === COMMAND_TYPE.CANCEL)[0]
        if (didCancel) {
            this.hasAgainThatNeedsToRun = false
            if (this.undoStack.length > 0) {
                this.applySnapshot(this.undoStack[this.undoStack.length - 1])
            }
            return {
                changedCells: new Set<Cell>(),
                commands: new Set<Command<SoundItem<IGameTile>>>(),
                evaluatedRules
            }
        }
        const didCheckpoint = !!allCommands.find((c) => c.type === COMMAND_TYPE.CHECKPOINT)
        if (didCheckpoint) {
            this.undoStack = []
            this.takeSnapshot(this.createSnapshot())
        }
        // set this only if we did not CANCEL and if some cell changed
        const changedCells = setAddAll(setAddAll(changedCellMutations, changedCellsLate), movedCells)
        if (allCommands.find((c) => c.type === COMMAND_TYPE.AGAIN)) {
            // Compare all the cells to the top of the undo stack. If it does not differ
            this.hasAgainThatNeedsToRun = this.doSnapshotsDiffer(initialSnapshot, this.createSnapshot())
        }
        return {
            changedCells,
            evaluatedRules: evaluatedRules.concat(evaluatedRulesLate),
            commands: allCommands
        }
    }

    private isWinning() {
        let conditionsSatisfied = this.gameData.winConditions.length > 0 // true
        this.gameData.winConditions.forEach((winCondition) => {
            if (!winCondition.isSatisfied(this.getCells())) {
                conditionsSatisfied = false
            }
        })
        return conditionsSatisfied
    }

    // Used for UNDO and RESTART
    private createSnapshot() {
        return this.getCurrentLevel().getCells().map((row) => row.map((cell) => cell.toSnapshot()))
    }
    private takeSnapshot(snapshot: Snapshot) {
        this.undoStack.push(snapshot)
    }
    private applySnapshot(snpashot: Snapshot) {
        const cells = this.getCurrentLevel().getCells()
        for (let rowIndex = 0; rowIndex < cells.length; rowIndex++) {
            const row = cells[rowIndex]
            const snapshotRow = snpashot[rowIndex]
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const cell = row[colIndex]
                const state = snapshotRow[colIndex]
                cell.fromSnapshot(state)
            }
        }
    }
    private doSnapshotsDiffer(snapshot1: Snapshot, snapshot2: Snapshot) {
        for (let rowIndex = 0; rowIndex < snapshot1.length; rowIndex++) {
            for (let colIndex = 0; colIndex < snapshot1[0].length; colIndex++) {
                const sprites1 = snapshot1[rowIndex][colIndex]
                const sprites2 = snapshot2[rowIndex][colIndex]
                if (!setEquals(sprites1, sprites2)) {
                    return true
                }
            }
        }
        return false
    }
}

export interface ILoadingCellsEvent {
    cellStart: number,
    cellEnd: number,
    cellTotal: number,
    key: string
}
export interface ILoadingProgressHandler extends Listener {
    (info: ILoadingCellsEvent): void
}

export type CellSaveState = string[][][]

/**
 * Maintains the state of the game. Here is an example flow:
 *
 * ```js
 * const engine = new GameEngine(gameData)
 * engine.setLevel(0)
 * engine.pressRight()
 * engine.tick()
 * engine.tick()
 * engine.pressUp()
 * engine.tick()
 * engine.pressUndo()
 * engine.tick()
 * ```
 */
export class GameEngine {
    private levelEngine: LevelEngine
    private currentLevelNum: number
    private isFirstTick: boolean
    private messageShownAndWaitingForActionPress: boolean
    constructor(gameData: GameData) {
        this.isFirstTick = true
        this.currentLevelNum = -1234567
        this.messageShownAndWaitingForActionPress = false

        this.levelEngine = new LevelEngine(gameData)
        this.messageShownAndWaitingForActionPress = false
    }
    public on(eventName: string, handler: ILoadingProgressHandler) {
        this.levelEngine.on(eventName, handler)
    }
    public getGameData() {
        return this.levelEngine.gameData
    }
    public getCurrentLevelCells() {
        return this.levelEngine.getCurrentLevel().getCells()
    }
    public getCurrentLevel() {
        return this.getGameData().levels[this.getCurrentLevelNum()]
    }
    public getCurrentLevelNum() {
        return this.currentLevelNum
    }
    public hasAgain() {
        return this.levelEngine.hasAgain()
    }
    public canUndo() {
        return this.levelEngine.canUndo()
    }
    public setLevel(levelNum: number) {
        this.messageShownAndWaitingForActionPress = false
        this.levelEngine.hasAgainThatNeedsToRun = false // clear this so the user can press "X"
        if (this.getGameData().levels[levelNum].isMap()) {
            this.isFirstTick = true
            this.levelEngine.setLevel(levelNum)
        } else {
            // TODO: no need to set the levelEngine when the current level is a Message
        }
        this.currentLevelNum = levelNum
    }
    public tick(): ITickResult {
        // When the current level is a Message, wait until the user presses ACTION
        if (!this.getCurrentLevel().isMap()) {
            // Wait until the user presses "X" (ACTION)
            let didWinGameInMessage = false
            let didLevelChange = false
            if (this.levelEngine.pendingPlayerWantsToMove === RULE_DIRECTION.ACTION) {
                didLevelChange = true
                if (this.currentLevelNum === this.levelEngine.gameData.levels.length - 1) {
                    didWinGameInMessage = true
                } else {
                    this.setLevel(this.currentLevelNum + 1)
                }
            }
            // clear any keys that were pressed
            this.levelEngine.pendingPlayerWantsToMove = null

            return {
                changedCells: new Set(),
                soundToPlay: null,
                messageToShow: null,
                didWinGame: didWinGameInMessage,
                didLevelChange,
                wasAgainTick: false
            }
        }
        const hasAgain = this.levelEngine.hasAgain()
        if (this.levelEngine.gameData.metadata.runRulesOnLevelStart && this.isFirstTick) {
            // don't cancel early
        } else if (!hasAgain && !(this.levelEngine.gameData.metadata.realtimeInterval || this.levelEngine.pendingPlayerWantsToMove)) {
            // check if the `require_player_movement` flag is set in the game
            return {
                changedCells: new Set(),
                soundToPlay: null,
                messageToShow: null,
                didWinGame: false,
                didLevelChange: false,
                wasAgainTick: false
            }
        }

        // If we are showing a message then wait until ACTION is pressed
        if (this.messageShownAndWaitingForActionPress) {
            if (this.levelEngine.pendingPlayerWantsToMove === RULE_DIRECTION.ACTION) {
                // render all the cells because we are currently rendering a Message
                this.messageShownAndWaitingForActionPress = false
                this.levelEngine.pendingPlayerWantsToMove = null
                return {
                    changedCells: new Set(_flatten(this.getCurrentLevelCells())),
                    soundToPlay: null,
                    messageToShow: null,
                    didWinGame: false,
                    didLevelChange: false,
                    wasAgainTick: false
                }
            } else {
                // Keep waiting until ACTION is pressed
                return {
                    changedCells: new Set(),
                    soundToPlay: null,
                    messageToShow: null,
                    didWinGame: false,
                    didLevelChange: false,
                    wasAgainTick: false
                }

            }
        }

        const { changedCells, soundToPlay, messageToShow, isWinning, hasRestart } = this.levelEngine.tick()
        this.isFirstTick = false

        if (hasRestart) {
            this.pressRestart()
            return {
                changedCells: new Set(_flatten(this.getCurrentLevelCells())),
                soundToPlay: null,
                messageToShow: null,
                didWinGame: false,
                didLevelChange: false,
                wasAgainTick: false
            }
        }

        let didWinGame = false
        if (isWinning) {
            if (this.currentLevelNum === this.levelEngine.gameData.levels.length - 1) {
                didWinGame = true
            } else {
                this.setLevel(this.currentLevelNum + 1)
            }
        }

        if (messageToShow) {
            this.messageShownAndWaitingForActionPress = true
        }

        return {
            changedCells,
            soundToPlay,
            messageToShow,
            didWinGame,
            didLevelChange: isWinning,
            wasAgainTick: hasAgain
        }
    }

    public press(direction: RULE_DIRECTION) {
        return this.levelEngine.press(direction)
    }
    public pressUp() {
        this.levelEngine.press(RULE_DIRECTION.UP)
    }
    public pressDown() {
        this.levelEngine.press(RULE_DIRECTION.DOWN)
    }
    public pressLeft() {
        this.levelEngine.press(RULE_DIRECTION.LEFT)
    }
    public pressRight() {
        this.levelEngine.press(RULE_DIRECTION.RIGHT)
    }
    public pressAction() {
        this.levelEngine.press(RULE_DIRECTION.ACTION)
    }

    public pressRestart() {
        this.isFirstTick = true
        this.levelEngine.pressRestart()
    }
    public pressUndo() {
        this.messageShownAndWaitingForActionPress = false
        this.levelEngine.pressUndo()
    }

    // Pixels and Sprites
    public getSpriteSize() {
        return this.getGameData().getSpriteSize()
    }

    public saveSnapshotToJSON(): CellSaveState {
        return this.getCurrentLevelCells().map((row) => row.map((cell) => [...cell.toSnapshot()].map((s) => s.getName())))
    }

    public loadSnapshotFromJSON(json: CellSaveState) {
        json.forEach((rowSave, rowIndex) => {
            rowSave.forEach((cellSave, colIndex) => {
                const cell = this.levelEngine.getCurrentLevel().getCell(rowIndex, colIndex)

                const spritesToHave = cellSave.map((spriteName) => {
                    const sprite = this.getGameData()._getSpriteByName(spriteName)
                    if (sprite) {
                        return sprite
                    } else {
                        throw new Error(`BUG: Could not find sprite to add named ${spriteName}`)
                    }
                })

                cell.fromSnapshot(new Set(spritesToHave))
            })
        })
    }

    public setMessageLevel(sprites: Array<Array<Set<GameSprite>>>) {
        this.levelEngine.setMessageLevel(sprites)
    }

    public restoreFromMessageLevel() {
        this.levelEngine.restoreFromMessageLevel()
    }

}
