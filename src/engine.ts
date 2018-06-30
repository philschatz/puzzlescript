import * as _ from 'lodash'
import { EventEmitter2, Listener } from 'eventemitter2'
import { GameData } from './models/game'
import { GameSprite, IGameTile } from './models/tile'
import { IRule, IMutation } from './models/rule'
import { nextRandom, setAddAll, RULE_DIRECTION_ABSOLUTE, setDifference, Optional } from './util'
import { RULE_DIRECTION } from './enums';
import { AbstractCommand, COMMAND_TYPE } from './models/command';
import { GameSound } from './models/sound';
import { CollisionLayer } from './models/collisionLayer';

type CollisionLayerState = {
    readonly wantsToMove: Optional<RULE_DIRECTION_ABSOLUTE>
    readonly sprite: GameSprite
}

type TickResult = {
    changedCells: Set<Cell>,
    soundToPlay: Optional<GameSound>,
    didWinGame: boolean,
    didLevelChange: boolean,
    wasAgainTick: boolean
}


// This Object exists so the UI has something to bind to
export class Cell {
    private _engine: LevelEngine
    private _state: Map<CollisionLayer, CollisionLayerState>
    private _cacheCollisionLayers: CollisionLayer[]
    public readonly rowIndex: number
    public readonly colIndex: number

    constructor(engine: LevelEngine, sprites: Set<GameSprite>, rowIndex: number, colIndex: number) {
        this._engine = engine
        this.rowIndex = rowIndex
        this.colIndex = colIndex
        this._state = new Map()
        this._cacheCollisionLayers = []

        for (const sprite of sprites) {
            this._setWantsToMove(sprite, RULE_DIRECTION_ABSOLUTE.STATIONARY)
        }

    }
    _setState(collisionLayer: CollisionLayer, sprite: Optional<GameSprite>, wantsToMove: Optional<RULE_DIRECTION_ABSOLUTE>) {
        let needsToUpdateCache
        if (sprite) {
            needsToUpdateCache = this._cacheCollisionLayers.indexOf(collisionLayer) < 0
            this._state.set(collisionLayer, {wantsToMove, sprite})
        } else {
            this._state.delete(collisionLayer)
            needsToUpdateCache = true
        }

        if (needsToUpdateCache) {
            // Update the collisionLayer Cache
            this._cacheCollisionLayers = [...this._state.keys()]
            .sort((c1, c2) => c1.id - c2.id)
        }
    }
    _setWantsToMove(sprite: GameSprite, wantsToMove: Optional<RULE_DIRECTION_ABSOLUTE>) {
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
    getStateForCollisionLayer(collisionLayer: CollisionLayer) {
        const state = this._state.get(collisionLayer)
        if (!state) {
            return {wantsToMove: null, sprite: null}
        }
        return state
    }
    setWantsToMoveCollisionLayer(collisionLayer: CollisionLayer, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
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
        return this._cacheCollisionLayers
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
        for (const {sprite} of this._state.values()) {
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

    _getRelativeNeighbor(y: number, x: number) {
        const row = this._engine.getCurrentLevel()[this.rowIndex + y]
        if (!row) return null
        return row[this.colIndex + x]
    }
    getNeighbor(direction: string) {
        switch (direction) {
            case RULE_DIRECTION_ABSOLUTE.UP:
                return this._getRelativeNeighbor(-1, 0)
            case RULE_DIRECTION_ABSOLUTE.DOWN:
                return this._getRelativeNeighbor(1, 0)
            case RULE_DIRECTION_ABSOLUTE.LEFT:
                return this._getRelativeNeighbor(0, -1)
            case RULE_DIRECTION_ABSOLUTE.RIGHT:
                return this._getRelativeNeighbor(0, 1)
            default:
                debugger
                throw new Error(`BUG: Unsupported direction "${direction}"`)
        }
    }
    wantsToMoveTo(tile: IGameTile, absoluteDirection: RULE_DIRECTION_ABSOLUTE) {
        let wantsToMove = false
        tile.getSprites().forEach(sprite => {
            const directionForSprite = this.getWantsToMove(sprite)
            if (directionForSprite && directionForSprite === absoluteDirection) {
                wantsToMove = true
            }
        })
        return wantsToMove
    }
    getWantsToMove(sprite: GameSprite) {
        return this.getCollisionLayerWantsToMove(sprite.getCollisionLayer())
    }
    hasCollisionWithSprite(otherSprite: GameSprite) {
        return !!this.getCollisionLayerWantsToMove(otherSprite.getCollisionLayer())
    }
    clearWantsToMove(sprite: GameSprite) {
        this._setWantsToMove(sprite, RULE_DIRECTION_ABSOLUTE.STATIONARY)
        sprite.updateCell(this, RULE_DIRECTION_ABSOLUTE.STATIONARY)
    }
    addSprite(sprite: GameSprite, wantsToMove: Optional<RULE_DIRECTION_ABSOLUTE>) {
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
            wantsToMove = prevWantsToMove || RULE_DIRECTION_ABSOLUTE.STATIONARY // try to preserve the wantsToMove
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
    removeSprites(sprites: Iterable<GameSprite>) {
        for (const sprite of sprites) {
            this.removeSprite(sprite)
        }
    }
    addSprites(sprites: Iterable<GameSprite>) {
        for (const sprite of sprites) {
            this.addSprite(sprite, null)
        }
    }
    setWantsToMove(tile: IGameTile, wantsToMove: RULE_DIRECTION_ABSOLUTE) {
        for (const sprite of tile.getSprites()) {
            if (this.hasSprite(sprite)) {
                this.addSprite(sprite, wantsToMove)
            }
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

export class LevelEngine extends EventEmitter2 {
    public readonly gameData: GameData
    currentLevel: Optional<Cell[][]>
    _pendingPlayerWantsToMove: Optional<RULE_DIRECTION_ABSOLUTE>
    _hasAgainThatNeedsToRun: boolean
    private _undoStack: Set<GameSprite>[][][]

    constructor(gameData: GameData) {
        super()
        this.gameData = gameData
        this._hasAgainThatNeedsToRun = false
        this._undoStack = []
    }

    setLevel(levelNum: number) {
        this._undoStack = []
        this.gameData.clearCaches()

        const level = this.gameData.levels[levelNum]
        if (!level) {
            throw new Error(`Invalid levelNum: ${levelNum}`)
        }
        if (process.env['NODE_ENV'] === 'development') {
            level.__incrementCoverage()
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
                        sprite.addCells(cells, RULE_DIRECTION_ABSOLUTE.STATIONARY)
                    } else {
                        sprite.removeCells(cells)
                    }
                }
            }
            i += cells.length
        }

        this.takeSnapshot()

        // Return the cells so the UI can listen to when they change
        return this.getCells()
    }

    getCells() {
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
                    ret.push(`${wantsToMove} ${sprite._name}`)
                })
                return ret
            })
        })
    }

    tickUpdateCells() {
        if (process.env['LOG_LEVEL'] === 'debug') {
            console.error(`applying rules`)
        }
        return this._tickUpdateCells(this.gameData.rules.filter(r => !r.isLate()))
    }

    tickUpdateCellsLate() {
        if (process.env['LOG_LEVEL'] === 'debug') {
            console.error(`applying late rules`)
        }
        return this._tickUpdateCells(this.gameData.rules.filter(r => r.isLate()))
    }

    _tickUpdateCells(rules: Iterable<IRule>) {
        const changedMutations: Set<IMutation> = new Set()
        const evaluatedRules: IRule[] = []
        for (const rule of rules) {
            const cellMutations = rule.evaluate()
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
        let didSomeSpriteChange = false
        for (const mutation of changedMutations) {
            if (mutation.getDidSpritesChange()) {
                didSomeSpriteChange = true
            }
            if (mutation.hasCell()) {
                changedCells.add(mutation.getCell())
            } else {
                commands.add(mutation.getCommand())
            }
            // if (!changedCells.has(mutation.cell)) {
            //     changedCells.set(mutation.cell, mutation.didSpritesChange)
            // }
        }
        return {evaluatedRules: evaluatedRules, changedCells: changedCells, commands: commands, didSomeSpriteChange: didSomeSpriteChange}
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
            for (const [sprite] of cell.getSpriteAndWantsToMoves()) {
                cell.clearWantsToMove(sprite)
            }
        }
        return movedCells
    }

    tickNormal() {
        let changedCellMutations = new Set()
        if (this._pendingPlayerWantsToMove) {
            this.takeSnapshot()

            if (process.env['LOG_LEVEL'] === 'debug') {
                console.error(`Turn starts with input of ${this._pendingPlayerWantsToMove.toLowerCase()}.`)
            }
            const t = this.gameData.getPlayer()
            for (const cell of t.getCellsThatMatch()) {
                for (const sprite of t.getSpritesThatMatch(cell)) {
                    cell.addSprite(sprite, this._pendingPlayerWantsToMove)
                    changedCellMutations.add(cell)
                }
            }
            this._pendingPlayerWantsToMove = null
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
        const didCancel = !![...commands].filter(c => c.getType() === COMMAND_TYPE.CANCEL)[0]
        if (didCancel) {
            this._hasAgainThatNeedsToRun = false
            if (this._undoStack.length > 0) {
                this.applySnapshot(this._undoStack[this._undoStack.length - 1])
            }
            return {
                changedCells: new Set(),
                commands: new Set(),
                evaluatedRules: evaluatedRules,
            }
        }
        const didCheckpoint = !![...commands].filter(c => c.getType() === COMMAND_TYPE.CHECKPOINT)[0]
        if (didCheckpoint) {
            this._undoStack = []
            this.takeSnapshot()
        }
        const {changedCells: changedCellsLate, evaluatedRules: evaluatedRulesLate, commands: commandsLate} = this.tickUpdateCellsLate()
        // set this only if we did not CANCEL
        this._hasAgainThatNeedsToRun = !![...commands, ...commandsLate].filter(c => c.getType() === COMMAND_TYPE.AGAIN)[0]
        return {
            changedCells: setAddAll(setAddAll(changedCellMutations, changedCellsLate), movedCells),
            evaluatedRules: evaluatedRules.concat(evaluatedRulesLate),
            commands: commands
        }
    }

    tick() {
        if (process.env['LOG_LEVEL'] === 'debug') {
            console.error(``)
            console.error(`=======================`)
        }

        let ret : { changedCells: Set<Cell>, evaluatedRules: IRule[] , commands: Set<AbstractCommand>}
        if (this._hasAgainThatNeedsToRun) {
            // run the AGAIN rules
            this._hasAgainThatNeedsToRun = false // let the .tick() make it true
            ret = this.tickNormal()
        } else {
            ret = this.tickNormal()
        }
        // TODO: Handle the commands like RESTART, CANCEL, WIN at this point
        let soundToPlay: Optional<GameSound> = null
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
        if (process.env['LOG_LEVEL'] === 'debug') {
            console.error(`checking win condition.`)
        }
        if (this._hasAgainThatNeedsToRun) {
            if (process.env['LOG_LEVEL'] === 'debug') {
                console.error(`AGAIN command executed, with changes detected - will execute another turn.`)
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

    // Used for UNDO and RESTART
    takeSnapshot() {
        const snapshot = this.getCurrentLevel().map(row => row.map(cell => cell.toSnapshot()))
        this._undoStack.push(snapshot)
    }
    applySnapshot(snpashot: Set<GameSprite>[][]) {
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

    press(direction: RULE_DIRECTION_ABSOLUTE) {
        // Should disable keypresses if `AGAIN` is running.
        // It is commented because the didSpritesChange logic is not correct.
        // a rule might add a sprite, and then another rule might remove a sprite.
        // We need to compare the set of sprites before and after ALL rules ran.
        // This will likely be implemented as part of UNDO or CHECKPOINT.
        // if (!this.hasAgain()) {
        this._pendingPlayerWantsToMove = direction
        // }
    }
    pressRestart() {
        const snapshot = this._undoStack[0]
        this._undoStack = [snapshot]
        this.applySnapshot(snapshot)
    }
    pressUndo() {
        const snapshot = this._undoStack.pop()
        if (snapshot && this._undoStack.length > 0) { // the 0th entry is the initial load of the level
            this.applySnapshot(snapshot)
        } else if (snapshot) {
            // oops, put the snapshot back on the stack
            this._undoStack.push(snapshot)
        }
    }
}

export type LoadingCellsEvent = {
    cellStart: number,
    cellEnd: number,
    cellTotal: number,
    key: string
}
export interface LoadingProgressHandler extends Listener {
    (info: LoadingCellsEvent): void;
}

export class GameEngine {
    private _levelEngine: Optional<LevelEngine>
    private _currentLevelNum: number
    private _events: Map<string, LoadingProgressHandler []>
    private _isFirstTick: boolean
    constructor() {
        this._events = new Map()
        this._isFirstTick = true
        this._currentLevelNum = -1234567
    }
    on(eventName: string, handler: LoadingProgressHandler) {
        let events = this._events.get(eventName)
        if (!events) {
            events = []
            this._events.set(eventName, events)
        }
        events.push(handler)
    }
    setGame(gameData: GameData) {
        this._levelEngine = new LevelEngine(gameData)
        // register event handlers (like for the loading progress bar)
        for (const [eventName, handlers] of this._events.entries()) {
            for (const handler of handlers) {
                this._levelEngine.on(eventName, handler)
            }
        }
    }
    _getEngine() {
        if (this._levelEngine) {
            return this._levelEngine
        } else {
            throw new Error(`BUG: Engine was never set. Did you call setGame()?`)
        }
    }
    getGameData() {
        return this._getEngine().gameData
    }
    getCurrentLevelCells() {
        return this._getEngine().getCurrentLevel()
    }
    getCurrentLevel() {
        return this.getGameData().levels[this.getCurrentLevelNum()]
    }
    getCurrentLevelNum() {
        return this._currentLevelNum
    }
    hasAgain() {
        return this._getEngine().hasAgain()
    }
    setLevel(levelNum: number) {
        this._getEngine()._hasAgainThatNeedsToRun = false // clear this so the user can press "X"
        if (this.getGameData().levels[levelNum].isMap()) {
            this._isFirstTick = true
            this._getEngine().setLevel(levelNum)
        } else {
            // TODO: no need to set the levelEngine when the current level is a Message
        }
        this._currentLevelNum = levelNum
    }
    tick(): TickResult {
        // When the current level is a Message, wait until the user presses ACTION
        if (!this.getCurrentLevel().isMap()) {
            // Wait until the user presses "X" (ACTION)
            let didWinGame = false
            let didLevelChange = false
            if (this._getEngine()._pendingPlayerWantsToMove === RULE_DIRECTION_ABSOLUTE.ACTION) {
                didLevelChange = true
                if (this._currentLevelNum === this._getEngine().gameData.levels.length - 1) {
                    didWinGame = true
                } else {
                    this.setLevel(this._currentLevelNum + 1)
                }
            }
            // clear any keys that were pressed
            this._getEngine()._pendingPlayerWantsToMove = null

            return {
                changedCells: new Set(),
                soundToPlay: null,
                didWinGame: didWinGame,
                didLevelChange: didLevelChange,
                wasAgainTick: false
            }
        }
        const hasAgain = this._getEngine().hasAgain()
        if (this._getEngine().gameData.metadata.run_rules_on_level_start && this._isFirstTick) {
            // don't cancel early
        } else if (!hasAgain && !(this._getEngine().gameData.metadata.realtime_interval || this._getEngine()._pendingPlayerWantsToMove)) {
            // check if the `require_player_movement` flag is set in the game
            return {
                changedCells: new Set(),
                soundToPlay: null,
                didWinGame: false,
                didLevelChange: false,
                wasAgainTick: false
            }
        }

        const {changedCells, soundToPlay, isWinning} = this._getEngine().tick()
        this._isFirstTick = false

        let didWinGame = false
        if (isWinning) {
            if (this._currentLevelNum === this._getEngine().gameData.levels.length - 1) {
                didWinGame = true
            } else {
                this.setLevel(this._currentLevelNum + 1)
            }
        }

        return {
            changedCells,
            soundToPlay,
            didWinGame,
            didLevelChange: isWinning,
            wasAgainTick: hasAgain
        }
    }


    press(direction: RULE_DIRECTION_ABSOLUTE) {
        return this._getEngine().press(direction)
    }
    pressUp() {
        this._getEngine().press(RULE_DIRECTION_ABSOLUTE.UP)
    }
    pressDown() {
        this._getEngine().press(RULE_DIRECTION_ABSOLUTE.DOWN)
    }
    pressLeft() {
        this._getEngine().press(RULE_DIRECTION_ABSOLUTE.LEFT)
    }
    pressRight() {
        this._getEngine().press(RULE_DIRECTION_ABSOLUTE.RIGHT)
    }
    pressAction() {
        this._getEngine().press(RULE_DIRECTION_ABSOLUTE.ACTION)
    }

    pressRestart() {
        this._isFirstTick = true
        this._getEngine().pressRestart()
    }
    pressUndo() {
        this._getEngine().pressUndo()
    }

}