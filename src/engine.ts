import * as _ from 'lodash'
import { EventEmitter2, Listener } from 'eventemitter2'
import { GameData } from './models/game'
import { GameSprite } from './models/tile'
import { IRule, IMutation } from './models/rule'
import { nextRandom, setAddAll, RULE_DIRECTION, setDifference, Optional, setEquals, resetRandomSeed } from './util'
import { AbstractCommand, COMMAND_TYPE } from './models/command';
import { GameSound } from './models/sound';
import { CollisionLayer } from './models/collisionLayer';

type CollisionLayerState = {
    readonly wantsToMove: Optional<RULE_DIRECTION>
    readonly sprite: GameSprite
}

type TickResult = {
    changedCells: Set<Cell>,
    soundToPlay: Optional<GameSound>,
    messageToShow: Optional<string>,
    didWinGame: boolean,
    didLevelChange: boolean,
    wasAgainTick: boolean
}

type Snapshot = Set<GameSprite>[][]


/**
 * The state of sprites in one position of the current level being played.
 *
 * This stores all the sprites and which direction those sprites want to move.
 *
 * The [[TerminalUI]] uses this object to render and the [[GameEngine]] uses this to maintain the state
 * of one position of the current level.
 */
export class Cell {
    private readonly engine: Optional<LevelEngine>
    private readonly state: Map<CollisionLayer, CollisionLayerState>
    private cacheCollisionLayers: CollisionLayer[]
    public readonly rowIndex: number
    public readonly colIndex: number

    constructor(engine: Optional<LevelEngine>, sprites: Set<GameSprite>, rowIndex: number, colIndex: number) {
        this.engine = engine
        this.rowIndex = rowIndex
        this.colIndex = colIndex
        this.state = new Map()
        this.cacheCollisionLayers = []

        for (const sprite of sprites) {
            this._setWantsToMove(sprite, RULE_DIRECTION.STATIONARY)
        }

    }
    private _setState(collisionLayer: CollisionLayer, sprite: Optional<GameSprite>, wantsToMove: Optional<RULE_DIRECTION>) {
        let needsToUpdateCache
        if (sprite) {
            needsToUpdateCache = this.cacheCollisionLayers.indexOf(collisionLayer) < 0
            this.state.set(collisionLayer, {wantsToMove, sprite})
        } else {
            this.state.delete(collisionLayer)
            needsToUpdateCache = true
        }

        if (needsToUpdateCache) {
            // Update the collisionLayer Cache
            this.cacheCollisionLayers = [...this.state.keys()]
            .sort((c1, c2) => c1.id - c2.id)
        }
    }
    _setWantsToMove(sprite: GameSprite, wantsToMove: Optional<RULE_DIRECTION>) {
        const collisionLayer = sprite.getCollisionLayer()
        const {wantsToMove: cellWantsToMove, sprite: cellSprite} = this.getStateForCollisionLayer(collisionLayer)
        const didActuallyChangeDir = cellWantsToMove !== wantsToMove
        const didActuallyChangeSprite = cellSprite !== sprite
        this._setState(collisionLayer, sprite, wantsToMove)
        return didActuallyChangeSprite || didActuallyChangeDir
    }
    _deleteWantsToMove(sprite: GameSprite) {
        // There may be other sprites in the same ... oh wait, no that's not possible.
        const collisionLayer = sprite.getCollisionLayer()
        const didActuallyChange = !!this.getSpriteByCollisionLayer(collisionLayer)

        this._setState(collisionLayer, null, null) // delete the entry

        return didActuallyChange
    }
    private getStateForCollisionLayer(collisionLayer: CollisionLayer) {
        const state = this.state.get(collisionLayer)
        if (!state) {
            return {wantsToMove: null, sprite: null}
        }
        return state
    }
    setWantsToMoveCollisionLayer(collisionLayer: CollisionLayer, wantsToMove: RULE_DIRECTION) {
        // Check that there is a sprite for this collision layer
        const {sprite, wantsToMove: cellWantsToMove} = this.getStateForCollisionLayer(collisionLayer)
        if (!sprite) {
            debugger
            console.error(collisionLayer.toString())
            throw new Error(`BUG: No sprite for collision layer. Cannot set direction`)
        }
        const didActuallyChange = cellWantsToMove !== wantsToMove

        this._setState(collisionLayer, sprite, wantsToMove)

        sprite.addCell(this, wantsToMove)
        return didActuallyChange
    }
    deleteWantsToMoveCollisionLayer(collisionLayer: CollisionLayer) {
        // Check that there is a sprite for this collision layer
        const {sprite, wantsToMove: cellWantsToMove} = this.getStateForCollisionLayer(collisionLayer)
        if (!sprite) {
            debugger
            console.error(collisionLayer.toString())
            throw new Error(`BUG: No sprite for collision layer. Cannot delete direction`)
        }
        const didActuallyChange = cellWantsToMove !== null

        this._setState(collisionLayer, sprite, null)

        sprite.removeCell(this)
        return didActuallyChange
    }
    getSpriteByCollisionLayer(collisionLayer: CollisionLayer) {
        const {sprite} = this.getStateForCollisionLayer(collisionLayer)
        return sprite || null
    }
    getCollisionLayers() {
        // return [...this._state.keys()]
        //     .sort((c1, c2) => c1.id - c2.id)
        return this.cacheCollisionLayers
    }
    getSprites() {
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
    getSpritesAsSet() {
        // Just pull out the sprite, not the wantsToMoveDir
        const sprites = new Set<GameSprite>()
        for (const {sprite} of this.state.values()) {
            sprites.add(sprite)
        }
        return sprites
    }
    getSpriteAndWantsToMoves() {
        // Just pull out the sprite, not the wantsToMoveDir
        // Retur na new set so we can mutate it later
        const map = new Map()
        for (const collisionLayer of this.getCollisionLayers()) {
            map.set(this.getSpriteByCollisionLayer(collisionLayer), this.getCollisionLayerWantsToMove(collisionLayer))
        }
        return map
    }
    getCollisionLayerWantsToMove(collisionLayer: CollisionLayer) {
        const {wantsToMove} = this.getStateForCollisionLayer(collisionLayer)
        return wantsToMove || null
    }
    hasSprite(sprite: GameSprite) {
        const cellSprite = this.getSpriteByCollisionLayer(sprite.getCollisionLayer())
        return sprite === cellSprite
    }

    private _getRelativeNeighbor(y: number, x: number) {
        if (!this.engine) {
            throw new Error(`BUG: we need an engine in order to find neighbors. It is optional for letters in messages`)
        }
        const row = this.engine.getCurrentLevel()[this.rowIndex + y]
        if (!row) return null
        return row[this.colIndex + x]
    }
    getNeighbor(direction: string) {
        switch (direction) {
            case RULE_DIRECTION.UP:
                return this._getRelativeNeighbor(-1, 0)
            case RULE_DIRECTION.DOWN:
                return this._getRelativeNeighbor(1, 0)
            case RULE_DIRECTION.LEFT:
                return this._getRelativeNeighbor(0, -1)
            case RULE_DIRECTION.RIGHT:
                return this._getRelativeNeighbor(0, 1)
            default:
                debugger
                throw new Error(`BUG: Unsupported direction "${direction}"`)
        }
    }
    getWantsToMove(sprite: GameSprite) {
        return this.getCollisionLayerWantsToMove(sprite.getCollisionLayer())
    }
    hasCollisionWithSprite(otherSprite: GameSprite) {
        return !!this.getCollisionLayerWantsToMove(otherSprite.getCollisionLayer())
    }
    clearWantsToMove(sprite: GameSprite) {
        this._setWantsToMove(sprite, RULE_DIRECTION.STATIONARY)
        sprite.updateCell(this, RULE_DIRECTION.STATIONARY)
    }
    addSprite(sprite: GameSprite, wantsToMove: Optional<RULE_DIRECTION>) {
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
    removeSprite(sprite: GameSprite) {
        const didActuallyChange = this._deleteWantsToMove(sprite)
        sprite.removeCell(this)
        return didActuallyChange
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
    toString() {
        return `Cell [${this.rowIndex}][${this.colIndex}] ${[...this.getSpriteAndWantsToMoves().entries()].map(([sprite, wantsToMove]) => `${wantsToMove} ${sprite.getName()}`).join(' ')}`
    }
    toSnapshot() {
        return this.getSpritesAsSet()
    }
    fromSnapshot(newSprites: Set<GameSprite>) {
        const currentSprites = this.getSpritesAsSet()
        const spritesToRemove = setDifference(currentSprites, newSprites)
        const spritesToAdd = setDifference(newSprites, currentSprites)
        // Remove Sprites
        this.removeSprites(spritesToRemove)
        // Add Sprites
        this.addSprites(spritesToAdd)
    }
}

/**
 * Internal class that ise used to maintain the state of a level.
 *
 * This should not be called directly. Instead, use [[GameEngine]] .
 */
export class LevelEngine extends EventEmitter2 {
    public readonly gameData: GameData
    private currentLevel: Optional<Cell[][]>
    pendingPlayerWantsToMove: Optional<RULE_DIRECTION>
    hasAgainThatNeedsToRun: boolean
    private undoStack: Snapshot[]

    constructor(gameData: GameData) {
        super()
        this.gameData = gameData
        this.hasAgainThatNeedsToRun = false
        this.undoStack = []
    }

    setLevel(levelNum: number) {
        this.undoStack = []
        this.gameData.clearCaches()

        const level = this.gameData.levels[levelNum]
        if (!level) {
            throw new Error(`Invalid levelNum: ${levelNum}`)
        }
        if (process.env['NODE_ENV'] === 'development') {
            level.__incrementCoverage()
        }
        resetRandomSeed()
        // Clone the board because we will be modifying it
        this.currentLevel = level.getRows().map((row, rowIndex) => {
            return row.map((col, colIndex) => new Cell(this, new Set(col.getSprites()), rowIndex, colIndex))
        })

        // link up all the cells. Loop over all the sprites
        // in case they are NO tiles (so the cell is included)
        const batchCells: Map<string, Cell[]> = new Map()
        function spriteSetToKey(sprites: Set<GameSprite>) {
            const key = []
            for (const spriteName of [...sprites].map(sprite => sprite.getName()).sort()) {
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
                    key: key
                })
            }
            // All Cells contain the same set of sprites so just pull out the 1st one
            for (const sprite of this.gameData.objects) {
                const cellSprites = cells[0].getSpritesAsSet()
                const hasSprite = cellSprites.has(sprite)
                if (hasSprite || sprite.hasNegationTile()) {
                    if (hasSprite) {
                        sprite.addCells(cells, RULE_DIRECTION.STATIONARY)
                    } else {
                        sprite.removeCells(cells)
                    }
                }
            }
            i += cells.length
        }

        this.takeSnapshot(this.createSnapshot())

        // Return the cells so the UI can listen to when they change
        return this.getCells()
    }

    private getCells() {
        return _.flatten(this.currentLevel)
    }
    getCurrentLevel() {
        if (this.currentLevel) {
            return this.currentLevel
        } else {
            throw new Error(`BUG: There is no current level. Maybe it is a message level or maybe setLevel was never called`)
        }
    }

    toSnapshot() {
        return this.getCurrentLevel().map(row => {
            return row.map(cell => {
                const ret: string[] = []
                cell.getSpriteAndWantsToMoves().forEach((wantsToMove, sprite) => {
                    ret.push(`${wantsToMove} ${sprite.getName()}`)
                })
                return ret
            })
        })
    }

    private tickUpdateCells() {
        if (process.env['LOG_LEVEL'] === 'debug') {
            console.error(`applying rules`)
        }
        return this._tickUpdateCells(this.gameData.rules.filter(r => !r.isLate()))
    }

    private tickUpdateCellsLate() {
        if (process.env['LOG_LEVEL'] === 'debug') {
            console.error(`applying late rules`)
        }
        return this._tickUpdateCells(this.gameData.rules.filter(r => r.isLate()))
    }

    private _tickUpdateCells(rules: Iterable<IRule>) {
        const changedMutations: Set<IMutation> = new Set()
        const evaluatedRules: IRule[] = []
        for (const rule of rules) {
            const cellMutations = rule.evaluate(false/*evaluate all rules*/)
            if (cellMutations.length > 0) {
                evaluatedRules.push(rule)
            }
            for (const mutation of cellMutations) {
                changedMutations.add(mutation)
            }
        }

        // We may have mutated the same cell 4 times (e.g. [Player]->[>Player]) so consolidate
        const changedCells = new Set<Cell>()
        const commands = new Set<AbstractCommand>()
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
        return {evaluatedRules: evaluatedRules, changedCells: changedCells, commands: commands/*, didSomeSpriteChange: didSomeSpriteChange*/}
    }

    private tickMoveSprites(changedCells: Set<Cell>) {
        let movedCells: Set<Cell> = new Set()
        // Loop over all the cells, see if a Rule matches, apply the transition, and notify that cells changed
        let somethingChanged
        do {
            somethingChanged = false
            for (const cell of changedCells) {
                for (let [sprite, wantsToMove] of cell.getSpriteAndWantsToMoves()) {

                    if (wantsToMove !== RULE_DIRECTION.STATIONARY) {
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
                        }
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
        let changedCellMutations = new Set()
        const initialSnapshot = this.createSnapshot()
        if (this.pendingPlayerWantsToMove) {
            this.takeSnapshot(initialSnapshot)

            if (process.env['LOG_LEVEL'] === 'debug') {
                console.error(`Turn starts with input of ${this.pendingPlayerWantsToMove.toLowerCase()}.`)
            }
            const t = this.gameData.getPlayer()
            for (const cell of t.getCellsThatMatch()) {
                for (const sprite of t.getSpritesThatMatch(cell)) {
                    cell.addSprite(sprite, this.pendingPlayerWantsToMove)
                    changedCellMutations.add(cell)
                }
            }
            this.pendingPlayerWantsToMove = null
        } else {
            if (process.env['LOG_LEVEL'] === 'debug') {
                console.error(`Turn starts with no input.`)
            }
        }

        const {changedCells: changedCellMutations2, evaluatedRules, commands} = this.tickUpdateCells()
        changedCellMutations = setAddAll(changedCellMutations, changedCellMutations2)

        // Continue evaluating again rules only when some sprites have changed
        // The didSpritesChange logic is not correct.
        // a rule might add a sprite, and then another rule might remove a sprite.
        // We need to compare the set of sprites before and after ALL rules ran.
        // This will likely be implemented as part of UNDO or CHECKPOINT.
        const movedCells = this.tickMoveSprites(new Set<Cell>(changedCellMutations.keys()))
        const {changedCells: changedCellsLate, evaluatedRules: evaluatedRulesLate, commands: commandsLate} = this.tickUpdateCellsLate()
        const allCommands = [...commands, ...commandsLate]
        const didCancel = !!allCommands.filter(c => c.getType() === COMMAND_TYPE.CANCEL)[0]
        if (didCancel) {
            this.hasAgainThatNeedsToRun = false
            if (this.undoStack.length > 0) {
                this.applySnapshot(this.undoStack[this.undoStack.length - 1])
            }
            return {
                changedCells: new Set(),
                commands: new Set(),
                evaluatedRules: evaluatedRules,
            }
        }
        const didCheckpoint = !!allCommands.find(c => c.getType() === COMMAND_TYPE.CHECKPOINT)
        if (didCheckpoint) {
            this.undoStack = []
            this.takeSnapshot(this.createSnapshot())
        }
        // set this only if we did not CANCEL and if some cell changed
        const changedCells = setAddAll(setAddAll(changedCellMutations, changedCellsLate), movedCells)
        if (!!allCommands.find(c => c.getType() === COMMAND_TYPE.AGAIN)) {
            // Compare all the cells to the top of the undo stack. If it does not differ
            this.hasAgainThatNeedsToRun = this.doSnapshotsDiffer(initialSnapshot, this.createSnapshot())
        }
        return {
            changedCells: changedCells,
            evaluatedRules: evaluatedRules.concat(evaluatedRulesLate),
            commands: allCommands
        }
    }

    tick() {
        if (process.env['LOG_LEVEL'] === 'debug') {
            console.error(``)
            console.error(`=======================`)
        }

        if (this.hasAgainThatNeedsToRun) {
            // run the AGAIN rules
            this.hasAgainThatNeedsToRun = false // let the .tick() make it true
        }
        const ret = this.tickNormal()
        // TODO: Handle the commands like RESTART, CANCEL, WIN at this point
        let soundToPlay: Optional<GameSound> = null
        let messageToShow: Optional<string> = null
        let hasWinCommand = false
        let hasRestart = false
        for (const command of ret.commands) {
            switch (command.getType()) {
                case COMMAND_TYPE.RESTART:
                    hasRestart = true
                    break
                case COMMAND_TYPE.SFX:
                    soundToPlay = command.getSound()
                    break
                case COMMAND_TYPE.MESSAGE:
                    messageToShow = command.getMessage()
                    break
                case COMMAND_TYPE.WIN:
                    hasWinCommand = true
                    break
                default:
                    // console.error(`BUG: Unsupported command "${command.getType()}"`)
            }
        }
        if (process.env['LOG_LEVEL'] === 'debug') {
            console.error(`checking win condition.`)
        }
        if (this.hasAgainThatNeedsToRun) {
            if (process.env['LOG_LEVEL'] === 'debug') {
                console.error(`AGAIN command executed, with changes detected - will execute another turn.`)
            }
        }

        return {
            changedCells: new Set(ret.changedCells.keys()),
            soundToPlay,
            messageToShow,
            hasRestart,
            isWinning: hasWinCommand || this.isWinning()
        }
    }

    hasAgain() {
        return this.hasAgainThatNeedsToRun
    }

    private isWinning() {
        let conditionsSatisfied = this.gameData.winConditions.length > 0 // true
        this.gameData.winConditions.forEach(winCondition => {
            if (!winCondition.isSatisfied(this.getCells())) {
                conditionsSatisfied = false
            }
        })
        return conditionsSatisfied
    }

    // Used for UNDO and RESTART
    private createSnapshot() {
        return this.getCurrentLevel().map(row => row.map(cell => cell.toSnapshot()))
    }
    private takeSnapshot(snapshot: Snapshot) {
        this.undoStack.push(snapshot)
    }
    private applySnapshot(snpashot: Snapshot) {
        for (let rowIndex = 0; rowIndex < this.getCurrentLevel().length; rowIndex++) {
            const row = this.getCurrentLevel()[rowIndex]
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

    press(direction: RULE_DIRECTION) {
        // Should disable keypresses if `AGAIN` is running.
        // It is commented because the didSpritesChange logic is not correct.
        // a rule might add a sprite, and then another rule might remove a sprite.
        // We need to compare the set of sprites before and after ALL rules ran.
        // This will likely be implemented as part of UNDO or CHECKPOINT.
        // if (!this.hasAgain()) {
        this.pendingPlayerWantsToMove = direction
        // }
    }
    pressRestart() {
        // Add the initial checkpoint to the top (rather than clearing the stack)
        // so the player can still "UNDO" after pressing "RESTART"
        const snapshot = this.undoStack[0]
        this.undoStack.push(snapshot)
        this.applySnapshot(snapshot)
    }
    pressUndo() {
        const snapshot = this.undoStack.pop()
        if (snapshot && this.undoStack.length > 0) { // the 0th entry is the initial load of the level
            this.applySnapshot(snapshot)
        } else if (snapshot) {
            // oops, put the snapshot back on the stack
            this.undoStack.push(snapshot)
        }
    }
}

export type LoadingCellsEvent = {
    cellStart: number,
    cellEnd: number,
    cellTotal: number,
    key: string
}
export interface ILoadingProgressHandler extends Listener {
    (info: LoadingCellsEvent): void;
}

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
    on(eventName: string, handler: ILoadingProgressHandler) {
        this.levelEngine.on(eventName, handler)
    }
    getGameData() {
        return this.levelEngine.gameData
    }
    getCurrentLevelCells() {
        return this.levelEngine.getCurrentLevel()
    }
    getCurrentLevel() {
        return this.getGameData().levels[this.getCurrentLevelNum()]
    }
    getCurrentLevelNum() {
        return this.currentLevelNum
    }
    hasAgain() {
        return this.levelEngine.hasAgain()
    }
    setLevel(levelNum: number) {
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
    tick(): TickResult {
        // When the current level is a Message, wait until the user presses ACTION
        if (!this.getCurrentLevel().isMap()) {
            // Wait until the user presses "X" (ACTION)
            let didWinGame = false
            let didLevelChange = false
            if (this.levelEngine.pendingPlayerWantsToMove === RULE_DIRECTION.ACTION) {
                didLevelChange = true
                if (this.currentLevelNum === this.levelEngine.gameData.levels.length - 1) {
                    didWinGame = true
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
                didWinGame: didWinGame,
                didLevelChange: didLevelChange,
                wasAgainTick: false
            }
        }
        const hasAgain = this.levelEngine.hasAgain()
        if (this.levelEngine.gameData.metadata.run_rules_on_level_start && this.isFirstTick) {
            // don't cancel early
        } else if (!hasAgain && !(this.levelEngine.gameData.metadata.realtime_interval || this.levelEngine.pendingPlayerWantsToMove)) {
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
                    changedCells: new Set(_.flatten(this.getCurrentLevelCells())),
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

        const {changedCells, soundToPlay, messageToShow, isWinning, hasRestart} = this.levelEngine.tick()
        this.isFirstTick = false

        if (hasRestart) {
            this.pressRestart()
            return {
                changedCells: new Set(_.flatten(this.getCurrentLevelCells())),
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


    press(direction: RULE_DIRECTION) {
        return this.levelEngine.press(direction)
    }
    pressUp() {
        this.levelEngine.press(RULE_DIRECTION.UP)
    }
    pressDown() {
        this.levelEngine.press(RULE_DIRECTION.DOWN)
    }
    pressLeft() {
        this.levelEngine.press(RULE_DIRECTION.LEFT)
    }
    pressRight() {
        this.levelEngine.press(RULE_DIRECTION.RIGHT)
    }
    pressAction() {
        this.levelEngine.press(RULE_DIRECTION.ACTION)
    }

    pressRestart() {
        this.isFirstTick = true
        this.levelEngine.pressRestart()
    }
    pressUndo() {
        this.messageShownAndWaitingForActionPress = false
        this.levelEngine.pressUndo()
    }

    // Pixels and Sprites
    getSpriteSize() {
        return this.getGameData().getSpriteSize()
    }
}