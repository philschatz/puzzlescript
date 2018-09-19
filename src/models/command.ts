import { Optional } from '../util'
import { BaseForLines, IGameCode } from './BaseForLines'
import { GameSound } from './sound'

export enum COMMAND_TYPE {
    SFX = 'SFX',
    CANCEL = 'CANCEL',
    CHECKPOINT = 'CHECKPOINT',
    RESTART = 'RESTART',
    MESSAGE = 'MESSAGE',
    WIN = 'WIN',
    AGAIN = 'AGAIN' // This acts more as a RULE_MODIFIER but is included here for parsing and then is moved into the modifier section
}

export abstract class AbstractCommand extends BaseForLines {
    public abstract getType(): COMMAND_TYPE
    public getSound(): GameSound {
        throw new Error(`BUG: Check getType() first`)
    }
    public getMessage(): string {
        throw new Error(`BUG: Check getType() first`)
    }
    public abstract toKey(): string
}

export class MessageCommand extends AbstractCommand {
    private readonly message: string

    constructor(source: IGameCode, message: string) {
        super(source)
        this.message = message
    }

    public getType() { return COMMAND_TYPE.MESSAGE }
    public getMessage() { return this.message }

    // These are used by message levels. Maybe we should split this into 2 classes
    public isInvalid(): Optional<string> {
        return null
    }
    public isMap() {
        return false
    }
    public toKey() { return `[MESSAGE:"${this.message}"]` }
}

export class SoundCommand extends AbstractCommand {
    private readonly sound: GameSound
    constructor(source: IGameCode, sound: GameSound) {
        super(source)
        this.sound = sound
        if (!sound) {
            throw new Error(`ERROR: Sound not found\n${this.toString()}`)
        }
    }

    public getType() { return COMMAND_TYPE.SFX }
    public getSound() {
        return this.sound
    }
    public toKey() { return `[SOUND:${this.sound.soundCode}]` }
}

export class CancelCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    public getType() { return COMMAND_TYPE.CANCEL }
    public toKey() { return `[CANCEL]` }
}

export class CheckpointCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    public getType() { return COMMAND_TYPE.CHECKPOINT }
    public toKey() { return `[CHECKPOINT]` }
}

export class RestartCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    public getType() { return COMMAND_TYPE.RESTART }
    public toKey() { return `[RESTART]` }
}

export class WinCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    public getType() { return COMMAND_TYPE.WIN }
    public toKey() { return `[WIN]` }
}

export class AgainCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    public getType() { return COMMAND_TYPE.AGAIN }
    public toKey() { return `[AGAIN]` }
}
