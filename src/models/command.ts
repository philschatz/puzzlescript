import { BaseForLines, IGameCode } from "./BaseForLines";
import { GameSound } from "./sound";
import { Optional } from "../util";

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
    abstract getType(): COMMAND_TYPE
    getSound(): GameSound {
        throw new Error(`BUG: Check getType() first`)
    }
    getMessage(): string {
        throw new Error(`BUG: Check getType() first`)
    }
 }

export class MessageCommand extends AbstractCommand {
    private readonly message: string

    constructor(source: IGameCode, message: string) {
        super(source)
        this.message = message
    }

    getType() { return COMMAND_TYPE.MESSAGE }
    getMessage() { return this.message }

    // These are used by message levels. Maybe we should split this into 2 classes
    isInvalid(): Optional<string> {
        return null
    }
    isMap() {
        return false
    }
}

export class SoundCommand extends AbstractCommand {
    private readonly sound: GameSound
    constructor(source: IGameCode, sound: GameSound) {
        super(source)
        this.sound = sound
        if (!sound) {
            debugger
            console.error(this.toString())
            throw new Error(`ERROR: Sound not found`)
        }
    }

    getType() { return COMMAND_TYPE.SFX }
    getSound() {
        return this.sound
    }
}

export class CancelCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    getType() { return COMMAND_TYPE.CANCEL }
}

export class CheckpointCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    getType() { return COMMAND_TYPE.CHECKPOINT }
}

export class RestartCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    getType() { return COMMAND_TYPE.RESTART }
}

export class WinCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    getType() { return COMMAND_TYPE.WIN }
}

export class AgainCommand extends AbstractCommand {
    constructor(source: IGameCode) {
        super(source)
    }
    getType() { return COMMAND_TYPE.AGAIN }
}
